import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  PacificaClient,
  TESTNET_REST,
  TESTNET_WS,
  deposit,
  USDC_MINT,
  TESTNET_USDC_MINT,
  TESTNET_DEPOSIT_OPTIONS,
} from "@confit/pacifica-sdk/src/index.js";
import bs58 from "bs58";

// ─── Config ──────────────────────────────────────────────────

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const USE_TESTNET = process.env.PACIFICA_TESTNET !== "false"; // default to testnet
const REFERRAL_CODE = process.env.PACIFICA_REFERRAL_CODE || "Pacifica";
const DEPOSIT_WAIT_MS = 15_000; // wait for Pacifica to index the deposit

const connection = new Connection(SOLANA_RPC, "confirmed");

function getTreasuryKeypair(): Keypair {
  const key = process.env.TREASURY_KEY || process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!key) throw new Error("TREASURY_KEY env var not set");
  const secretKey = bs58.decode(key);
  return Keypair.fromSecretKey(secretKey);
}

function getUsdcMint(): PublicKey {
  return USE_TESTNET ? TESTNET_USDC_MINT : USDC_MINT;
}

function getPacificaConfig() {
  if (USE_TESTNET) {
    return { baseUrl: TESTNET_REST, wsUrl: TESTNET_WS };
  }
  return {};
}

function getDepositOptions() {
  return USE_TESTNET ? TESTNET_DEPOSIT_OPTIONS : undefined;
}

// ─── Challenge Wallet Setup ──────────────────────────────────

export interface ChallengeWalletResult {
  walletPublicKey: string;
  walletSecretKey: string;
}

/**
 * Full challenge wallet setup flow:
 * 1. Generate fresh Solana keypair
 * 2. Transfer SOL for tx fees
 * 3. Transfer USDC from treasury to the new wallet
 * 4. Deposit USDC into Pacifica vault
 * 5. Wait for Pacifica to index the deposit
 * 6. Claim referral code
 * 7. Set leverage for trading pairs
 */
export async function setupChallengeWallet(
  fundedCapital: number,
  leverage: number
): Promise<ChallengeWalletResult> {
  const treasury = getTreasuryKeypair();
  const challengeKeypair = Keypair.generate();
  const pubkey = challengeKeypair.publicKey;

  console.log(`[Pacifica] Setting up challenge wallet: ${pubkey.toBase58()}`);

  // Step 1: Transfer SOL for tx fees
  console.log(`[Pacifica] Transferring SOL for tx fees...`);
  await transferSol(treasury, pubkey, 0.05);

  // Step 2: Transfer USDC from treasury
  console.log(`[Pacifica] Transferring ${fundedCapital} USDC...`);
  await transferUsdc(treasury, challengeKeypair, fundedCapital);

  // Step 3: Deposit USDC into Pacifica vault
  console.log(`[Pacifica] Depositing to Pacifica vault...`);
  const depositTx = await deposit(connection, challengeKeypair, fundedCapital, getDepositOptions());
  console.log(`[Pacifica] Deposit tx: ${depositTx}`);

  // Step 4: Wait for Pacifica to index the deposit
  console.log(`[Pacifica] Waiting ${DEPOSIT_WAIT_MS / 1000}s for deposit indexing...`);
  await new Promise((r) => setTimeout(r, DEPOSIT_WAIT_MS));

  // Step 5: Claim referral code
  const client = new PacificaClient(challengeKeypair, getPacificaConfig());
  console.log(`[Pacifica] Claiming referral code: ${REFERRAL_CODE}`);
  const referralResult = await client.claimReferral(REFERRAL_CODE);
  if (!referralResult.success) {
    console.warn(`[Pacifica] Referral claim warning: ${referralResult.error}`);
  }

  // Step 6: Set leverage for trading pairs
  for (const symbol of ["SOL", "BTC", "ETH"]) {
    console.log(`[Pacifica] Setting ${symbol} leverage to ${leverage}x`);
    await client.updateLeverage({ symbol, leverage });
  }

  console.log(`[Pacifica] Challenge wallet ready: ${pubkey.toBase58()}`);

  return {
    walletPublicKey: pubkey.toBase58(),
    walletSecretKey: bs58.encode(challengeKeypair.secretKey),
  };
}

// ─── SOL Transfer ────────────────────────────────────────────

async function transferSol(
  from: Keypair,
  to: PublicKey,
  amountSol: number
): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
    })
  );
  tx.feePayer = from.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(from);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`[Pacifica] SOL transfer tx: ${sig}`);
  return sig;
}

// ─── USDC Transfer ──────────────────────────────────────────

async function transferUsdc(
  from: Keypair,
  to: Keypair,
  amountUsdc: number
): Promise<string> {
  const mint = getUsdcMint();
  const fromAta = await getAssociatedTokenAddress(mint, from.publicKey);
  const toAta = await getAssociatedTokenAddress(mint, to.publicKey);

  const tx = new Transaction();

  // Create destination ATA if needed
  try {
    await getAccount(connection, toAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        from.publicKey,
        toAta,
        to.publicKey,
        mint
      )
    );
  }

  const amountRaw = Math.round(amountUsdc * 1_000_000);
  tx.add(createTransferInstruction(fromAta, toAta, from.publicKey, amountRaw));

  tx.feePayer = from.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(from);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`[Pacifica] USDC transfer tx: ${sig}`);
  return sig;
}

// ─── Trading ─────────────────────────────────────────────────

export function getChallengeClient(walletSecretKey: string): PacificaClient {
  const secretKey = bs58.decode(walletSecretKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  return new PacificaClient(keypair, getPacificaConfig());
}

export interface OrderParams {
  walletSecretKey: string;
  pair: string;
  side: "long" | "short";
  size: number;
  leverage: number;
  orderType: "market" | "limit";
  limitPrice?: number;
}

export interface OrderResult {
  orderId: string;
  status: "filled" | "pending";
}

export async function placeOrder(params: OrderParams): Promise<OrderResult> {
  const client = getChallengeClient(params.walletSecretKey);
  const pacificaSide = params.side === "long" ? "bid" : "ask";
  const symbol = params.pair.replace("-PERP", "");

  let result;
  if (params.orderType === "market") {
    result = await client.createMarketOrder({
      symbol,
      amount: params.size.toString(),
      side: pacificaSide,
    });
  } else {
    result = await client.createLimitOrder({
      symbol,
      amount: params.size.toString(),
      price: params.limitPrice!.toString(),
      side: pacificaSide,
    });
  }

  if (!result.success) {
    throw new Error(`Pacifica order failed: ${result.error}`);
  }

  const orderId = (result.data as any)?.order_id?.toString() ?? crypto.randomUUID();

  return {
    orderId,
    status: params.orderType === "market" ? "filled" : "pending",
  };
}

export async function cancelOrder(
  walletSecretKey: string,
  symbol: string,
  orderId: string
): Promise<void> {
  const client = getChallengeClient(walletSecretKey);
  const result = await client.cancelOrder({
    symbol: symbol.replace("-PERP", ""),
    orderId: parseInt(orderId) || undefined,
    clientOrderId: isNaN(parseInt(orderId)) ? orderId : undefined,
  });
  if (!result.success) {
    throw new Error(`Cancel failed: ${result.error}`);
  }
}

export async function closeAllPositions(
  walletSecretKey: string
): Promise<void> {
  const client = getChallengeClient(walletSecretKey);
  await client.cancelAllOrders({ allSymbols: true });
  // TODO: Fetch open positions from Pacifica and close each with reduce-only market orders
}

export async function withdrawToTreasury(
  walletSecretKey: string
): Promise<void> {
  // TODO: Implement Pacifica withdrawal (reverse deposit on-chain instruction)
  // Then transfer USDC from challenge wallet back to treasury
  console.log("[Pacifica] Withdrawal not yet implemented");
}
