export { PacificaClient, MAINNET_REST, MAINNET_WS, TESTNET_REST, TESTNET_WS } from "./client.js";
export type {
  PacificaClientConfig,
  PacificaResponse,
  MarketOrderParams,
  LimitOrderParams,
  CancelOrderParams,
  CancelAllOrdersParams,
  TransferFundsParams,
  UpdateLeverageParams,
  Subaccount,
} from "./client.js";
export { signMessage, buildRequestHeader } from "./signer.js";
export type { SignatureHeader } from "./signer.js";
export {
  deposit,
  buildDepositTransaction,
  PACIFICA_PROGRAM_ID,
  CENTRAL_STATE,
  PACIFICA_VAULT,
  USDC_MINT,
  TESTNET_PACIFICA_PROGRAM_ID,
  TESTNET_CENTRAL_STATE,
  TESTNET_PACIFICA_VAULT,
  TESTNET_USDC_MINT,
  TESTNET_DEPOSIT_OPTIONS,
} from "./deposit.js";
export type { DepositOptions } from "./deposit.js";
