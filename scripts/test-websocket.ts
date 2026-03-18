/**
 * Test Pacifica WebSocket to discover account/position subscription channels.
 */
import WebSocket from "ws";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { signMessage } from "../packages/pacifica-sdk/src/signer.js";
import { randomUUID } from "crypto";

const SECRET = "5WbPr9YTm44RMtaV3BpCAJaGnohsTpmV72qwAmiv8aT4SE23avJpbvbRVvrifXNdpPaAMwoKHhfyVxcPy1Ma2sae";
const keypair = Keypair.fromSecretKey(bs58.decode(SECRET));
const publicKey = keypair.publicKey.toBase58();

const WS_URL = "wss://test-ws.pacifica.fi/ws";

async function main() {
  console.log(`Wallet: ${publicKey}`);
  console.log(`Connecting to ${WS_URL}...\n`);

  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("Connected!\n");

    // Try subscribing to various channels
    const subscriptions = [
      { method: "subscribe", params: { channel: "account", account: publicKey } },
      { method: "subscribe", params: { channel: "positions", account: publicKey } },
      { method: "subscribe", params: { channel: "orders", account: publicKey } },
      { method: "subscribe", params: { channel: "balance", account: publicKey } },
      { method: "subscribe", params: { channel: "fills", account: publicKey } },
      { method: "subscribe", params: { channel: "user", account: publicKey } },
      // Also try market data
      { method: "subscribe", params: { channel: "trades", symbol: "BTC" } },
      { method: "subscribe", params: { channel: "orderbook", symbol: "BTC" } },
      { method: "subscribe", params: { channel: "ticker", symbol: "BTC" } },
      { method: "subscribe", params: { channel: "kline", symbol: "BTC", interval: "1m" } },
    ];

    for (const sub of subscriptions) {
      console.log(`Sending: ${JSON.stringify(sub)}`);
      ws.send(JSON.stringify(sub));
    }
  });

  ws.on("message", (data) => {
    const msg = data.toString();
    try {
      const parsed = JSON.parse(msg);
      console.log(`\nReceived [${parsed.channel || "unknown"}]:`, JSON.stringify(parsed, null, 2));
    } catch {
      console.log(`\nReceived raw:`, msg);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });

  ws.on("close", (code, reason) => {
    console.log(`\nDisconnected: ${code} ${reason}`);
  });

  // Keep alive for 10 seconds to collect messages
  setTimeout(() => {
    console.log("\n--- Closing after 10s ---");
    ws.close();
    process.exit(0);
  }, 10000);
}

main().catch(console.error);
