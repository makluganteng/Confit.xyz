const BASE = "https://test-api.pacifica.fi/api/v1";

async function tryGet(path: string) {
  try {
    const res = await fetch(BASE + path);
    const text = await res.text();
    const status = res.status;
    if (status !== 404) {
      console.log(`${status} GET ${path}:`, text.slice(0, 400));
    }
  } catch (e: any) {
    console.log(`ERR GET ${path}: ${e.message}`);
  }
}

async function main() {
  console.log("=== REST order book endpoints ===\n");

  const paths = [
    "/orderbook?symbol=BTC",
    "/order_book?symbol=BTC",
    "/depth?symbol=BTC",
    "/book?symbol=BTC",
    "/market/orderbook?symbol=BTC",
    "/market/depth?symbol=BTC",
    "/orderbook?symbol=BTC&limit=10",
    "/depth?symbol=BTC&limit=20",
    "/l2?symbol=BTC",
    "/l2book?symbol=BTC",
  ];

  for (const p of paths) await tryGet(p);

  console.log("\n=== WebSocket order book ===\n");

  const WebSocket = (await import("ws")).default;
  const ws = new WebSocket("wss://test-ws.pacifica.fi/ws");

  ws.on("open", () => {
    const subs = [
      { method: "subscribe", params: { type: "orderbook", symbol: "BTC" } },
      { method: "subscribe", params: { type: "order_book", symbol: "BTC" } },
      { method: "subscribe", params: { type: "depth", symbol: "BTC" } },
      { method: "subscribe", params: { type: "book", symbol: "BTC" } },
      { method: "subscribe", params: { type: "l2", symbol: "BTC" } },
      { method: "subscribe", params: { type: "l2book", symbol: "BTC" } },
      { method: "subscribe", params: { type: "l2_book", symbol: "BTC" } },
    ];

    for (const sub of subs) {
      console.log(`>> ${JSON.stringify(sub)}`);
      ws.send(JSON.stringify(sub));
    }
  });

  ws.on("message", (data) => {
    const msg = data.toString();
    if (msg.includes("pong")) return;
    console.log(`<< ${msg.slice(0, 500)}`);
  });

  setTimeout(() => { ws.close(); process.exit(0); }, 6000);
}

main();
