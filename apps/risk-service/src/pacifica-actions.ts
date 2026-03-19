import {
  Keypair,
  Connection,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";
import {
  PacificaClient,
  TESTNET_REST,
  TESTNET_WS,
  TESTNET_USDC_MINT,
  USDC_MINT,
} from "@confit/pacifica-sdk";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const USE_TESTNET = process.env.PACIFICA_TESTNET !== "false";
const connection = new Connection(SOLANA_RPC, "confirmed");

function getTreasuryKeypair(): Keypair {
  const key = process.env.TREASURY_KEY || process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!key) throw new Error("TREASURY_KEY not set");
  return Keypair.fromSecretKey(bs58.decode(key));
}

function getUsdcMint(): PublicKey {
  return USE_TESTNET ? TESTNET_USDC_MINT : USDC_MINT;
}

function getClient(walletSecretKey: string): PacificaClient {
  const keypair = Keypair.fromSecretKey(bs58.decode(walletSecretKey));
  const config = USE_TESTNET ? { baseUrl: TESTNET_REST, wsUrl: TESTNET_WS } : {};
  return new PacificaClient(keypair, config);
}

export async function closeAllAndWithdraw(
  walletSecretKey: string,
  balance: string
): Promise<void> {
  const client = getClient(walletSecretKey);
  const challengeKeypair = Keypair.fromSecretKey(bs58.decode(walletSecretKey));

  // Step 1: Cancel all open orders
  console.log("[Pacifica] Cancelling all orders...");
  try {
    await client.cancelAllOrders({ allSymbols: true });
  } catch (err) {
    console.warn("[Pacifica] Cancel all orders warning:", err);
  }

  // Step 2: Withdraw from Pacifica vault if balance is positive
  const numericBalance = parseFloat(balance);
  if (numericBalance > 0) {
    console.log(`[Pacifica] Withdrawing ${balance} USDC from Pacifica...`);
    const result = await client.withdraw(balance);
    if (!result.success) {
      console.error(`[Pacifica] Withdraw failed: ${result.error}`);
    } else {
      console.log(`[Pacifica] Withdraw initiated:`, result.data);
    }

    // Wait for withdrawal to process on-chain
    console.log("[Pacifica] Waiting 10s for withdrawal to process...");
    await new Promise((r) => setTimeout(r, 10_000));

    // Step 3: Transfer USDC from challenge wallet back to treasury
    const treasury = getTreasuryKeypair();
    const mint = getUsdcMint();
    const challengeAta = await getAssociatedTokenAddress(mint, challengeKeypair.publicKey);
    const treasuryAta = await getAssociatedTokenAddress(mint, treasury.publicKey);

    let usdcBalance = 0;
    try {
      const account = await getAccount(connection, challengeAta);
      usdcBalance = Number(account.amount);
    } catch {
      console.warn("[Pacifica] Challenge wallet has no USDC token account");
    }

    if (usdcBalance > 0) {
      console.log(`[Pacifica] Returning ${usdcBalance / 1_000_000} USDC to treasury...`);
      const usdcTx = new Transaction();

      try {
        await getAccount(connection, treasuryAta);
      } catch {
        usdcTx.add(
          createAssociatedTokenAccountInstruction(
            challengeKeypair.publicKey,
            treasuryAta,
            treasury.publicKey,
            mint
          )
        );
      }

      usdcTx.add(
        createTransferInstruction(
          challengeAta,
          treasuryAta,
          challengeKeypair.publicKey,
          usdcBalance
        )
      );

      usdcTx.feePayer = challengeKeypair.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      usdcTx.recentBlockhash = blockhash;
      usdcTx.sign(challengeKeypair);

      const usdcSig = await connection.sendRawTransaction(usdcTx.serialize());
      await connection.confirmTransaction(usdcSig, "confirmed");
      console.log(`[Pacifica] USDC return tx: ${usdcSig}`);
    } else {
      console.warn("[Pacifica] No USDC to transfer back to treasury");
    }
  }

  // Step 4: Return remaining SOL to treasury
  try {
    const treasury = getTreasuryKeypair();
    const solBalance = await connection.getBalance(challengeKeypair.publicKey);
    const FEE_RESERVE = 5_000; // lamports
    const solToReturn = solBalance - FEE_RESERVE;
    if (solToReturn > 0) {
      console.log(`[Pacifica] Returning ${solToReturn / LAMPORTS_PER_SOL} SOL to treasury...`);
      const solTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: challengeKeypair.publicKey,
          toPubkey: treasury.publicKey,
          lamports: solToReturn,
        })
      );
      solTx.feePayer = challengeKeypair.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      solTx.recentBlockhash = blockhash;
      solTx.sign(challengeKeypair);

      const solSig = await connection.sendRawTransaction(solTx.serialize());
      await connection.confirmTransaction(solSig, "confirmed");
      console.log(`[Pacifica] SOL return tx: ${solSig}`);
    }
  } catch (err) {
    console.warn("[Pacifica] SOL return warning:", err);
  }

  console.log("[Pacifica] closeAllAndWithdraw complete");
}
