import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { DEFAULT_ERROR_ACTION, ERROR_HTTP_STATUS, ErrorAction } from "@nft-ticket/shared";
import type { ApiError, ErrorCode } from "@nft-ticket/shared";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { emailOtp } from "./otp.js";
import type { DeliverOtp } from "./otp.js";
import { sessions } from "./sessions.js";
import { totpService } from "./totp.js";
import type { RegisterStaffRoutes } from "./event-access.js";

const messages = {
  VALIDATION_ERROR: "Email hoặc mã xác thực không hợp lệ.",
  CSRF_INVALID: "Yêu cầu xác thực không hợp lệ.",
  AUTH_REQUIRED: "Đăng nhập để tiếp tục.",
  ACCOUNT_LOCKED: "Tài khoản đang bị khóa.",
  OTP_INVALID: "Mã xác thực sai, đã hết hạn hoặc đã được dùng.",
  OTP_LOCKED: "Đã nhập sai quá nhiều lần. Vui lòng thử lại sau.",
  RATE_LIMITED: "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
  INVALID_STATE: "Không thể thiết lập 2FA ở trạng thái hiện tại.",
} satisfies Partial<Record<ErrorCode, string>>;
type AuthError = keyof typeof messages;
const cookieOptions = { path: "/", secure: true, sameSite: "lax", httpOnly: true } as const;
const csrfBinding = "__Host-csrf_binding";
const emailSchema = { type: "string", format: "email", maxLength: 254,
  pattern: "^[^\\s,;<>\\u0000-\\u001f]+$" } as const;
const codeSchema = { type: "string", pattern: "^[0-9]{6}$" } as const;
const emailInput = (code: boolean) => ({
  type: "object",
  required: code ? ["email", "code"] : ["email"],
  properties: { email: emailSchema, ...(code ? { code: codeSchema } : {}) },
});

export function registerAuthRoutes(
  app: FastifyInstance, db: PrismaClient,
  options: { jwtSecret: Buffer; otpPepper: Buffer; fieldKey: Buffer; deliver: DeliverOtp; clock?: () => number },
  registerStaffRoutes?: RegisterStaffRoutes,
) {
  const clock = options.clock ?? Date.now;
  const otp = emailOtp(db, options.otpPepper, options.deliver, clock);
  const auth = sessions(db, options.jwtSecret, clock);
  const totp = totpService(db, options.fieldKey, clock);
  const active = new WeakMap<FastifyRequest, NonNullable<Awaited<ReturnType<typeof auth.authenticate>>>>();
  const publicRoute = { public: true } as const;
  const fail = (req: FastifyRequest, reply: FastifyReply, code: AuthError, retryAt?: number) => {
    if (retryAt !== undefined) reply.header("Retry-After", Math.max(1, Math.ceil((retryAt - clock()) / 1000)));
    return reply.code(ERROR_HTTP_STATUS[code]).send({
      code, message: messages[code], correlationId: req.id,
      action: code === "AUTH_REQUIRED" || code === "ACCOUNT_LOCKED" ? DEFAULT_ERROR_ACTION[code] : ErrorAction.None,
    } satisfies ApiError);
  };
  const csrf = async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers["x-csrf-token"];
    const binding = req.cookies[csrfBinding];
    if (typeof header === "string" && /^[A-Za-z0-9_-]{43}$/.test(header) && binding) {
      const signed = req.unsignCookie(binding);
      if (signed.valid && signed.value && signed.value.length === header.length
        && timingSafeEqual(Buffer.from(signed.value), Buffer.from(header))) return;
    }
    return fail(req, reply, "CSRF_INVALID");
  };
  const identityFor = (req: FastifyRequest) => auth.authenticate(req.cookies?.access_token);
  const authenticate = async (req: FastifyRequest, reply: FastifyReply, hideLocked = false) => {
    const identity = await identityFor(req);
    if (!identity) return fail(req, reply, "AUTH_REQUIRED");
    if (identity.locked) return fail(req, reply, hideLocked ? "AUTH_REQUIRED" : "ACCOUNT_LOCKED");
    active.set(req, identity);
  };
  // Logout must work after the 15-minute access token expires, so the refresh cookie also proves the session.
  const logoutTarget = new WeakMap<FastifyRequest, NonNullable<Awaited<ReturnType<typeof auth.forLogout>>>>();
  const authenticateLogout = async (req: FastifyRequest, reply: FastifyReply) => {
    const identity = await identityFor(req);
    const session = identity?.session ?? await auth.forLogout(req.cookies?.refresh_token);
    if (!session) return fail(req, reply, "AUTH_REQUIRED");
    logoutTarget.set(req, session);
  };
  async function setSession(reply: FastifyReply, grant: NonNullable<Awaited<ReturnType<typeof auth.login>>>) {
    const tokens = await auth.tokens(grant);
    return reply.setCookie("access_token", tokens.access, { ...cookieOptions, maxAge: tokens.accessAge })
      .setCookie("refresh_token", tokens.refresh, { ...cookieOptions, maxAge: tokens.refreshAge })
      .send(tokens.body);
  }

  app.register(async (scope) => {
    await scope.register(cookie, { secret: createHmac("sha256", options.jwtSecret).update("csrf-cookie").digest("hex") });
    await scope.register(rateLimit, {
      global: false, hook: "preHandler",
      errorResponseBuilder: () => ({ statusCode: 429, code: "RATE_LIMITED" }),
    });
    scope.addHook("onRequest", async (_req, reply) => { reply.header("Cache-Control", "no-store"); });
    // Hooks receive (request, reply, done); wrap so `done` is never read as `hideLocked`.
    registerStaffRoutes?.(scope, {
      identity: (req) => active.get(req), optionalIdentity: identityFor,
      authenticate: (req, reply) => authenticate(req, reply), csrf, clock,
    });

    scope.get("/auth/csrf", {
      config: { ...publicRoute, rateLimit: { max: 60, timeWindow: 60_000 } }, exposeHeadRoute: false,
    }, async (_req, reply) => {
      const csrfToken = randomBytes(32).toString("base64url");
      reply.setCookie("csrf_token", csrfToken, { ...cookieOptions, maxAge: 3600 })
        .setCookie(csrfBinding, csrfToken, { ...cookieOptions, signed: true, maxAge: 3600 });
      return { csrfToken };
    });
    scope.post<{ Body: { email: string } }>("/auth/otp/request", {
      schema: { body: emailInput(false) }, onRequest: csrf,
      config: { ...publicRoute, rateLimit: { max: 20, timeWindow: 3_600_000 } },
    }, async (req, reply) => {
      const result = await otp.request(req.body.email.toLowerCase());
      if (result.retryAt !== undefined) return fail(req, reply, "RATE_LIMITED", result.retryAt);
      return reply.code(202).send({ resendAvailableAt: result.resendAvailableAt });
    });
    scope.post<{ Body: { email: string; code: string } }>("/auth/otp/verify", {
      schema: { body: emailInput(true) }, onRequest: csrf,
      config: { ...publicRoute, rateLimit: { max: 30, timeWindow: 60_000 } },
    }, async (req, reply) => {
      const email = req.body.email.toLowerCase();
      const result = await otp.verify(email, req.body.code, (tx, now) => auth.login(tx, email, now));
      if (result.error) return fail(req, reply, result.error, result.retryAt);
      if (!result.value) return fail(req, reply, "ACCOUNT_LOCKED");
      return setSession(reply, result.value);
    });
    // The refresh cookie is the credential here and is checked in the handler; CSRF guards the request.
    scope.post("/auth/refresh", { config: { authenticate: csrf } }, async (req, reply) => {
      const result = await auth.rotate(req.cookies.refresh_token);
      if (result.locked) return fail(req, reply, "ACCOUNT_LOCKED");
      if (!result.grant) return fail(req, reply, "AUTH_REQUIRED");
      return setSession(reply, result.grant);
    });
    scope.get("/auth/session", { config: { authenticate }, exposeHeadRoute: false },
      async (req) => active.get(req)?.body);
    const selfWrite = { config: { authenticate: (req: FastifyRequest, reply: FastifyReply) => authenticate(req, reply, true) },
      onRequest: csrf };
    const totpContext = (req: FastifyRequest, session: {
      id: string; userId: string; user: { sessionVersion: number };
    }) => ({
      sessionId: session.id, userId: session.userId, sessionVersion: session.user.sessionVersion,
      ip: req.ip, correlationId: req.id,
    });
    scope.post("/auth/mfa/totp/setup", selfWrite, async (req, reply) => {
      const identity = active.get(req);
      if (!identity) return fail(req, reply, "AUTH_REQUIRED");
      const otpauthUri = await totp.setup(totpContext(req, identity.session));
      if (!otpauthUri) return fail(req, reply, "INVALID_STATE");
      return { otpauthUri };
    });
    for (const mode of ["activate", "verify"] as const) {
      scope.post<{ Body: { code: string } }>(`/auth/mfa/totp/${mode}`, {
        ...selfWrite, schema: { body: { type: "object", required: ["code"], properties: { code: codeSchema } } },
      }, async (req, reply) => {
        const identity = active.get(req);
        if (!identity) return fail(req, reply, "AUTH_REQUIRED");
        const result = await totp.verify(totpContext(req, identity.session), req.body.code, mode === "activate");
        if (result.error) return fail(req, reply, result.error, result.retryAt);
        if (mode === "activate") return reply.code(204).send();
        return { ...identity.body, mfaVerified: true };
      });
    }
    for (const [path, all] of [["/auth/logout", false], ["/auth/logout-all", true]] as const) {
      scope.post(path, { config: { authenticate: authenticateLogout }, onRequest: csrf }, async (req, reply) => {
        const session = logoutTarget.get(req);
        if (!session) return fail(req, reply, "AUTH_REQUIRED");
        await auth.revoke(session, all);
        return reply.clearCookie("access_token", cookieOptions).clearCookie("refresh_token", cookieOptions)
          .code(204).send();
      });
    }
  });
}
