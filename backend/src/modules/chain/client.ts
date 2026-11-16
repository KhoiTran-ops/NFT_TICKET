import {
  BaseError, ExecutionRevertedError, NonceTooLowError, createPublicClient, defineChain, http,
  type Address, type Hex,
} from "viem";

/** Lỗi chain đã phân loại. `code` được lưu vào DB (không lưu message thô của RPC). */
export type ChainErrorCode = "REVERTED" | "NETWORK" | "NONCE_TOO_LOW" | "ALREADY_KNOWN";
export class ChainError extends Error {
  constructor(readonly code: ChainErrorCode) {
    super(`Chain error: ${code}`);
    this.name = "ChainError";
  }
}

export type Fees = { gas: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };
export type Receipt = { status: "success" | "reverted"; blockNumber: bigint };

/** Ranh giới với chain. Bản thật dùng viem (Fuji); dev/test dùng MockChain. */
export interface ChainClient {
  readonly chainId: number;
  /** Nonce kế tiếp tính cả tx đang chờ (blockTag "pending"). */
  pendingNonce(address: Address): Promise<number>;
  /** Ước lượng gas + phí. Ném `ChainError("REVERTED")` nếu lời gọi sẽ revert. */
  prepare(request: { from: Address; to: Address; data: Hex }): Promise<Fees>;
  sendRaw(raw: Hex): Promise<void>;
  /** `null` nếu chưa được đào. */
  receipt(hash: Hex): Promise<Receipt | null>;
}

function classify(error: unknown): ChainError {
  if (error instanceof ChainError) return error;
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof ExecutionRevertedError)) return new ChainError("REVERTED");
    if (error.walk((e) => e instanceof NonceTooLowError)) return new ChainError("NONCE_TOO_LOW");
    if (/already known/i.test(error.details ?? "")) return new ChainError("ALREADY_KNOWN");
  }
  return new ChainError("NETWORK");
}

/** ChainClient qua JSON-RPC (Avalanche Fuji: chainId 43113). */
export function viemChainClient(rpcUrl: string, chainId: number): ChainClient {
  const chain = defineChain({
    id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 10_000, retryCount: 0 }) });
  const wrap = async <T>(fn: () => Promise<T>) => {
    try { return await fn(); } catch (error) { throw classify(error); }
  };
  return {
    chainId,
    pendingNonce: (address) => wrap(() => client.getTransactionCount({ address, blockTag: "pending" })),
    prepare: ({ from, to, data }) => wrap(async () => {
      const [gas, fees] = await Promise.all([
        client.estimateGas({ account: from, to, data }),
        client.estimateFeesPerGas(),
      ]);
      // Dư 20% gas để tránh hết gas khi trạng thái đổi giữa lúc ước lượng và lúc đào.
      return { gas: (gas * 12n) / 10n, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas };
    }),
    sendRaw: (raw) => wrap(async () => { await client.sendRawTransaction({ serializedTransaction: raw }); }),
    receipt: (hash) => wrap(async () => {
      const receipt = await client.getTransactionReceipt({ hash }).catch((error: unknown) => {
        if (error instanceof BaseError && error.name === "TransactionReceiptNotFoundError") return null;
        throw error;
      });
      return receipt ? { status: receipt.status, blockNumber: receipt.blockNumber } : null;
    }),
  };
}
