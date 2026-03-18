import { Keypair } from "@solana/web3.js";
import { signMessage, buildRequestHeader, SignatureHeader } from "./signer.js";

export interface PacificaClientConfig {
  /** Base REST URL. Defaults to mainnet. */
  baseUrl?: string;
  /** WebSocket URL. Defaults to mainnet. */
  wsUrl?: string;
  /** Default expiry window in ms for signatures. Defaults to 5000. */
  expiryWindow?: number;
}

export interface MarketOrderParams {
  symbol: string;
  amount: string;
  side: "bid" | "ask";
  slippagePercent?: string;
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface LimitOrderParams {
  symbol: string;
  price: string;
  amount: string;
  side: "bid" | "ask";
  tif?: "GTC" | "IOC" | "FOK";
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface CancelOrderParams {
  symbol: string;
  orderId?: number;
  clientOrderId?: string;
}

export interface CancelAllOrdersParams {
  allSymbols?: boolean;
  symbol?: string;
  excludeReduceOnly?: boolean;
}

export interface TransferFundsParams {
  toAccount: string;
  amount: string;
}

export interface UpdateLeverageParams {
  symbol: string;
  leverage: number;
}

export interface Subaccount {
  address: string;
  balance: string;
  fee_level: string;
  fee_mode: string;
  created_at: string;
}

export interface PacificaResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const MAINNET_REST = "https://api.pacifica.fi/api/v1";
const MAINNET_WS = "wss://ws.pacifica.fi/ws";
const TESTNET_REST = "https://test-api.pacifica.fi/api/v1";
const TESTNET_WS = "wss://test-ws.pacifica.fi/ws";

export { MAINNET_REST, MAINNET_WS, TESTNET_REST, TESTNET_WS };

export class PacificaClient {
  private baseUrl: string;
  private wsUrl: string;
  private expiryWindow: number;
  private keypair: Keypair;
  private publicKey: string;

  constructor(keypair: Keypair, config?: PacificaClientConfig) {
    this.keypair = keypair;
    this.publicKey = keypair.publicKey.toBase58();
    this.baseUrl = config?.baseUrl ?? MAINNET_REST;
    this.wsUrl = config?.wsUrl ?? MAINNET_WS;
    this.expiryWindow = config?.expiryWindow ?? 5_000;
  }

  // ─── Private Helpers ───────────────────────────────────────

  private makeHeader(type: string): SignatureHeader {
    return {
      type,
      timestamp: Date.now(),
      expiry_window: this.expiryWindow,
    };
  }

  private async signedPost<T = unknown>(
    endpoint: string,
    signatureType: string,
    payload: Record<string, unknown>,
    signingKeypair?: Keypair
  ): Promise<PacificaResponse<T>> {
    const kp = signingKeypair ?? this.keypair;
    const pk = kp.publicKey.toBase58();
    const header = this.makeHeader(signatureType);
    const { signature } = signMessage(header, payload, kp);
    const requestHeader = buildRequestHeader(
      pk,
      signature,
      header.timestamp,
      header.expiry_window
    );

    const body = { ...requestHeader, ...payload };

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    return json as PacificaResponse<T>;
  }

  // ─── Orders ────────────────────────────────────────────────

  /**
   * Place a market order.
   */
  async createMarketOrder(params: MarketOrderParams): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      symbol: params.symbol,
      amount: params.amount,
      side: params.side,
      slippage_percent: params.slippagePercent ?? "0.5",
      reduce_only: params.reduceOnly ?? false,
      client_order_id: params.clientOrderId ?? crypto.randomUUID(),
    };
    return this.signedPost("/orders/create_market", "create_market_order", payload);
  }

  /**
   * Place a limit order.
   */
  async createLimitOrder(params: LimitOrderParams): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      symbol: params.symbol,
      price: params.price,
      amount: params.amount,
      side: params.side,
      tif: params.tif ?? "GTC",
      reduce_only: params.reduceOnly ?? false,
      client_order_id: params.clientOrderId ?? crypto.randomUUID(),
    };
    return this.signedPost("/orders/create", "create_order", payload);
  }

  /**
   * Cancel a specific order by order_id or client_order_id.
   */
  async cancelOrder(params: CancelOrderParams): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      symbol: params.symbol,
    };
    if (params.orderId !== undefined) payload.order_id = params.orderId;
    if (params.clientOrderId !== undefined) payload.client_order_id = params.clientOrderId;
    return this.signedPost("/orders/cancel", "cancel_order", payload);
  }

  /**
   * Cancel all open orders.
   */
  async cancelAllOrders(
    params?: CancelAllOrdersParams
  ): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      all_symbols: params?.allSymbols ?? true,
      exclude_reduce_only: params?.excludeReduceOnly ?? false,
    };
    if (params?.symbol) payload.symbol = params.symbol;
    return this.signedPost("/orders/cancel_all", "cancel_all_orders", payload);
  }

  // ─── Account / Leverage ────────────────────────────────────

  /**
   * Update leverage for a symbol.
   */
  async updateLeverage(params: UpdateLeverageParams): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      symbol: params.symbol,
      leverage: params.leverage,
    };
    return this.signedPost("/account/leverage", "update_leverage", payload);
  }

  // ─── Subaccounts ───────────────────────────────────────────

  /**
   * Create a subaccount. Requires a cross-signature from both main and sub keypairs.
   *
   * Flow:
   * 1. Subaccount signs the main account's public key
   * 2. Main account signs the subaccount's signature
   * 3. Both signatures are sent to the API
   */
  async createSubaccount(
    subKeypair: Keypair
  ): Promise<PacificaResponse> {
    const mainPublicKey = this.publicKey;
    const subPublicKey = subKeypair.publicKey.toBase58();
    const timestamp = Date.now();
    const expiryWindow = this.expiryWindow;

    // Step 1: Subaccount signs the main account's public key
    const subHeader: SignatureHeader = {
      type: "subaccount_initiate",
      timestamp,
      expiry_window: expiryWindow,
    };
    const { signature: subSignature } = signMessage(
      subHeader,
      { account: mainPublicKey },
      subKeypair
    );

    // Step 2: Main account signs the subaccount's signature
    const mainHeader: SignatureHeader = {
      type: "subaccount_confirm",
      timestamp,
      expiry_window: expiryWindow,
    };
    const { signature: mainSignature } = signMessage(
      mainHeader,
      { signature: subSignature },
      this.keypair
    );

    // Step 3: Send both signatures
    const body = {
      main_account: mainPublicKey,
      subaccount: subPublicKey,
      main_signature: mainSignature,
      sub_signature: subSignature,
      timestamp,
      expiry_window: expiryWindow,
    };

    const res = await fetch(`${this.baseUrl}/account/subaccount/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return (await res.json()) as PacificaResponse;
  }

  /**
   * List all subaccounts for the current account.
   */
  async listSubaccounts(): Promise<
    PacificaResponse<{ subaccounts: Subaccount[] }>
  > {
    return this.signedPost("/account/subaccount/list", "list_subaccounts", {});
  }

  /**
   * Transfer funds between main account and subaccount.
   * The signing keypair must be either the main account or the subaccount.
   * The toAccount must be the other party in the relationship.
   */
  async transferFunds(
    params: TransferFundsParams,
    fromKeypair?: Keypair
  ): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      to_account: params.toAccount,
      amount: params.amount,
    };
    return this.signedPost(
      "/account/subaccount/transfer",
      "transfer_funds",
      payload,
      fromKeypair
    );
  }

  // ─── Convenience Methods for Confit ────────────────────────

  /**
   * Create a new subaccount, fund it, and set leverage.
   * Returns the subaccount keypair for signing future trades.
   */
  async setupTraderSubaccount(
    fundAmount: string,
    symbol: string,
    leverage: number
  ): Promise<{ subKeypair: Keypair; subPublicKey: string }> {
    // Generate a fresh keypair for the subaccount
    const subKeypair = Keypair.generate();
    const subPublicKey = subKeypair.publicKey.toBase58();

    // Create the subaccount relationship
    const createResult = await this.createSubaccount(subKeypair);
    if (!createResult.success) {
      throw new Error(
        `Failed to create subaccount: ${createResult.error ?? "unknown error"}`
      );
    }

    // Transfer funds from main to subaccount
    const transferResult = await this.transferFunds({
      toAccount: subPublicKey,
      amount: fundAmount,
    });
    if (!transferResult.success) {
      throw new Error(
        `Failed to fund subaccount: ${transferResult.error ?? "unknown error"}`
      );
    }

    // Set leverage on the subaccount
    const subClient = new PacificaClient(subKeypair, {
      baseUrl: this.baseUrl,
      wsUrl: this.wsUrl,
    });
    const leverageResult = await subClient.updateLeverage({ symbol, leverage });
    if (!leverageResult.success) {
      throw new Error(
        `Failed to set leverage: ${leverageResult.error ?? "unknown error"}`
      );
    }

    return { subKeypair, subPublicKey };
  }

  /**
   * Create a PacificaClient for a subaccount (using the sub's keypair).
   */
  subaccountClient(subKeypair: Keypair): PacificaClient {
    return new PacificaClient(subKeypair, {
      baseUrl: this.baseUrl,
      wsUrl: this.wsUrl,
      expiryWindow: this.expiryWindow,
    });
  }
}
