import type { PrismaClient } from "@prisma/client";
import { privateKeyToAccount } from "viem/accounts";
import { viemChainClient } from "./client.js";
import { relayer } from "./relayer.js";

/**
 * Cấu hình relayer từ biến môi trường. Thiếu hoặc sai → ném lỗi khi khởi động (không chạy nửa vời).
 * RELAYER_PRIVATE_KEY là ví testnet riêng, chỉ nạp qua `.env`, không log.
 */
export function relayerConfig(env: NodeJS.ProcessEnv) {
  const { RELAYER_PRIVATE_KEY, FUJI_RPC_URL, CHAIN_ID } = env;
  const chainId = Number(CHAIN_ID ?? "43113");
  let rpc: URL | undefined;
  try { rpc = FUJI_RPC_URL ? new URL(FUJI_RPC_URL) : undefined; } catch { rpc = undefined; }
  if (!RELAYER_PRIVATE_KEY || !/^0x[0-9a-fA-F]{64}$/.test(RELAYER_PRIVATE_KEY)
    || !rpc || !["https:", "http:"].includes(rpc.protocol) || !Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("Invalid relayer configuration");
  }
  return { privateKey: RELAYER_PRIVATE_KEY as `0x${string}`, rpcUrl: rpc.href, chainId };
}

/** Chạy relayer định kỳ. Trả hàm dừng. Lỗi một vòng không làm dừng worker. */
export function startRelayerWorker(
  db: PrismaClient, config: ReturnType<typeof relayerConfig>,
  options: { intervalMs?: number; onError?: (error: unknown) => void } = {},
) {
  const r = relayer(db, viemChainClient(config.rpcUrl, config.chainId), privateKeyToAccount(config.privateKey));
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const loop = async () => {
    try { await r.tick(); } catch (error) { options.onError?.(error); }
    if (!stopped) timer = setTimeout(loop, options.intervalMs ?? 2_000);
  };
  void loop();
  return { relayer: r, stop() { stopped = true; clearTimeout(timer); } };
}
