import WebSocket from "ws";

const WS_URL = "wss://test-ws.pacifica.fi/ws";

async function main() {
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("Connected!\n");

    // Try many formats and channel names
    const attempts = [
      // Try with method: subscribe, different param shapes
      { method: "subscribe", params: { type: "trades", symbol: "BTC" } },
      { method: "subscribe", params: { type: "orderbook", symbol: "BTC" } },
      { method: "subscribe", params: { type: "ticker", symbol: "BTC" } },
      { method: "subscribe", params: { type: "markPrice", symbol: "BTC" } },
      { method: "subscribe", params: { type: "mark_price", symbol: "BTC" } },
      // Try just the channel as string
      { method: "subscribe", params: "trades:BTC" },
      // Try array format
      { method: "subscribe", params: ["trades", "BTC"] },
      // Hyperliquid-style
      { method: "subscribe", subscription: { type: "trades", coin: "BTC" } },
      { method: "subscribe", subscription: { type: "allMids" } },
      { method: "subscribe", subscription: { type: "l2Book", coin: "BTC" } },
    ];

    for (const msg of attempts) {
      console.log(`>> ${JSON.stringify(msg)}`);
      ws.send(JSON.stringify(msg));
    }
  });

  ws.on("message", (data) => {
    const msg = data.toString();
    if (msg.includes("pong")) return;
    console.log(`<< ${msg}`);
  });

  ws.on("error", (err) => console.error("Error:", err.message));

  setTimeout(() => { ws.close(); process.exit(0); }, 5000);
}

main();
