import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_ERROR_ACTION, ERROR_HTTP_STATUS, ErrorAction } from "@nft-ticket/shared";
import type { ApiError, ErrorCode } from "@nft-ticket/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eventAccess } from "../auth/event-access.js";
import type { EventAccess } from "../auth/event-access.js";
import { lockUser } from "../auth/sessions.js";
import { detailSelection, eventDetail, tierView, uuidPattern } from "./public-events.js";

const dateTime = { type: "string", format: "date-time" };
const text = (maxLength: number, minLength = 0) => ({ type: "string", maxLength, minLength });
const eventProperties = {
  name: text(200, 1), description: text(10_000), venue: text(500),
  startsAt: dateTime, endsAt: dateTime, timezone: text(100, 1), kycRequired: { type: "boolean" },
};
const eventBody = { type: "object", properties: eventProperties, additionalProperties: false };
const tierProperties = {
  name: text(100, 1), basePrice: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
  currency: { type: "string", enum: ["VND"] },
  totalQuantity: { type: "integer", minimum: 1, maximum: 2_147_483_647 },
  perAccountLimit: { type: "integer", minimum: 1, maximum: 2_147_483_647 },
  saleStartsAt: dateTime, saleEndsAt: dateTime,
};
type EventInput = { name: string; description?: string; venue?: string; startsAt: string; endsAt: string; timezone: string; kycRequired: boolean };
type TierInput = {
  name: string; basePrice: number; currency: "VND"; totalQuantity: number;
  perAccountLimit: number; saleStartsAt: string; saleEndsAt: string;
};
type EventParams = { eventId: string };
const messages = {
  AUTH_REQUIRED: "Đăng nhập để tiếp tục.", MFA_REQUIRED: "Xác thực 2FA để tiếp tục.",
  ACCOUNT_LOCKED: "Tài khoản đang bị khóa.", ROLE_FORBIDDEN: "Bạn không có quyền thực hiện thao tác.",
  NOT_FOUND: "Không tìm thấy tài nguyên.", INVALID_STATE: "Trạng thái sự kiện không cho phép thao tác.",
  VALIDATION_ERROR: "Dữ liệu sự kiện hoặc hạng vé không hợp lệ.",
} satisfies Partial<Record<ErrorCode, string>>;
type Failure = keyof typeof messages;
const failure = (code: Failure) => ({ code });
function fail(req: FastifyRequest, reply: FastifyReply, code: Failure) {
  return reply.code(ERROR_HTTP_STATUS[code]).send({
    code, message: messages[code], correlationId: req.id,
    action: code in DEFAULT_ERROR_ACTION ? DEFAULT_ERROR_ACTION[code as keyof typeof DEFAULT_ERROR_ACTION] : ErrorAction.None,
  } satisfies ApiError);
}
function validTimezone(zone: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return !/^[+-]/.test(zone); } catch { return false; }
}

export function registerEventManagement(app: FastifyInstance, db: PrismaClient, access: EventAccess) {
  const route = { config: { authenticate: access.authenticate }, onRequest: access.csrf };

  async function write<T>(req: FastifyRequest, reply: FastifyReply, status: number,
    task: (tx: Prisma.TransactionClient, permission: (orgId: string, publish?: boolean) => ReturnType<typeof eventAccess>,
      userId: string) => Promise<T | { code: Failure }>,
  ) {
    const identity = access.identity(req);
    if (!identity) return fail(req, reply, "AUTH_REQUIRED");
    const result = await db.$transaction(async (tx) => {
      const userId = identity.session.userId;
      await lockUser(tx, userId);
      const now = access.clock();
      const session = await tx.session.findUnique({
        where: { id: identity.session.id }, include: { user: { select: { lockedUntil: true, sessionVersion: true } } },
      });
      if (session?.user.lockedUntil && +session.user.lockedUntil > now) return failure("ACCOUNT_LOCKED");
      if (!session || session.revokedAt || session.rotatedAt || +session.expiresAt <= now
        || +session.createdAt + 43_200_000 <= now
        || session.user.sessionVersion !== identity.session.user.sessionVersion) return failure("AUTH_REQUIRED");
      const roles = await tx.roleAssignment.findMany({
        where: { userId, scopeType: "organization", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date(now) } }] },
      });
      const current = { ...identity, roles, session: { ...identity.session, mfaVerifiedAt: session.mfaVerifiedAt } };
      return task(tx, (orgId, publish) => eventAccess(current, orgId, publish ?? false, now), userId);
    });
    if (result && typeof result === "object" && "code" in result) return fail(req, reply, result.code as Failure);
    return reply.code(status).send(result);
  }

  async function lockEvent(tx: Prisma.TransactionClient, id: string) {
    if (!uuidPattern.test(id)) return;
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.event.findUnique({ where: { id } });
  }

  app.post<{ Params: { orgId: string }; Body: EventInput }>("/organizations/:orgId/events", {
    ...route, schema: { body: { ...eventBody, required: ["name", "startsAt", "endsAt", "timezone", "kycRequired"] } },
  }, (req, reply) => write(req, reply, 201, async (tx, permission) => {
    const { orgId } = req.params;
    if (!uuidPattern.test(orgId)) return failure("NOT_FOUND");
    const decision = permission(orgId);
    if ("code" in decision) return failure(decision.code);
    const org = await tx.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) return failure("NOT_FOUND");
    const { name, description, venue, timezone, kycRequired, startsAt, endsAt } = req.body;
    if (!name.trim() || !validTimezone(timezone) || +new Date(endsAt) <= +new Date(startsAt)) {
      return failure("VALIDATION_ERROR");
    }
    return eventDetail(await tx.event.create({
      data: { name: name.trim(), description, venue, timezone, kycRequired, organizationId: orgId, policyVersion: "v1",
        startsAt: new Date(startsAt), endsAt: new Date(endsAt) }, select: detailSelection,
    }));
  }));

  app.patch<{ Params: EventParams; Body: Partial<EventInput> }>("/events/:eventId", {
    ...route, schema: { body: { ...eventBody, minProperties: 1, additionalProperties: false } },
  }, (req, reply) => write(req, reply, 200, async (tx, permission) => {
    const event = await lockEvent(tx, req.params.eventId);
    if (!event) return failure("NOT_FOUND");
    const decision = permission(event.organizationId);
    if ("code" in decision) return failure(decision.code);
    if (event.status !== "draft") return failure("INVALID_STATE");
    const { startsAt, endsAt, name, timezone, description, venue, kycRequired } = req.body;
    const start = startsAt ? new Date(startsAt) : event.startsAt;
    const end = endsAt ? new Date(endsAt) : event.endsAt;
    if ((name !== undefined && !name.trim()) || (timezone !== undefined && !validTimezone(timezone)) || end <= start) {
      return failure("VALIDATION_ERROR");
    }
    return eventDetail(await tx.event.update({
      where: { id: event.id }, data: { name: name?.trim(), description, venue, kycRequired, timezone, startsAt: start, endsAt: end },
      select: detailSelection,
    }));
  }));

  for (const method of ["POST", "PATCH"] as const) {
    app.route<{ Params: EventParams & { tierId?: string }; Body: TierInput }>({
      ...route, method, url: method === "POST" ? "/events/:eventId/tiers" : "/events/:eventId/tiers/:tierId",
      schema: { body: { type: "object", properties: tierProperties, required: Object.keys(tierProperties) } },
      handler: (req, reply) => write(req, reply, method === "POST" ? 201 : 200, async (tx, permission) => {
        const event = await lockEvent(tx, req.params.eventId);
        if (!event) return failure("NOT_FOUND");
        const decision = permission(event.organizationId);
        if ("code" in decision) return failure(decision.code);
        if (event.status !== "draft") return failure("INVALID_STATE");
        const { name, basePrice, currency, totalQuantity, perAccountLimit, saleStartsAt, saleEndsAt } = req.body;
        if (!name.trim() || +new Date(saleEndsAt) <= +new Date(saleStartsAt)) return failure("VALIDATION_ERROR");
        const data = { name: name.trim(), faceValue: BigInt(basePrice), currency, quantity: totalQuantity,
          perAccountLimit, saleStartsAt: new Date(saleStartsAt), saleEndsAt: new Date(saleEndsAt) };
        if (method === "POST") return tierView(await tx.ticketTier.create({ data: { ...data, eventId: event.id } }));
        const tierId = req.params.tierId;
        if (!tierId || !uuidPattern.test(tierId)) return failure("NOT_FOUND");
        const tier = await tx.ticketTier.findFirst({ where: { id: tierId, eventId: event.id } });
        if (!tier) return failure("NOT_FOUND");
        if (data.quantity < tier.reserved + tier.sold) return failure("INVALID_STATE");
        return tierView(await tx.ticketTier.update({ where: { id: tier.id }, data }));
      }),
    });
  }

  app.post<{ Params: EventParams; Body: { reason: string } }>("/events/:eventId/publish", {
    ...route, schema: { body: { type: "object", required: ["reason"], properties: { reason: text(2_000, 3) } } },
  }, (req, reply) => write(req, reply, 200, async (tx, permission, userId) => {
    const event = await lockEvent(tx, req.params.eventId);
    if (!event) return failure("NOT_FOUND");
    const decision = permission(event.organizationId, true);
    if ("code" in decision) return failure(decision.code);
    const reason = req.body.reason.trim();
    if (reason.length < 3) return failure("VALIDATION_ERROR");
    if (event.status !== "draft" || !await tx.ticketTier.count({ where: { eventId: event.id } })) return failure("INVALID_STATE");
    const published = await tx.event.update({
      where: { id: event.id }, data: { status: "published" }, select: detailSelection,
    });
    await tx.auditLog.create({ data: {
      actorId: userId, role: decision.role, action: "event.publish", targetType: "event", targetId: event.id,
      before: { status: event.status }, after: { status: published.status }, reason, ip: req.ip, correlationId: req.id,
    } });
    return eventDetail(published);
  }));
}
