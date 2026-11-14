import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

const minute = 60_000;
const hour = 60 * minute;
export type DeliverOtp = (email: string, code: string) => Promise<void>;

export function emailOtp(db: PrismaClient, pepper: Buffer, deliver: DeliverOtp, clock: () => number) {
  const digest = (text: string) => createHmac("sha256", pepper).update(text).digest();
  const target = (email: string) => digest(`email:${email}`);
  const codeHash = (id: string, code: string) => digest(`otp:${id}:${code}`);
  const latest = (tx: Prisma.TransactionClient, targetHash: Buffer) => tx.otpChallenge.findFirst({
    where: { channel: "email", targetHash: new Uint8Array(targetHash) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const lockedUntil = (challenge: Awaited<ReturnType<typeof latest>>) =>
    challenge?.attempts === 5 && challenge.consumedAt ? +challenge.consumedAt + 15 * minute : 0;

  function transaction<T>(targetHash: Buffer, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return db.$transaction(async (tx) => {
      // Serialize sends and verification for the same destination across API instances.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${targetHash.readBigInt64BE()})`;
      return operation(tx);
    });
  }

  return {
    async request(email: string) {
      const targetHash = target(email);
      const result = await transaction(targetHash, async (tx) => {
        const now = clock();
        const previous = await latest(tx, targetHash);
        let retryAt = Math.max(lockedUntil(previous), previous ? +previous.createdAt + minute : 0);
        if (retryAt <= now) {
          const recent = await tx.otpChallenge.findMany({
            where: { channel: "email", targetHash, createdAt: { gt: new Date(now - hour) } },
            orderBy: { createdAt: "desc" }, take: 5, select: { createdAt: true },
          });
          const fifth = recent[4];
          if (fifth) retryAt = +fifth.createdAt + hour;
        }
        if (retryAt > now) return { retryAt };
        const id = randomUUID();
        const code = String(randomInt(1_000_000)).padStart(6, "0");
        await tx.otpChallenge.create({
          data: { id, channel: "email", targetHash, codeHash: codeHash(id, code),
            createdAt: new Date(now), expiresAt: new Date(now + 5 * minute) },
        });
        return { id, code, resendAvailableAt: new Date(now + minute) };
      });
      if (!result.code) return { retryAt: result.retryAt };
      try {
        await deliver(email, result.code);
      } catch {
        await db.otpChallenge.updateMany({
          where: { id: result.id, consumedAt: null }, data: { consumedAt: new Date(clock()) },
        });
        throw new Error("OTP delivery failed");
      }
      return { resendAvailableAt: result.resendAvailableAt };
    },
    verify<T>(email: string, code: string, onVerified: (tx: Prisma.TransactionClient, now: Date) => Promise<T>) {
      const targetHash = target(email);
      return transaction(targetHash, async (tx) => {
        const now = new Date(clock());
        const challenge = await latest(tx, targetHash);
        const retryAt = lockedUntil(challenge);
        if (retryAt > +now) return { error: "OTP_LOCKED", retryAt } as const;
        if (!challenge || challenge.consumedAt || challenge.expiresAt <= now) return { error: "OTP_INVALID" } as const;
        if (!timingSafeEqual(codeHash(challenge.id, code), challenge.codeHash)) {
          const attempts = challenge.attempts + 1;
          const locked = attempts === 5;
          await tx.otpChallenge.update({
            where: { id: challenge.id }, data: { attempts, consumedAt: locked ? now : undefined },
          });
          return locked ? { error: "OTP_LOCKED", retryAt: +now + 15 * minute } as const
            : { error: "OTP_INVALID" } as const;
        }
        await tx.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } });
        return { value: await onVerified(tx, now) } as const;
      });
    },
  };
}
