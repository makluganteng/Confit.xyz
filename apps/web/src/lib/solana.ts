import { Connection, Keypair, PublicKey } from "@solana/web3.js";

// NOTE: Anchor client will be fully wired after the Solana program is built
// and the IDL is generated. For now, this provides the interface.

const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");

function getAdminKeypair(): Keypair {
  const secretKey = Uint8Array.from(
    JSON.parse(process.env.MASTER_WALLET_PRIVATE_KEY || "[]")
  );
  return Keypair.fromSecretKey(secretKey);
}

export async function callFailChallenge(
  challengePda: string,
  statePda: string
): Promise<string> {
  // TODO: Wire up after Anchor program is built and IDL generated
  throw new Error("Solana program not yet connected");
}

export async function callPassChallenge(
  challengePda: string,
  statePda: string,
  tradingCapitalPda: string,
  traderTokenAccount: string,
  totalProfit: number
): Promise<string> {
  // TODO: Wire up after Anchor program is built and IDL generated
  throw new Error("Solana program not yet connected");
}
