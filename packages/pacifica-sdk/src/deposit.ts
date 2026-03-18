import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { createHash } from "crypto";

// Pacifica on-chain program constants (mainnet)
export const PACIFICA_PROGRAM_ID = new PublicKey(
  "PCFA5iYgmqK6MqPhWNKg7Yv7auX7VZ4Cx7T1eJyrAMH"
);
export const CENTRAL_STATE = new PublicKey(
  "9Gdmhq4Gv1LnNMp7aiS1HSVd7pNnXNMsbuXALCQRmGjY"
);
export const PACIFICA_VAULT = new PublicKey(
  "72R843XwZxqWhsJceARQQTTbYtWy6Zw9et2YV4FpRHTa"
);
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

/**
 * Get the Anchor discriminator for an instruction name.
 * Matches: sha256("global:<name>")[:8]
 */
function getDiscriminator(name: string): Buffer {
  const hash = createHash("sha256")
    .update(`global:${name}`)
    .digest();
  return hash.subarray(0, 8);
}

/**
 * Encode a u64 as little-endian 8-byte buffer (borsh U64).
 */
function encodeU64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

/**
 * Build the instruction data for Pacifica deposit.
 * Format: discriminator (8 bytes) + amount as u64 (8 bytes)
 */
function buildDepositInstructionData(amountUsdc: number): Buffer {
  const discriminator = getDiscriminator("deposit");
  // USDC has 6 decimals
  const amountRaw = BigInt(Math.round(amountUsdc * 1_000_000));
  const amountBytes = encodeU64(amountRaw);
  return Buffer.concat([discriminator, amountBytes]);
}

/**
 * Build a Pacifica deposit transaction.
 * This deposits USDC from a wallet into the Pacifica vault.
 */
export async function buildDepositTransaction(
  connection: Connection,
  depositor: PublicKey,
  amountUsdc: number
): Promise<Transaction> {
  // Get the depositor's USDC associated token account
  const depositorUsdcAta = await getAssociatedTokenAddress(
    USDC_MINT,
    depositor
  );

  // Get event authority PDA
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PACIFICA_PROGRAM_ID
  );

  // Build instruction accounts (must match the Python SDK order exactly)
  const keys = [
    { pubkey: depositor, isSigner: true, isWritable: true },
    { pubkey: depositorUsdcAta, isSigner: false, isWritable: true },
    { pubkey: CENTRAL_STATE, isSigner: false, isWritable: true },
    { pubkey: PACIFICA_VAULT, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: PACIFICA_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = buildDepositInstructionData(amountUsdc);

  const instruction = new TransactionInstruction({
    programId: PACIFICA_PROGRAM_ID,
    keys,
    data,
  });

  const tx = new Transaction().add(instruction);
  tx.feePayer = depositor;
  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;

  return tx;
}

/**
 * Deposit USDC into Pacifica vault.
 * Signs and sends the transaction.
 */
export async function deposit(
  connection: Connection,
  keypair: Keypair,
  amountUsdc: number
): Promise<string> {
  const tx = await buildDepositTransaction(
    connection,
    keypair.publicKey,
    amountUsdc
  );
  tx.sign(keypair);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}
