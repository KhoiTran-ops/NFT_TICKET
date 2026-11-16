import { keccak256, parseTransaction, recoverTransactionAddress, type Address, type Hex } from "viem";
import { ChainError, type ChainClient, type Receipt } from "./client.js";

/**
 * Chain giả lập trong bộ nhớ (TEAM_PLAN: backend chạy với MockChain trước khi có Fuji).
 * Mỗi raw tx gửi lên được "đào" ngay. Có công tắc để giả lập lỗi mạng, revert và mất phản hồi broadcast.
 */
export class MockChain implements ChainClient {
  readonly mined = new Map<Hex, { raw: Hex; from: Address; nonce: number; receipt: Receipt }>();
  private readonly nonces = new Map<string, number>();
  private block = 0n;
  /** Số lần `sendRaw` kế tiếp lỗi mạng (tx không được đào). */
  failSends = 0;
  /** Số lần `prepare` kế tiếp lỗi mạng. */
  failPrepares = 0;
  /** Lần `sendRaw` kế tiếp trả OK nhưng tx bị rơi khỏi mempool (không được đào). */
  dropNextSend = false;
  /** Lần `sendRaw` kế tiếp báo lỗi mạng NHƯNG tx vẫn được đào (mất phản hồi). */
  loseNextAck = false;
  /** Trả `true` để `prepare` báo revert (ví dụ markUsed vé đã dùng). */
  revertWhen: (to: Address, data: Hex) => boolean = () => false;

  constructor(readonly chainId = 31337) {}

  async pendingNonce(address: Address) {
    return this.nonces.get(address.toLowerCase()) ?? 0;
  }

  async prepare({ to, data }: { from: Address; to: Address; data: Hex }) {
    if (this.failPrepares > 0) { this.failPrepares--; throw new ChainError("NETWORK"); }
    if (this.revertWhen(to, data)) throw new ChainError("REVERTED");
    return { gas: 100_000n, maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n };
  }

  async sendRaw(raw: Hex) {
    if (this.failSends > 0) { this.failSends--; throw new ChainError("NETWORK"); }
    const hash = keccak256(raw);
    if (this.mined.has(hash)) throw new ChainError("ALREADY_KNOWN");
    const tx = parseTransaction(raw);
    if (tx.chainId !== this.chainId) throw new ChainError("REVERTED");
    const from = (await recoverTransactionAddress({ serializedTransaction: raw as never })).toLowerCase() as Address;
    const nonce = tx.nonce ?? 0;
    const expected = this.nonces.get(from) ?? 0;
    if (nonce < expected) throw new ChainError("NONCE_TOO_LOW");
    if (this.dropNextSend) { this.dropNextSend = false; return; }
    this.block += 1n;
    this.mined.set(hash, { raw, from, nonce, receipt: { status: "success", blockNumber: this.block } });
    this.nonces.set(from, nonce + 1);
    if (this.loseNextAck) { this.loseNextAck = false; throw new ChainError("NETWORK"); }
  }

  async receipt(hash: Hex) {
    return this.mined.get(hash)?.receipt ?? null;
  }
}
