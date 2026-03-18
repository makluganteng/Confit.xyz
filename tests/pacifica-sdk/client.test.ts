import { Keypair } from "@solana/web3.js";
import { PacificaClient } from "../../packages/pacifica-sdk/src/client";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

function makeSuccessResponse(data: unknown = {}) {
  return {
    ok: true,
    json: async () => ({ success: true, data }),
  } as Response;
}

function makeErrorResponse(error: string) {
  return {
    ok: false,
    json: async () => ({ success: false, error }),
  } as Response;
}

describe("PacificaClient", () => {
  let keypair: Keypair;
  let client: PacificaClient;

  beforeEach(() => {
    keypair = Keypair.generate();
    client = new PacificaClient(keypair, {
      baseUrl: "https://test-api.pacifica.fi/api/v1",
      expiryWindow: 5000,
    });
    mockFetch.mockResolvedValue(makeSuccessResponse());
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(makeSuccessResponse());
  });

  // ─── createMarketOrder ─────────────────────────────────────────────────

  test("createMarketOrder sends correct payload fields", async () => {
    await client.createMarketOrder({
      symbol: "SOL-PERP",
      amount: "10",
      side: "bid",
      slippagePercent: "1.0",
      reduceOnly: true,
      clientOrderId: "my-order-id",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.symbol).toBe("SOL-PERP");
    expect(body.amount).toBe("10");
    expect(body.side).toBe("bid");
    expect(body.slippage_percent).toBe("1.0");
    expect(body.reduce_only).toBe(true);
    expect(body.client_order_id).toBe("my-order-id");
  });

  test("createMarketOrder sends to correct endpoint /orders/create_market", async () => {
    await client.createMarketOrder({
      symbol: "SOL-PERP",
      amount: "5",
      side: "ask",
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/orders/create_market");
  });

  test("createMarketOrder uses default slippage and reduce_only when not provided", async () => {
    await client.createMarketOrder({
      symbol: "BTC-PERP",
      amount: "1",
      side: "bid",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.slippage_percent).toBe("0.5");
    expect(body.reduce_only).toBe(false);
  });

  // ─── createLimitOrder ──────────────────────────────────────────────────

  test("createLimitOrder includes price and tif fields", async () => {
    await client.createLimitOrder({
      symbol: "ETH-PERP",
      price: "3000",
      amount: "2",
      side: "bid",
      tif: "IOC",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.price).toBe("3000");
    expect(body.tif).toBe("IOC");
  });

  test("createLimitOrder defaults tif to GTC", async () => {
    await client.createLimitOrder({
      symbol: "ETH-PERP",
      price: "3000",
      amount: "2",
      side: "bid",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tif).toBe("GTC");
  });

  // ─── cancelOrder ───────────────────────────────────────────────────────

  test("cancelOrder sends order_id when provided", async () => {
    await client.cancelOrder({ symbol: "SOL-PERP", orderId: 42 });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.symbol).toBe("SOL-PERP");
    expect(body.order_id).toBe(42);
  });

  test("cancelOrder sends client_order_id when provided", async () => {
    await client.cancelOrder({ symbol: "SOL-PERP", clientOrderId: "cid-123" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.client_order_id).toBe("cid-123");
    expect(body.order_id).toBeUndefined();
  });

  // ─── cancelAllOrders ───────────────────────────────────────────────────

  test("cancelAllOrders sends all_symbols and exclude_reduce_only", async () => {
    await client.cancelAllOrders({ allSymbols: true, excludeReduceOnly: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.all_symbols).toBe(true);
    expect(body.exclude_reduce_only).toBe(true);
  });

  test("cancelAllOrders uses defaults when no params provided", async () => {
    await client.cancelAllOrders();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.all_symbols).toBe(true);
    expect(body.exclude_reduce_only).toBe(false);
  });

  // ─── updateLeverage ────────────────────────────────────────────────────

  test("updateLeverage sends symbol and leverage", async () => {
    await client.updateLeverage({ symbol: "BTC-PERP", leverage: 10 });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.symbol).toBe("BTC-PERP");
    expect(body.leverage).toBe(10);
  });

  // ─── withdraw ──────────────────────────────────────────────────────────

  test("withdraw sends amount to /account/withdraw", async () => {
    await client.withdraw("500.00");

    const url = mockFetch.mock.calls[0][0] as string;
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(url).toContain("/account/withdraw");
    expect(body.amount).toBe("500.00");
  });

  // ─── claimReferral ─────────────────────────────────────────────────────

  test("claimReferral sends code to /referral/user/code/claim", async () => {
    await client.claimReferral("MYCODE");

    const url = mockFetch.mock.calls[0][0] as string;
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(url).toContain("/referral/user/code/claim");
    expect(body.code).toBe("MYCODE");
  });

  // ─── Auth fields in every request ──────────────────────────────────────

  test("all requests include account, signature, timestamp, expiry_window", async () => {
    await client.createMarketOrder({
      symbol: "SOL-PERP",
      amount: "1",
      side: "bid",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.account).toBeDefined();
    expect(body.signature).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.expiry_window).toBeDefined();
  });

  test("account field matches keypair public key", async () => {
    await client.createMarketOrder({
      symbol: "SOL-PERP",
      amount: "1",
      side: "bid",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.account).toBe(keypair.publicKey.toBase58());
  });

  // ─── Error responses ───────────────────────────────────────────────────

  test("returns error response properly when server returns success:false", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse("Insufficient funds"));

    const result = await client.withdraw("9999999");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient funds");
  });
});
