import type { Prisma, PrismaClient } from "@prisma/client";
import { ERROR_HTTP_STATUS, ErrorAction, EventStatus } from "@nft-ticket/shared";
import type { ApiError } from "@nft-ticket/shared";
import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

const publicEvent = {
  id: true, organizationId: true, name: true, venue: true, status: true,
  startsAt: true, endsAt: true, timezone: true, kycRequired: true,
} satisfies Prisma.EventSelect;
type PublicEvent = Prisma.EventGetPayload<{ select: typeof publicEvent }>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const publicRoute = { config: { public: true }, exposeHeadRoute: false } as const;

function eventSummary({ venue, startsAt, endsAt, ...event }: PublicEvent) {
  return { ...event, venue: venue ?? undefined, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

function decodeCursor(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) return;
  const [time, id, extra] = Buffer.from(value, "base64url").toString("utf8").split("|");
  if (!time || !id || extra !== undefined || !uuidPattern.test(id)) return;
  const startsAt = new Date(time);
  if (!Number.isFinite(startsAt.getTime()) || startsAt.toISOString() !== time) return;
  return { startsAt, id };
}

export function registerPublicEventRoutes(app: FastifyInstance, db: PrismaClient) {
  app.register(async (scope) => {
    await scope.register(rateLimit, {
      global: false,
      errorResponseBuilder: () => ({ statusCode: 429, code: "RATE_LIMITED" }),
    });
    registerRoutes(scope, db);
  });
}

function registerRoutes(app: FastifyInstance, db: PrismaClient) {
  const listRoute = {
    ...publicRoute, config: { ...publicRoute.config, rateLimit: { max: 60, timeWindow: 60_000 } },
  };
  app.get<{ Querystring: { limit?: unknown; cursor?: unknown } }>("/events", listRoute, async (request, reply) => {
    const { limit: rawLimit = "20", cursor: rawCursor } = request.query;
    const limit = typeof rawLimit === "string" && /^\d{1,3}$/.test(rawLimit) ? Number(rawLimit) : 0;
    const cursor = rawCursor === undefined ? undefined : decodeCursor(rawCursor);
    if (limit < 1 || limit > 100 || (rawCursor !== undefined && !cursor)) {
      return reply.code(ERROR_HTTP_STATUS.VALIDATION_ERROR).send({
        code: "VALIDATION_ERROR", message: "Tham số phân trang không hợp lệ.",
        action: ErrorAction.None, correlationId: request.id,
      } satisfies ApiError);
    }
    const events = await db.event.findMany({
      where: {
        status: EventStatus.Published,
        OR: cursor ? [
          { startsAt: { gt: cursor.startsAt } },
          { startsAt: cursor.startsAt, id: { gt: cursor.id } },
        ] : undefined,
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: publicEvent,
      take: limit + 1,
    });
    const page = events.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(eventSummary),
      nextCursor: events.length > limit && last
        ? Buffer.from(`${last.startsAt.toISOString()}|${last.id}`).toString("base64url") : null,
    };
  });

  app.get<{ Params: { eventId: string } }>("/events/:eventId", publicRoute, async (request, reply) => {
    const { eventId } = request.params;
    const event = uuidPattern.test(eventId) ? await db.event.findFirst({
      where: {
        id: eventId,
        status: { in: [EventStatus.Published, EventStatus.CancelRequested, EventStatus.Cancelled, EventStatus.Completed] },
      },
      select: {
        ...publicEvent, description: true, policyVersion: true,
        tiers: {
          orderBy: { id: "asc" },
          select: {
            id: true, eventId: true, name: true, faceValue: true, currency: true, quantity: true,
            reserved: true, sold: true, saleStartsAt: true, saleEndsAt: true, perAccountLimit: true,
          },
        },
      },
    }) : null;
    if (!event) {
      return reply.code(ERROR_HTTP_STATUS.NOT_FOUND).send({
        code: "NOT_FOUND", message: "Không tìm thấy sự kiện.",
        action: ErrorAction.None, correlationId: request.id,
      } satisfies ApiError);
    }
    const { tiers, description, policyVersion, ...summary } = event;
    return {
      ...eventSummary(summary),
      description: description ?? undefined,
      policyVersion,
      tiers: tiers.map(({ faceValue, quantity, reserved, sold, ...tier }) => {
        const basePrice = Number(faceValue);
        if (!Number.isSafeInteger(basePrice)) throw new Error("Ticket price exceeds API integer range");
        return {
          ...tier, basePrice, totalQuantity: quantity, availableQuantity: quantity - reserved - sold,
          saleStartsAt: tier.saleStartsAt.toISOString(), saleEndsAt: tier.saleEndsAt.toISOString(),
        };
      }),
    };
  });
}
