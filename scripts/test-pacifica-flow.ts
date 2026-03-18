/**
 * Test script: Full challenge wallet setup flow against Pacifica testnet.
 *
 * Usage:
 *   source .env && TREASURY_KEY=$TREASURY_KEY npx tsx scripts/test-pacifica-flow.ts
 */

import {
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import {
  PacificaClient,
  TESTNET_REST,
  TESTNET_WS,
} from "../packages/pacifica-sdk/src/index.js";
import { deposit, TESTNET_DEPOSIT_OPTIONS } from "../packages/pacifica-sdk/src/deposit.js";

// Pacifica testnet USDC mint
const TESTNET_USDC_MINT = new PublicKey("USDPqRbLidFGufty2s3oizmDEKdqx7ePTqzDMbf5ZKM");

const SOLANA_RPC = "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

async function transferUsdc(
  from: Keypair,
  toPublicKey: PublicKey,
  amountUsdc: number,
  mint: PublicKey
): Promise<string> {
  const fromAta = await getAssociatedTokenAddress(mint, from.publicKey);
  const toAta = await getAssociatedTokenAddress(mint, toPublicKey);

  const tx = new Transaction();

  // Create destination ATA if needed
  try {
    await getAccount(connection, toAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        from.publicKey,
        toAta,
        toPublicKey,
        mint
      )
    );
  }

  // Transfer (6 decimals for USDC)
  const amountRaw = Math.round(amountUsdc * 1_000_000);
  tx.add(createTransferInstruction(fromAta, toAta, from.publicKey, amountRaw));

  tx.feePayer = from.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(from);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

async function main() {
  const treasuryKey = process.env.TREASURY_KEY;
  if (!treasuryKey) {
    console.error("Usage: TREASURY_KEY=<base58> npx tsx scripts/test-pacifica-flow.ts");
    process.exit(1);
  }

  const treasury = Keypair.fromSecretKey(bs58.decode(treasuryKey));
  console.log(`Treasury: ${treasury.publicKey.toBase58()}`);

  // Check treasury USDC balance
  const treasuryAta = await getAssociatedTokenAddress(TESTNET_USDC_MINT, treasury.publicKey);
  try {
    const ataInfo = await getAccount(connection, treasuryAta);
    console.log(`Treasury USDC balance: ${Number(ataInfo.amount) / 1_000_000}`);
  } catch {
    console.error("Treasury has no USDC token account for the testnet mint.");
    console.error(`Mint: ${TESTNET_USDC_MINT.toBase58()}`);
    console.error("Make sure you minted testnet USDC to the treasury wallet.");
    process.exit(1);
  }

  // Step 1: Generate fresh challenge wallet
  const challengeKeypair = Keypair.generate();
  console.log(`\n=== Step 1: Generated challenge wallet ===`);
  console.log(`Public Key: ${challengeKeypair.publicKey.toBase58()}`);

  // Step 2: Transfer SOL for tx fees
  console.log(`\n=== Step 2: Transferring SOL for tx fees ===`);
  const solTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: challengeKeypair.publicKey,
      lamports: 0.05 * LAMPORTS_PER_SOL,
    })
  );
  solTx.feePayer = treasury.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  solTx.recentBlockhash = blockhash;
  solTx.sign(treasury);
  const solSig = await connection.sendRawTransaction(solTx.serialize());
  await connection.confirmTransaction(solSig, "confirmed");
  console.log(`SOL transfer tx: ${solSig}`);

  // Step 3: Transfer USDC from treasury to challenge wallet
  console.log(`\n=== Step 3: Transferring 100 USDC to challenge wallet ===`);
  const usdcSig = await transferUsdc(treasury, challengeKeypair.publicKey, 100, TESTNET_USDC_MINT);
  console.log(`USDC transfer tx: ${usdcSig}`);

  // Verify balance
  const challengeAta = await getAssociatedTokenAddress(TESTNET_USDC_MINT, challengeKeypair.publicKey);
  const challengeUsdcInfo = await getAccount(connection, challengeAta);
  console.log(`Challenge wallet USDC: ${Number(challengeUsdcInfo.amount) / 1_000_000}`);

  // Step 4: Deposit USDC into Pacifica vault
  // NOTE: The deposit function uses mainnet constants. For testnet, we need to check
  // if Pacifica testnet uses different program ID / vault addresses.
  console.log(`\n=== Step 4: Depositing USDC to Pacifica vault ===`);
  try {
    const depositSig = await deposit(connection, challengeKeypair, 100, TESTNET_DEPOSIT_OPTIONS);
    console.log(`Deposit tx: ${depositSig}`);
  } catch (err: any) {
    console.log(`Deposit failed (may need testnet program addresses): ${err.message}`);
    console.log("Skipping deposit — testing REST API directly...");
  }

  // Wait for Pacifica to index the deposit
  console.log(`\n=== Waiting 15s for Pacifica to index the deposit... ===`);
  await new Promise((r) => setTimeout(r, 15_000));

  // Step 5: Test Pacifica REST API
  console.log(`\n=== Step 5: Testing Pacifica REST API ===`);
  const client = new PacificaClient(challengeKeypair, {
    baseUrl: TESTNET_REST,
    wsUrl: TESTNET_WS,
  });

  // Claim referral code
  console.log(`Claiming referral code: Pacifica`);
  const referralResult = await client.claimReferral("Pacifica");
  console.log(`Referral result:`, JSON.stringify(referralResult, null, 2));

  // Set leverage
  console.log(`Setting BTC leverage to 10x...`);
  const leverageResult = await client.updateLeverage({ symbol: "BTC", leverage: 10 });
  console.log(`Leverage result:`, JSON.stringify(leverageResult, null, 2));

  // Step 6: Place a test market order
  console.log(`\n=== Step 6: Placing test market order ===`);
  const orderResult = await client.createMarketOrder({
    symbol: "BTC",
    amount: "0.001",
    side: "bid",
  });
  console.log(`Order result:`, JSON.stringify(orderResult, null, 2));

  // Step 7: Try limit order
  console.log(`\n=== Step 7: Placing test limit order ===`);
  const limitResult = await client.createLimitOrder({
    symbol: "BTC",
    amount: "0.001",
    price: "50000",
    side: "bid",
  });
  console.log(`Limit order result:`, JSON.stringify(limitResult, null, 2));

  // Step 8: Cancel all orders
  if (limitResult.success) {
    console.log(`\n=== Step 8: Cancelling all orders ===`);
    const cancelResult = await client.cancelAllOrders({ allSymbols: true });
    console.log(`Cancel result:`, JSON.stringify(cancelResult, null, 2));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Challenge wallet: ${challengeKeypair.publicKey.toBase58()}`);
  console.log(`Secret key: ${bs58.encode(challengeKeypair.secretKey)}`);
}

main().catch(console.error);
