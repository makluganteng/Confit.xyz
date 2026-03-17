import { Keypair, Connection } from "@solana/web3.js";

// NOTE: Replace with actual Pacifica SDK imports once available.
// This wrapper abstracts the DEX interaction so the rest of the app
// doesn't depend on Pacifica's exact API shape.

function getMasterWallet(): Keypair {
  const secretKey = Uint8Array.from(
    JSON.parse(process.env.MASTER_WALLET_PRIVATE_KEY!)
  );
  return Keypair.fromSecretKey(secretKey);
}

export interface SubaccountInfo {
  id: string;
  equity: number;
  positions: PacificaPosition[];
}

export interface PacificaPosition {
  pair: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  leverage: number;
}

export interface OrderParams {
  subaccountId: string;
  pair: string;
  side: "long" | "short";
  size: number;
  leverage: number;
  orderType: "market" | "limit";
  limitPrice?: number;
}

export interface OrderResult {
  orderId: string;
  status: "filled" | "pending";
  fillPrice?: number;
}

export async function createSubaccount(label: string): Promise<string> {
  // TODO: Integrate with Pacifica SDK to create a subaccount
  throw new Error("Pacifica integration not yet implemented");
}

export async function fundSubaccount(
  subaccountId: string,
  amount: number
): Promise<void> {
  throw new Error("Pacifica integration not yet implemented");
}

export async function placeOrder(params: OrderParams): Promise<OrderResult> {
  throw new Error("Pacifica integration not yet implemented");
}

export async function cancelOrder(
  subaccountId: string,
  orderId: string
): Promise<void> {
  throw new Error("Pacifica integration not yet implemented");
}

export async function closePosition(
  subaccountId: string,
  pair: string
): Promise<void> {
  throw new Error("Pacifica integration not yet implemented");
}

export async function closeAllPositions(
  subaccountId: string
): Promise<void> {
  throw new Error("Pacifica integration not yet implemented");
}

export async function getSubaccountInfo(
  subaccountId: string
): Promise<SubaccountInfo> {
  throw new Error("Pacifica integration not yet implemented");
}

export async function deallocateSubaccount(
  subaccountId: string
): Promise<void> {
  throw new Error("Pacifica integration not yet implemented");
}
