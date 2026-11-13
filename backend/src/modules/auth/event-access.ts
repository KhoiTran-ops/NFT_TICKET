import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import type { sessions } from "./sessions.js";

export type Identity = NonNullable<Awaited<ReturnType<ReturnType<typeof sessions>["authenticate"]>>>;
export type EventAccess = {
  identity: (request: FastifyRequest) => Identity | undefined;
  optionalIdentity: (request: FastifyRequest) => Promise<Identity | undefined>;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  csrf: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  clock: () => number;
};
export type RegisterStaffRoutes = (app: FastifyInstance, access: EventAccess) => void;

export function eventAccess(identity: Identity, organizationId: string, publish: boolean, now: number):
  { role: "org_owner" | "org_manager" } | { code: "ROLE_FORBIDDEN" | "NOT_FOUND" | "MFA_REQUIRED" } {
  const candidates = identity.roles.filter(({ role, scopeType, expiresAt }) =>
    scopeType === "organization" && (!expiresAt || +expiresAt > now)
    && (role === "org_owner" || (!publish && role === "org_manager")));
  if (!candidates.length) return { code: "ROLE_FORBIDDEN" };
  const scoped = candidates.filter((role) => role.organizationId === organizationId);
  if (!scoped.length) return { code: "NOT_FOUND" };
  const verifiedAt = identity.session.mfaVerifiedAt;
  if (!verifiedAt || (publish && now - +verifiedAt >= 900_000)) return { code: "MFA_REQUIRED" };
  return { role: scoped.some(({ role }) => role === "org_owner") ? "org_owner" : "org_manager" };
}
