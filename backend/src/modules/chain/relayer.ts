import { Prisma, type ChainTransaction, type PrismaClient } from "@prisma/client";
import { keccak256, type Address, type Hex, type LocalAccount } from "viem";
import { ChainError, type ChainClient } from "./client.js";

/**
 * Relayer (TIC-58): gửi giao dịch thay người dùng/nền tảng, thử lại có giới hạn, không gửi trùng.
 *
 * Bảo đảm "không gửi trùng":
 * 1. `enqueue` chống lặp theo `idempotencyKey` (unique ở DB). Cùng khóa + cùng nội dung → trả hàng cũ.
 * 2. Tx được KÝ và LƯU (nonce, raw, hash) trong transaction DB TRƯỚC khi broadcast. Thử lại = gửi lại
 *    đúng raw đó (cùng nonce, cùng hash), nên chain chỉ có tối đa một tx cho mỗi hàng.
 * 3. Cấp nonce dưới advisory lock theo ví gửi, nên hai worker không ký trùng nonce.
 *
 * Vòng đời: pending → signed → submitted → confirmed | failed.
 * `failed` là trạng thái cuối, cần vận hành đối soát (lastError là mã đã lọc, không phải message RPC).
 */
export type RelayerOptions = {
  clock?: () => number;
  /** Lần chờ đầu trước khi thử lại; nhân đôi mỗi lần, tối đa `maxBackoffMs`. */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  /** Sau bao lâu không thấy receipt thì gửi lại cùng raw tx. */
  rebroadcastAfterMs?: number;
  /** Khoảng hỏi receipt cho tx đã gửi. */
  pollMs?: number;
  maxAttempts?: number;
};

export type EnqueueRequest = { idempotencyKey: string; kind: string; to: Address; data: Hex };

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key reused with different payload");
    this.name = "IdempotencyConflictError";
  }
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const KEY = /^[A-Za-z0-9:._-]{1,200}$/;
const ACTIVE = ["pending", "signed", "submitted"] as const;

export function relayer(db: PrismaClient, chain: ChainClient, account: LocalAccount, options: RelayerOptions = {}) {
  const clock = options.clock ?? Date.now;
  const base = options.baseBackoffMs ?? 5_000;
  const cap = options.maxBackoffMs ?? 5 * 60_000;
  const rebroadcastAfter = options.rebroadcastAfterMs ?? 60_000;
  const poll = options.pollMs ?? 3_000;
  const maxAttempts = options.maxAttempts ?? 5;
  const from = account.address.toLowerCase();
  const now = () => new Date(clock());
  const backoff = (attempts: number) => new Date(clock() + Math.min(cap, base * 2 ** Math.max(0, attempts - 1)));

  async function retryOrFail(row: ChainTransaction, code: string) {
    const attempts = row.attempts + 1;
    const failed = attempts >= row.maxAttempts;
    return db.chainTransaction.update({
      where: { id: row.id },
      data: failed
        ? { attempts, status: "failed", lastError: `MAX_ATTEMPTS:${code}` }
        : { attempts, lastError: code, nextAttemptAt: backoff(attempts) },
    });
  }

  /** pending → signed: cấp nonce, ký, lưu raw + hash. */
  async function sign(row: ChainTransaction) {
    let fees;
    try {
      fees = await chain.prepare({ from: account.address, to: row.toAddress as Address, data: toHex(row.data) });
    } catch (error) {
      const code = error instanceof ChainError ? error.code : "NETWORK";
      // Revert là xác định: thử lại không đổi kết quả.
      if (code === "REVERTED") {
        return db.chainTransaction.update({ where: { id: row.id }, data: { status: "failed", lastError: "REVERTED" } });
      }
      return retryOrFail(row, code);
    }
    let chainNonce: number;
    try {
      chainNonce = await chain.pendingNonce(account.address);
    } catch {
      return retryOrFail(row, "NETWORK");
    }
    return db.$transaction(async (tx) => {
      // Khóa theo ví gửi trong suốt transaction: cấp nonce tuần tự.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`relayer:${chain.chainId}:${from}`}))`;
      const current = await tx.chainTransaction.findUnique({ where: { id: row.id } });
      if (current?.status !== "pending") return current;
      const last = await tx.chainTransaction.aggregate({
        where: { chainId: chain.chainId, fromAddress: from, nonce: { not: null }, status: { in: [...ACTIVE, "confirmed"] } },
        _max: { nonce: true },
      });
      const nonce = Math.max(chainNonce, (last._max.nonce ?? -1) + 1);
      const raw = await account.signTransaction!({
        type: "eip1559", chainId: chain.chainId, nonce, to: row.toAddress as Address, data: toHex(row.data),
        value: 0n, ...fees,
      });
      return tx.chainTransaction.update({
        where: { id: row.id },
        data: { status: "signed", nonce, rawTx: fromHex(raw), txHash: keccak256(raw), nextAttemptAt: now() },
      });
    });
  }

  /** signed → submitted: broadcast raw đã lưu. */
  async function broadcast(row: ChainTransaction) {
    try {
      await chain.sendRaw(toHex(row.rawTx!));
    } catch (error) {
      const code = error instanceof ChainError ? error.code : "NETWORK";
      // Node đã có tx này (gửi lại, hoặc lần trước mất phản hồi): coi như đã gửi, receipt sẽ quyết định.
      if (code !== "ALREADY_KNOWN" && code !== "NONCE_TOO_LOW") return retryOrFail(row, code);
    }
    return db.chainTransaction.update({
      where: { id: row.id }, data: { status: "submitted", submittedAt: now(), nextAttemptAt: new Date(clock() + poll) },
    });
  }

  /** submitted → confirmed | failed, hoặc gửi lại nếu quá lâu không thấy receipt. */
  async function confirm(row: ChainTransaction) {
    let receipt;
    try {
      receipt = await chain.receipt(row.txHash as Hex);
    } catch {
      return db.chainTransaction.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(clock() + poll) } });
    }
    if (receipt?.status === "success") {
      return db.chainTransaction.update({
        where: { id: row.id },
        data: { status: "confirmed", blockNumber: receipt.blockNumber, confirmedAt: now(), lastError: null },
      });
    }
    if (receipt?.status === "reverted") {
      return db.chainTransaction.update({
        where: { id: row.id }, data: { status: "failed", blockNumber: receipt.blockNumber, lastError: "REVERTED" },
      });
    }
    if (row.submittedAt && clock() - +row.submittedAt < rebroadcastAfter) {
      return db.chainTransaction.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(clock() + poll) } });
    }
    // Không thấy receipt quá lâu (tx bị rơi khỏi mempool): gửi lại đúng raw cũ.
    const retried = await retryOrFail(row, "NOT_MINED");
    return retried.status === "failed" ? retried : broadcast(retried);
  }

  async function step(row: ChainTransaction) {
    if (row.status === "pending") return sign(row);
    if (row.status === "signed") return broadcast(row);
    if (row.status === "submitted") return confirm(row);
    return row;
  }

  return {
    from: account.address,

    /** Xếp hàng một thao tác on-chain. Có thể gọi trong transaction nghiệp vụ (truyền `tx`). */
    async enqueue(request: EnqueueRequest, tx: Prisma.TransactionClient = db) {
      if (!KEY.test(request.idempotencyKey) || !ADDRESS.test(request.to) || !/^0x([0-9a-fA-F]{2})*$/.test(request.data)
        || !/^[a-z][a-zA-Z0-9_.]{0,63}$/.test(request.kind)) {
        throw new TypeError("Invalid relayer request");
      }
      const data = {
        idempotencyKey: request.idempotencyKey, kind: request.kind, chainId: chain.chainId,
        fromAddress: from, toAddress: request.to.toLowerCase(), data: fromHex(request.data), maxAttempts,
        nextAttemptAt: now(),
      };
      const existing = await tx.chainTransaction.findUnique({ where: { idempotencyKey: request.idempotencyKey } });
      if (existing) return same(existing, data);
      try {
        return await tx.chainTransaction.create({ data });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        // Hai yêu cầu cùng khóa chạy song song: bên thua đọc lại hàng của bên thắng.
        return same(await tx.chainTransaction.findUniqueOrThrow({ where: { idempotencyKey: request.idempotencyKey } }), data);
      }
    },

    /** Xử lý các hàng đến hạn (mỗi hàng tiến một bước). Gọi định kỳ từ worker. */
    async tick(limit = 20) {
      const due = await db.chainTransaction.findMany({
        where: { status: { in: [...ACTIVE] }, nextAttemptAt: { lte: now() }, fromAddress: from, chainId: chain.chainId },
        orderBy: [{ nonce: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], take: limit,
      });
      const results = [];
      for (const row of due) results.push(await step(row));
      return results;
    },

    /** Tra trạng thái để đối soát (không trả raw tx). */
    async status(idempotencyKey: string) {
      return db.chainTransaction.findUnique({ where: { idempotencyKey }, select: statusView });
    },

    /** Hàng đợi đối soát cho vận hành. */
    async failed(take = 50) {
      return db.chainTransaction.findMany({
        where: { status: "failed", chainId: chain.chainId }, orderBy: { updatedAt: "desc" }, take, select: statusView,
      });
    },
  };
}

const statusView = {
  idempotencyKey: true, kind: true, chainId: true, toAddress: true, status: true, nonce: true, txHash: true,
  attempts: true, maxAttempts: true, lastError: true, blockNumber: true, createdAt: true, updatedAt: true,
  confirmedAt: true,
} satisfies Prisma.ChainTransactionSelect;

function same(existing: ChainTransaction, data: { kind: string; chainId: number; toAddress: string; data: Uint8Array }) {
  if (existing.kind !== data.kind || existing.chainId !== data.chainId || existing.toAddress !== data.toAddress
    || !Buffer.from(existing.data).equals(Buffer.from(data.data))) {
    throw new IdempotencyConflictError();
  }
  return existing;
}

function toHex(bytes: Uint8Array): Hex {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function fromHex(hex: Hex) {
  return Buffer.from(hex.slice(2), "hex");
}
