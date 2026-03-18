/**
 * Discover Pacifica account info and withdraw endpoints.
 * Uses the challenge wallet that already has funds deposited.
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { signMessage } from "../packages/pacifica-sdk/src/signer.js";

// Challenge wallet with funds from previous test
const SECRET = "5WbPr9YTm44RMtaV3BpCAJaGnohsTpmV72qwAmiv8aT4SE23avJpbvbRVvrifXNdpPaAMwoKHhfyVxcPy1Ma2sae";
const keypair = Keypair.fromSecretKey(bs58.decode(SECRET));
const publicKey = keypair.publicKey.toBase58();

const BASE = "https://test-api.pacifica.fi/api/v1";

async function tryEndpoint(method: string, path: string, type: string, payload: Record<string, unknown> = {}) {
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
    method,
    headers: { "Content-Type": "application/json" },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  console.log(`${method} ${path} [${type}]:`, JSON.stringify(json, null, 2));
  return json;
}

async function tryGet(path: string) {
  const res = await fetch(BASE + path);
  try {
    const json = await res.json();
    console.log(`GET ${path}:`, JSON.stringify(json, null, 2));
  } catch {
    console.log(`GET ${path}: ${res.status} ${res.statusText}`);
  }
}

async function main() {
  console.log(`Wallet: ${publicKey}\n`);

  // Try account info endpoints (common patterns)
  await tryGet(`/account/${publicKey}`);
  await tryGet(`/account/info?account=${publicKey}`);
  await tryEndpoint("POST", "/account/info", "account_info", {});
  await tryEndpoint("POST", "/account/balance", "account_balance", {});
  await tryEndpoint("POST", "/account/positions", "get_positions", {});
  await tryEndpoint("POST", "/positions", "get_positions", {});
  await tryEndpoint("POST", "/positions/list", "list_positions", {});
  await tryEndpoint("POST", "/account/state", "account_state", {});

  // Try withdraw endpoints
  await tryEndpoint("POST", "/account/withdraw", "withdraw", { amount: "10" });
  await tryEndpoint("POST", "/withdraw", "withdraw", { amount: "10" });

  // Try orders list
  await tryEndpoint("POST", "/orders/open", "get_open_orders", {});
  await tryEndpoint("POST", "/orders/list", "list_orders", {});
}

main().catch(console.error);
