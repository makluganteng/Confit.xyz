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

  // ─── Agent Wallets ──────────────────────────────────────────

  /**
   * Bind an agent wallet to this account.
   * The agent wallet can then sign trades on behalf of this account.
   */
  async bindAgentWallet(
    agentWalletPublicKey: string
  ): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      agent_wallet: agentWalletPublicKey,
    };
    return this.signedPost("/agent/bind", "bind_agent_wallet", payload);
  }

  /**
   * Place a market order using an agent wallet's signature.
   * The agent wallet signs the request, but the order is on this account.
   */
  async createMarketOrderAsAgent(
    params: MarketOrderParams,
    agentKeypair: Keypair
  ): Promise<PacificaResponse> {
    const agentPublicKey = agentKeypair.publicKey.toBase58();
    const header = this.makeHeader("create_market_order");
    const payload: Record<string, unknown> = {
      symbol: params.symbol,
      amount: params.amount,
      side: params.side,
      slippage_percent: params.slippagePercent ?? "0.5",
      reduce_only: params.reduceOnly ?? false,
      client_order_id: params.clientOrderId ?? crypto.randomUUID(),
    };

    const { signature } = signMessage(header, payload, agentKeypair);

    const body = {
      account: this.publicKey,
      agent_wallet: agentPublicKey,
      signature,
      timestamp: header.timestamp,
      expiry_window: header.expiry_window,
      ...payload,
    };

    const res = await fetch(`${this.baseUrl}/orders/create_market`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return (await res.json()) as PacificaResponse;
  }

  // ─── Positions ─────────────────────────────────────────────

  /**
   * Set take-profit and stop-loss for a position.
   */
  async setPositionTpsl(params: {
    symbol: string;
    side: "bid" | "ask";
    takeProfit?: {
      stopPrice: string;
      limitPrice?: string;
      amount?: string;
      clientOrderId?: string;
    };
    stopLoss?: {
      stopPrice: string;
      limitPrice?: string;
      amount?: string;
      clientOrderId?: string;
    };
  }): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      symbol: params.symbol,
      side: params.side,
    };
    if (params.takeProfit) {
      const tp: Record<string, unknown> = {
        stop_price: params.takeProfit.stopPrice,
      };
      if (params.takeProfit.limitPrice) tp.limit_price = params.takeProfit.limitPrice;
      if (params.takeProfit.amount) tp.amount = params.takeProfit.amount;
      if (params.takeProfit.clientOrderId) tp.client_order_id = params.takeProfit.clientOrderId;
      payload.take_profit = tp;
    }
    if (params.stopLoss) {
      const sl: Record<string, unknown> = {
        stop_price: params.stopLoss.stopPrice,
      };
      if (params.stopLoss.limitPrice) sl.limit_price = params.stopLoss.limitPrice;
      if (params.stopLoss.amount) sl.amount = params.stopLoss.amount;
      if (params.stopLoss.clientOrderId) sl.client_order_id = params.stopLoss.clientOrderId;
      payload.stop_loss = sl;
    }
    return this.signedPost("/positions/tpsl", "set_position_tpsl", payload);
  }

  // ─── Referral ──────────────────────────────────────────────

  /**
   * Claim a referral code. Required once per wallet before trading.
   */
  async claimReferral(referralCode: string): Promise<PacificaResponse> {
    const payload: Record<string, unknown> = {
      code: referralCode,
    };
    return this.signedPost("/referral/user/code/claim", "claim_referral_code", payload);
  }

  // ─── Utility ───────────────────────────────────────────────

  /** Get the public key of this client's keypair. */
  getPublicKey(): string {
    return this.publicKey;
  }

  /** Get the keypair. */
  getKeypair(): Keypair {
    return this.keypair;
  }
}
