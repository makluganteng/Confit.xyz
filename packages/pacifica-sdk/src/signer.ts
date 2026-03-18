import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export interface SignatureHeader {
  type: string;
  timestamp: number;
  expiry_window: number;
}

/**
 * Recursively sort all object keys alphabetically.
 * Pacifica expects deterministic JSON for signature verification.
 */
function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortJsonKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Build the canonical message string from header + payload.
 * Must match the Python SDK's prepare_message exactly:
 * - Merge header with { data: payload }
 * - Sort all keys recursively
 * - Compact JSON (no spaces after separators)
 */
function prepareMessage(
  header: SignatureHeader,
  payload: Record<string, unknown>
): string {
  const data = {
    ...header,
    data: payload,
  };
  const sorted = sortJsonKeys(data);
  return JSON.stringify(sorted);
}

/**
 * Sign a message with a Solana keypair.
 * Returns the message string and base58-encoded signature.
 */
export function signMessage(
  header: SignatureHeader,
  payload: Record<string, unknown>,
  keypair: Keypair
): { message: string; signature: string } {
  const message = prepareMessage(header, payload);
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signature = bs58.encode(signatureBytes);
  return { message, signature };
}

/**
 * Build the standard request headers that go with every signed request.
 */
export function buildRequestHeader(
  publicKey: string,
  signature: string,
  timestamp: number,
  expiryWindow: number
): Record<string, unknown> {
  return {
    account: publicKey,
    signature,
    timestamp,
    expiry_window: expiryWindow,
  };
}
