/**
 * Discover Pacifica candle/kline endpoints via REST and WebSocket.
 */

const BASE = "https://test-api.pacifica.fi/api/v1";

async function tryGet(path: string) {
  try {
    const res = await fetch(BASE + path);
    const json = await res.json();
    console.log(`GET ${path}: ${res.status}`, JSON.stringify(json).slice(0, 300));
  } catch (e: any) {
    console.log(`GET ${path}: ERROR ${e.message}`);
  }
}

async function main() {
  console.log("=== Testing REST candle endpoints ===\n");

  // Common candle/kline endpoint patterns
  await tryGet("/candles?symbol=BTC&interval=1h&limit=5");
  await tryGet("/klines?symbol=BTC&interval=1h&limit=5");
  await tryGet("/ohlcv?symbol=BTC&interval=1h&limit=5");
  await tryGet("/market/candles?symbol=BTC&interval=1h&limit=5");
  await tryGet("/market/klines?symbol=BTC&interval=1h&limit=5");
  await tryGet("/market/ohlcv?symbol=BTC&interval=1h&limit=5");
  await tryGet("/trades/candles?symbol=BTC&interval=1h&limit=5");
  await tryGet("/chart?symbol=BTC&interval=1h&limit=5");
  await tryGet("/history?symbol=BTC&resolution=60&from=1773800000&to=1773900000");

  // Try without params
  await tryGet("/candles");
  await tryGet("/klines");
  await tryGet("/market/candles");
  await tryGet("/markets");
  await tryGet("/symbols");
  await tryGet("/info");
  await tryGet("/config");

  console.log("\n=== Testing WebSocket candle subscriptions ===\n");

  const WebSocket = (await import("ws")).default;
  const ws = new WebSocket("wss://test-ws.pacifica.fi/ws");

  ws.on("open", () => {
    const subs = [
      { method: "subscribe", params: { type: "candles", symbol: "BTC", interval: "1m" } },
      { method: "subscribe", params: { type: "klines", symbol: "BTC", interval: "1m" } },
      { method: "subscribe", params: { type: "kline", symbol: "BTC", interval: "1m" } },
      { method: "subscribe", params: { type: "candle", symbol: "BTC", interval: "1m" } },
      { method: "subscribe", params: { type: "ohlcv", symbol: "BTC", interval: "1m" } },
      { method: "subscribe", params: { type: "chart", symbol: "BTC", interval: "1m" } },
      // Also try trades again to see the format
      { method: "subscribe", params: { type: "trades", symbol: "BTC" } },
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

  ws.on("error", (e) => console.log("WS error:", e.message));

  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 8000);
}

main().catch(console.error);
