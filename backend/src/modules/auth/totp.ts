import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Secret, TOTP } from "otpauth";
import { lockUser } from "./sessions.js";

const period = 30;
type Context = { userId: string; sessionId: string; sessionVersion: number; ip: string; correlationId: string };

export function totpService(db: PrismaClient, key: Buffer, clock: () => number) {
  function encrypt(secret: Buffer, binding: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv).setAAD(Buffer.from(binding));
    const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  }
  function decrypt(value: Uint8Array, binding: string) {
    const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12))
      .setAAD(Buffer.from(binding)).setAuthTag(value.subarray(12, 28));
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]);
  }
  const authenticator = (secret: Secret, userId: string) => new TOTP({ secret, issuer: "Ve Lai", label: userId, period });

  return {
    setup(ctx: Context) {
      return db.$transaction(async (tx) => {
        await lockUser(tx, ctx.userId);
        const session = await tx.session.findUnique({ where: { id: ctx.sessionId }, include: { user: true } });
        const now = new Date(clock());
        if (!session || session.revokedAt || session.rotatedAt || session.expiresAt <= now
          || session.user.sessionVersion !== ctx.sessionVersion) return;
        // An unactivated secret may be replaced (lost QR, abandoned enrollment); an active one may not.
        if (session.user.totpEnabledAt || (session.user.lockedUntil && session.user.lockedUntil > now)) return;
        const secret = randomBytes(20);
        await tx.user.update({
          where: { id: ctx.userId }, data: { totpSecretCiphertext: encrypt(secret, ctx.userId), totpLastCounter: null },
        });
        await tx.auditLog.create({
          data: { actorId: ctx.userId, role: "user", action: "totp.setup", targetType: "user",
            targetId: ctx.userId, reason: "TOTP enrollment requested", ip: ctx.ip, correlationId: ctx.correlationId },
        });
        return authenticator(new Secret({ buffer: new Uint8Array(secret).buffer }), ctx.userId).toString();
      });
    },
    verify(ctx: Context, code: string, activate: boolean) {
      return db.$transaction(async (tx) => {
        await lockUser(tx, ctx.userId);
        const session = await tx.session.findUnique({ where: { id: ctx.sessionId }, include: { user: true } });
        const now = new Date(clock());
        if (!session || session.revokedAt || session.rotatedAt || session.expiresAt <= now
          || session.user.sessionVersion !== ctx.sessionVersion) return { error: "AUTH_REQUIRED" } as const;
        const user = session.user;
        if (user.lockedUntil && user.lockedUntil > now) return { error: "AUTH_REQUIRED" } as const;
        if (!user.totpSecretCiphertext || Boolean(user.totpEnabledAt) === activate) {
          return { error: activate ? "INVALID_STATE" : "OTP_INVALID" } as const;
        }
        if (user.totpLockedUntil && user.totpLockedUntil > now) {
          return { error: "OTP_LOCKED", retryAt: +user.totpLockedUntil } as const;
        }
        const secret = decrypt(user.totpSecretCiphertext, ctx.userId);
        const delta = authenticator(new Secret({ buffer: new Uint8Array(secret).buffer }), ctx.userId)
          .validate({ token: code, timestamp: +now, window: 1 });
        const counter = delta === null ? null : BigInt(Math.floor(+now / (period * 1000)) + delta);
        if (counter === null || (user.totpLastCounter !== null && counter <= user.totpLastCounter)) {
          const attempts = (user.totpLockedUntil ? 0 : user.totpFailedAttempts) + 1;
          const until = attempts >= 5 ? new Date(+now + 900_000) : null;
          await tx.user.update({ where: { id: user.id }, data: { totpFailedAttempts: attempts, totpLockedUntil: until } });
          return until ? { error: "OTP_LOCKED", retryAt: +until } as const : { error: "OTP_INVALID" } as const;
        }
        await tx.user.update({ where: { id: user.id }, data: {
          totpEnabledAt: activate ? now : undefined, totpLastCounter: counter, totpFailedAttempts: 0, totpLockedUntil: null,
        } });
        await tx.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: now } });
        if (activate) await tx.auditLog.create({
          data: { actorId: user.id, role: "user", action: "totp.activate", targetType: "user", targetId: user.id,
            reason: "TOTP enrollment verified", ip: ctx.ip, correlationId: ctx.correlationId },
        });
        return { verifiedAt: now } as const;
      });
    },
  };
}
