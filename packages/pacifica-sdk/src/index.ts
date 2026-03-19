export { PacificaClient, MAINNET_REST, MAINNET_WS, TESTNET_REST, TESTNET_WS } from "./client";
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
} from "./client";
export { signMessage, buildRequestHeader } from "./signer";
export type { SignatureHeader } from "./signer";
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
} from "./deposit";
export type { DepositOptions } from "./deposit";
