import { Keypair, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import {
  PacificaClient,
  TESTNET_REST,
  TESTNET_WS,
  deposit,
  USDC_MINT,
} from "@confit/pacifica-sdk/src/index.js";
import bs58 from "bs58";

// ─── Config ──────────────────────────────────────────────────

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const USE_TESTNET = process.env.PACIFICA_TESTNET === "true";
const REFERRAL_CODE = process.env.PACIFICA_REFERRAL_CODE || "";

const connection = new Connection(SOLANA_RPC, "confirmed");

function getTreasuryKeypair(): Keypair {
  const secretKey = bs58.decode(process.env.TREASURY_WALLET_PRIVATE_KEY!);
  return Keypair.fromSecretKey(secretKey);
}

function getPacificaConfig() {
  if (USE_TESTNET) {
    return { baseUrl: TESTNET_REST, wsUrl: TESTNET_WS };
  }
  return {}; // defaults to mainnet
}

// ─── Challenge Wallet Setup ──────────────────────────────────

export interface ChallengeWalletResult {
  walletPublicKey: string;
  walletSecretKey: string; // base58-encoded secret key — store encrypted in production
}

/**
 * Full challenge wallet setup flow:
 * 1. Generate fresh Solana keypair
 * 2. Transfer USDC from treasury to the new wallet
 * 3. Deposit USDC into Pacifica vault
 * 4. Claim referral code
 * 5. Set leverage for the trading pair
 */
export async function setupChallengeWallet(
  fundedCapital: number,
  leverage: number
): Promise<ChallengeWalletResult> {
  const treasury = getTreasuryKeypair();
  const challengeKeypair = Keypair.generate();
  const challengePublicKey = challengeKeypair.publicKey;

  console.log(`[Pacifica] Setting up challenge wallet: ${challengePublicKey.toBase58()}`);

  // Step 1: Ensure the challenge wallet has a USDC token account
  // and transfer USDC from treasury
  await transferUsdc(treasury, challengeKeypair, fundedCapital);

  // Step 2: Deposit USDC into Pacifica vault
  console.log(`[Pacifica] Depositing ${fundedCapital} USDC to Pacifica vault...`);
  const depositTx = await deposit(connection, challengeKeypair, fundedCapital);
  console.log(`[Pacifica] Deposit tx: ${depositTx}`);

  // Step 3: Claim referral code (required before trading)
  const client = new PacificaClient(challengeKeypair, getPacificaConfig());

  if (REFERRAL_CODE) {
    console.log(`[Pacifica] Claiming referral code: ${REFERRAL_CODE}`);
    const referralResult = await client.claimReferral(REFERRAL_CODE);
    if (!referralResult.success) {
      console.warn(`[Pacifica] Referral claim warning: ${referralResult.error}`);
      // Don't throw — some wallets may already have a referral
    }
  }

  // Step 4: Set leverage (for primary trading pairs)
  for (const symbol of ["SOL", "BTC", "ETH"]) {
    console.log(`[Pacifica] Setting ${symbol} leverage to ${leverage}x`);
    await client.updateLeverage({ symbol, leverage });
  }

  console.log(`[Pacifica] Challenge wallet ready: ${challengePublicKey.toBase58()}`);

  return {
    walletPublicKey: challengePublicKey.toBase58(),
    walletSecretKey: bs58.encode(challengeKeypair.secretKey),
  };
}

// ─── USDC Transfer Helper ────────────────────────────────────

async function transferUsdc(
  from: Keypair,
  to: Keypair,
  amountUsdc: number
): Promise<string> {
  const { createTransferInstruction } = await import("@solana/spl-token");

  const fromAta = await getAssociatedTokenAddress(USDC_MINT, from.publicKey);
  const toAta = await getAssociatedTokenAddress(USDC_MINT, to.publicKey);

  const tx = new Transaction();

  // Create the destination ATA if it doesn't exist
  try {
    await getAccount(connection, toAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        from.publicKey, // payer
        toAta,
        to.publicKey,
        USDC_MINT
      )
    );
  }

  // Transfer USDC (6 decimals)
  const amountRaw = Math.round(amountUsdc * 1_000_000);
  tx.add(
    createTransferInstruction(
      fromAta,
      toAta,
      from.publicKey,
      amountRaw
    )
  );

  tx.feePayer = from.publicKey;
  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.sign(from);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  console.log(`[Pacifica] USDC transfer tx: ${signature}`);
  return signature;
}

// ─── Trading (using challenge wallet) ────────────────────────

/**
 * Get a PacificaClient for a challenge's wallet.
 */
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

/**
 * Place an order on Pacifica using the challenge wallet.
 */
export async function placeOrder(params: OrderParams): Promise<OrderResult> {
  const client = getChallengeClient(params.walletSecretKey);

  // Map our side names to Pacifica's bid/ask
  const pacificaSide = params.side === "long" ? "bid" : "ask";
  // Map our pair format (SOL-PERP) to Pacifica's symbol (SOL)
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

  // Extract order ID from response
  const orderId = (result.data as any)?.order_id?.toString() ?? crypto.randomUUID();

  return {
    orderId,
    status: params.orderType === "market" ? "filled" : "pending",
  };
}

/**
 * Cancel an order on Pacifica.
 */
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

/**
 * Cancel all orders and close all positions for a challenge wallet.
 */
export async function closeAllPositions(
  walletSecretKey: string
): Promise<void> {
  const client = getChallengeClient(walletSecretKey);

  // Cancel all open orders first
  await client.cancelAllOrders({ allSymbols: true });

  // Close positions by placing reduce-only market orders
  // TODO: Need to fetch open positions first, then close each one
  // For now, this cancels all orders. Position closing will need
  // the account info endpoint which we'll add when available.
}

/**
 * Withdraw all funds from Pacifica and transfer back to treasury.
 */
export async function withdrawToTreasury(
  walletSecretKey: string
): Promise<void> {
  // TODO: Implement Pacifica withdrawal (on-chain instruction, reverse of deposit)
  // Then transfer USDC from challenge wallet back to treasury
  console.log("[Pacifica] Withdrawal not yet implemented");
}
