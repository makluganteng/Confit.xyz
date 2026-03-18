import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { signMessage, SignatureHeader } from "../../packages/pacifica-sdk/src/signer";

function makeHeader(overrides: Partial<SignatureHeader> = {}): SignatureHeader {
  return {
    type: "order",
    timestamp: 1700000000,
    expiry_window: 30,
    ...overrides,
  };
}

describe("signMessage", () => {
  let keypair: Keypair;

  beforeEach(() => {
    keypair = Keypair.generate();
  });

  test("returns message string and base58 signature", () => {
    const header = makeHeader();
    const payload = { symbol: "SOL-PERP", side: "buy", size: 100 };
    const { message, signature } = signMessage(header, payload, keypair);

    expect(typeof message).toBe("string");
    expect(typeof signature).toBe("string");
    // base58 characters only
    expect(signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
  });

  test("message JSON is compact (no spaces after separators)", () => {
    const header = makeHeader();
    const payload = { symbol: "SOL-PERP", size: 100 };
    const { message } = signMessage(header, payload, keypair);

    // Compact JSON has no spaces after ':' or ','
    expect(message).not.toContain(": ");
    expect(message).not.toContain(", ");
  });

  test("JSON keys are sorted alphabetically at top level", () => {
    const header = makeHeader({ type: "order", timestamp: 1700000000, expiry_window: 30 });
    const payload = { zebra: 1, apple: 2, mango: 3 };
    const { message } = signMessage(header, payload, keypair);

    const parsed = JSON.parse(message);
    const keys = Object.keys(parsed);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });

  test("nested object keys are sorted recursively", () => {
    const header = makeHeader();
    const payload = { order: { zebra: 1, apple: 2, mango: 3 } };
    const { message } = signMessage(header, payload, keypair);

    const parsed = JSON.parse(message);
    const nestedKeys = Object.keys(parsed.data.order);
    const sortedNestedKeys = [...nestedKeys].sort();
    expect(nestedKeys).toEqual(sortedNestedKeys);
  });

  test("header fields (type, timestamp, expiry_window) are present in message", () => {
    const header = makeHeader({ type: "order", timestamp: 1700000000, expiry_window: 30 });
    const payload = { symbol: "BTC-PERP" };
    const { message } = signMessage(header, payload, keypair);

    const parsed = JSON.parse(message);
    expect(parsed.type).toBe("order");
    expect(parsed.timestamp).toBe(1700000000);
    expect(parsed.expiry_window).toBe(30);
  });

  test("payload is wrapped in the data field", () => {
    const header = makeHeader();
    const payload = { symbol: "ETH-PERP", side: "sell", size: 50 };
    const { message } = signMessage(header, payload, keypair);

    const parsed = JSON.parse(message);
    expect(parsed.data).toBeDefined();
    expect(parsed.data.symbol).toBe("ETH-PERP");
    expect(parsed.data.side).toBe("sell");
    expect(parsed.data.size).toBe(50);
  });

  test("different payloads produce different signatures", () => {
    const header = makeHeader();
    const payload1 = { symbol: "SOL-PERP", size: 100 };
    const payload2 = { symbol: "BTC-PERP", size: 200 };

    const { signature: sig1 } = signMessage(header, payload1, keypair);
    const { signature: sig2 } = signMessage(header, payload2, keypair);

    expect(sig1).not.toBe(sig2);
  });

  test("same payload and keypair produce consistent signatures", () => {
    const header = makeHeader();
    const payload = { symbol: "SOL-PERP", size: 100 };

    const { message: msg1, signature: sig1 } = signMessage(header, payload, keypair);
    const { message: msg2, signature: sig2 } = signMessage(header, payload, keypair);

    expect(msg1).toBe(msg2);
    expect(sig1).toBe(sig2);
  });

  test("signature is a valid base58-encoded 64-byte ed25519 signature", () => {
    const header = makeHeader();
    const payload = { symbol: "SOL-PERP", size: 100 };
    const { signature } = signMessage(header, payload, keypair);

    const decoded = bs58.decode(signature);
    expect(decoded.length).toBe(64);
  });
});
