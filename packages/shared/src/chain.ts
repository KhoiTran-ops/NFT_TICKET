/** Avalanche Fuji C-Chain (PRODUCT_CONTEXT 5.3: SIWE ràng buộc chainId = 43113). */
export const FUJI_CHAIN_ID = 43113 as const;

/** Địa chỉ EVM dạng hex (tương thích kiểu `Address` của viem). */
export type Address = `0x${string}`;
