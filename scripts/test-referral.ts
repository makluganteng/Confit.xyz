import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { signMessage } from "../packages/pacifica-sdk/src/signer.js";

// Use the challenge wallet that already has a deposit
const secretKey = bs58.decode("4v8qJrTYfnCR8ymkgtbzMcBd4wdxLmBYQzWBDH29H857yh55LhX41KBisD5FbFEHccB5MuHhPzVCeB6xdRztkxzp");
const keypair = Keypair.fromSecretKey(secretKey);
const publicKey = keypair.publicKey.toBase58();

const BASE = "https://test-api.pacifica.fi/api/v1";

async function tryEndpoint(path: string, type: string, payload: Record<string, unknown>) {
  const header = { type, timestamp: Date.now(), expiry_window: 5000 };
  const { signature } = signMessage(header, payload, keypair);
  const body = {
    account: publicKey,
    signature,
    timestamp: header.timestamp,
    expiry_window: header.expiry_window,
    ...payload,
  };
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(`${path} [${type}]:`, JSON.stringify(json));
}

async function main() {
  console.log(`Wallet: ${publicKey}\n`);

  // Try different referral/beta endpoints and payload shapes
  await tryEndpoint("/referral/claim", "claim_referral", { referral_code: "Pacifica" });
  await tryEndpoint("/referral/claim", "claim_referral", { code: "Pacifica" });
  await tryEndpoint("/referral/redeem", "redeem_referral", { code: "Pacifica" });
  await tryEndpoint("/referral/redeem", "redeem_referral", { referral_code: "Pacifica" });
  await tryEndpoint("/account/referral", "claim_referral", { referral_code: "Pacifica" });
  await tryEndpoint("/account/referral", "claim_referral", { code: "Pacifica" });
  await tryEndpoint("/account/redeem", "redeem_code", { code: "Pacifica" });
  await tryEndpoint("/beta/redeem", "redeem_beta", { code: "Pacifica" });
  await tryEndpoint("/beta/claim", "claim_beta", { code: "Pacifica" });
  await tryEndpoint("/invite/redeem", "redeem_invite", { code: "Pacifica" });
  await tryEndpoint("/invite/claim", "claim_invite", { code: "Pacifica" });
  await tryEndpoint("/invite/redeem", "redeem_invite_code", { invite_code: "Pacifica" });
}

main().catch(console.error);
