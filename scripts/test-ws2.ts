import WebSocket from "ws";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { signMessage } from "../packages/pacifica-sdk/src/signer.js";

const SECRET = "5WbPr9YTm44RMtaV3BpCAJaGnohsTpmV72qwAmiv8aT4SE23avJpbvbRVvrifXNdpPaAMwoKHhfyVxcPy1Ma2sae";
const keypair = Keypair.fromSecretKey(bs58.decode(SECRET));
const publicKey = keypair.publicKey.toBase58();
const WS_URL = "wss://test-ws.pacifica.fi/ws";

async function main() {
  console.log(`Wallet: ${publicKey}`);
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("Connected!\n");

    // Try different subscription formats
    const attempts = [
      // Format from WS create_market_order example: { id, params: { operation: data } }
      { id: "1", params: { subscribe: { channel: "account", account: publicKey } } },
      { id: "2", params: { subscribe: { channel: "user", account: publicKey } } },
      // Simple format
      { method: "subscribe", params: { channel: "account", account: publicKey } },
      // Authenticated format
      (() => {
        const header = { type: "subscribe", timestamp: Date.now(), expiry_window: 60000 };
        const payload = { channel: "account" };
        const { signature } = signMessage(header, payload, keypair);
        return {
          method: "subscribe",
          params: {
            channel: "account",
            account: publicKey,
            signature,
            timestamp: header.timestamp,
            expiry_window: header.expiry_window,
          },
        };
      })(),
      // Try ping first
      { method: "ping" },
    ];

    for (const msg of attempts) {
      console.log(`>> ${JSON.stringify(msg)}`);
      ws.send(JSON.stringify(msg));
    }
  });

  ws.on("message", (data) => {
    console.log(`<< ${data.toString()}`);
  });

  ws.on("error", (err) => console.error("Error:", err.message));
  ws.on("close", (code) => console.log(`Closed: ${code}`));

  setTimeout(() => { ws.close(); process.exit(0); }, 8000);
}

main().catch(console.error);
