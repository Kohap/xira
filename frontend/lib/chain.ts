const rawChainId = process.env.NEXT_PUBLIC_CHAIN_ID;
const parsedChainId =
  rawChainId && Number.isInteger(Number(rawChainId)) ? Number(rawChainId) : 196;

export const CHAIN_ID = parsedChainId;

export const CHAIN_NAME =
  process.env.NEXT_PUBLIC_CHAIN_NAME ?? "X Layer";

export const CHAIN_LABEL =
  process.env.NEXT_PUBLIC_CHAIN_LABEL ?? "X Layer Mainnet";

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x22851e160aef3e3aeb373fd351a07ff7c65c9b57";

export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_URL ??
  "https://www.okx.com/web3/explorer/xlayer";

export const CONTRACT_URL = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;

export const explorerTxUrl = (tx: string) => `${EXPLORER_BASE}/tx/${tx}`;