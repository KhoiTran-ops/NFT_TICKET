import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";

const accessSeconds = 15 * 60;
/** Parallel refreshes from several tabs reuse the old token within this window; they fail without revoking the family. */
export const REFRESH_REUSE_GRACE_MS = 10_000;
const hour = 3_600_000;
const userView = {
  id: true, displayName: true, emailVerifiedAt: true, phoneVerifiedAt: true,
  lockedUntil: true, sessionVersion: true, kyc: { select: { status: true } },
} satisfies Prisma.UserSelect;
const sessionView = { user: { select: userView } } satisfies Prisma.SessionInclude;
type Session = Prisma.SessionGetPayload<{ include: typeof sessionView }>;
type Role = Prisma.RoleAssignmentGetPayload<{
  select: { role: true; scopeType: true; organizationId: true; eventId: true; expiresAt: true };
}>;
const opaque = /^[A-Za-z0-9_-]{43}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hash = (token: string) => createHash("sha256").update(token).digest();
const staff = (roles: Role[]) => roles.some(({ role }) => role !== "user");
const rolesAt = (db: Prisma.TransactionClient, userId: string, now: Date) => db.roleAssignment.findMany({
  where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  select: { role: true, scopeType: true, organizationId: true, eventId: true, expiresAt: true },
});
export const lockUser = (tx: Prisma.TransactionClient, userId: string) =>
  tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;

export function sessions(db: PrismaClient, secret: Buffer, clock: () => number) {
  async function issue(
    tx: Prisma.TransactionClient, user: Session["user"], now: Date,
    roles: Role[], previous?: Session,
  ) {
    const createdAt = previous?.createdAt ?? now;
    const expiresAt = new Date(Math.min(
      +(previous?.expiresAt ?? new Date(+now + 30 * 24 * hour)),
      staff(roles) ? +createdAt + 12 * hour : Infinity,
    ));
    const token = randomBytes(32).toString("base64url");
    const session = await tx.session.create({
      data: { userId: user.id, sessionVersion: user.sessionVersion, familyId: previous?.familyId ?? randomUUID(),
        refreshTokenHash: hash(token), expiresAt, createdAt, mfaVerifiedAt: previous?.mfaVerifiedAt },
      include: sessionView,
    });
    return { session, token, roles, now };
  }

  function view(session: Session, roles: Role[], accessExpiresAt: Date) {
    const { user } = session;
    return {
      user: { id: user.id, displayName: user.displayName, emailVerified: Boolean(user.emailVerifiedAt),
        phoneVerified: Boolean(user.phoneVerifiedAt), walletLinked: false, kycStatus: user.kyc?.status ?? "not_started" },
      roles: roles.map(({ role, scopeType, organizationId, eventId, expiresAt }) =>
        ({ role, scopeType, scopeId: organizationId ?? eventId, expiresAt })),
      verificationLevel: "L1",
      mfaRequired: staff(roles), mfaVerified: Boolean(session.mfaVerifiedAt),
      accessTokenExpiresAt: accessExpiresAt.toISOString(),
    };
  }

  return {
    async login(tx: Prisma.TransactionClient, email: string, now: Date) {
      const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) await lockUser(tx, existing.id);
      const user = await tx.user.upsert({
        where: { email }, create: { email, displayName: "Người dùng", emailVerifiedAt: now },
        update: {}, select: userView,
      });
      if (user.lockedUntil && user.lockedUntil > now) return;
      if (!user.emailVerifiedAt) {
        await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      }
      if (!existing) await tx.roleAssignment.create({ data: { userId: user.id, role: "user", scopeType: "platform" } });
      return issue(tx, user, now, await rolesAt(tx, user.id, now));
    },
    async tokens(grant: Awaited<ReturnType<typeof issue>>) {
      const { session, roles, now } = grant;
      const issuedAt = Math.floor(+now / 1000);
      const expiresAt = Math.min(issuedAt + accessSeconds, Math.floor(+session.expiresAt / 1000));
      const access = await new SignJWT({ session_version: session.user.sessionVersion })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer("nft-ticket")
        .setSubject(session.userId).setJti(session.id).setIssuedAt(issuedAt).setExpirationTime(expiresAt).sign(secret);
      return { access, refresh: grant.token, accessAge: expiresAt - issuedAt,
        refreshAge: Math.floor((+session.expiresAt - +now) / 1000),
        body: view(session, roles, new Date(expiresAt * 1000)) };
    },
    async authenticate(token: string | undefined) {
      if (!token || token.length > 1024) return;
      const now = new Date(clock());
      const claims = await jwtVerify(token, secret, {
        algorithms: ["HS256"], issuer: "nft-ticket", requiredClaims: ["sub", "jti", "exp", "session_version"], currentDate: now,
      }).then(({ payload }) => payload, () => undefined);
      if (!claims?.jti || !uuid.test(claims.jti)) return;
      const session = await db.session.findUnique({ where: { id: claims.jti }, include: sessionView });
      if (!session || session.revokedAt || session.rotatedAt || session.expiresAt <= now || !session.user.emailVerifiedAt
        || session.userId !== claims.sub || session.sessionVersion !== claims.session_version
        || session.user.sessionVersion !== session.sessionVersion) return;
      const roles = await rolesAt(db, session.userId, now);
      if (staff(roles) && +now >= +session.createdAt + 12 * hour) return;
      return { session, roles, locked: Boolean(session.user.lockedUntil && session.user.lockedUntil > now),
        body: view(session, roles, new Date(Number(claims.exp) * 1000)) };
    },
    async rotate(token: string | undefined) {
      if (!token || !opaque.test(token)) return {};
      const refreshTokenHash = hash(token);
      const reference = await db.session.findUnique({ where: { refreshTokenHash }, select: { userId: true } });
      if (!reference) return {};
      return db.$transaction(async (tx) => {
        await lockUser(tx, reference.userId);
        const now = new Date(clock());
        const session = await tx.session.findUnique({ where: { refreshTokenHash }, include: sessionView });
        if (!session || session.revokedAt || session.expiresAt <= now || !session.user.emailVerifiedAt
          || session.sessionVersion !== session.user.sessionVersion) return {};
        if (session.rotatedAt) {
          if (+now - +session.rotatedAt < REFRESH_REUSE_GRACE_MS) return {};
          await tx.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: now } });
          return {};
        }
        if (session.user.lockedUntil && session.user.lockedUntil > now) return { locked: true };
        const roles = await rolesAt(tx, session.userId, now);
        if (staff(roles) && +now >= +session.createdAt + 12 * hour) return {};
        await tx.session.update({ where: { id: session.id }, data: { rotatedAt: now } });
        return { grant: await issue(tx, session.user, now, roles, session) };
      });
    },
    /** Session for logout when the access token has expired: the refresh token still proves possession. */
    async forLogout(token: string | undefined) {
      if (!token || !opaque.test(token)) return;
      const now = new Date(clock());
      const session = await db.session.findUnique({ where: { refreshTokenHash: hash(token) }, include: sessionView });
      if (!session || session.revokedAt || session.rotatedAt || session.expiresAt <= now
        || session.sessionVersion !== session.user.sessionVersion) return;
      return session;
    },
    revoke(session: Pick<Session, "userId" | "familyId">, all: boolean) {
      return db.$transaction(async (tx) => {
        await lockUser(tx, session.userId);
        if (all) await tx.user.update({ where: { id: session.userId }, data: { sessionVersion: { increment: 1 } } });
        await tx.session.updateMany({
          where: { userId: session.userId, familyId: all ? undefined : session.familyId, revokedAt: null },
          data: { revokedAt: new Date(clock()) },
        });
      });
    },
  };
}
