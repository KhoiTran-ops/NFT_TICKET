import { randomUUID } from "node:crypto";
import fastify, { LogController } from "fastify";
import type { FastifyServerOptions } from "fastify";
import { ERROR_HTTP_STATUS, ErrorAction } from "@nft-ticket/shared";
import type { ApiError } from "@nft-ticket/shared";

declare module "fastify" {
  interface FastifyContextConfig {
    public?: true;
  }
}

export function buildApp(logger: FastifyServerOptions["logger"] = true) {
  const app = fastify({
    logger: logger === false ? false : {
      ...(typeof logger === "object" ? logger : {}),
      // Framework logs outside the normal request lifecycle can carry raw HTTP packets.
      redact: { paths: ["req", "res", "err"], remove: true },
    },
    logController: new LogController({ disableRequestLogging: true }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-request-id", request.id);
    if (request.routeOptions.url && request.routeOptions.config.public !== true) {
      return reply.code(401).send({
        code: "AUTH_REQUIRED",
        message: "Đăng nhập để tiếp tục.",
        action: ErrorAction.Login,
        correlationId: request.id,
      } satisfies ApiError);
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info({
      route: request.routeOptions.url ?? "unmatched",
      status: reply.statusCode,
      elapsedMs: reply.elapsedTime,
    }, "Request completed");
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      code: "NOT_FOUND",
      message: "Không tìm thấy tài nguyên.",
      action: ErrorAction.None,
      correlationId: request.id,
    } satisfies ApiError);
  });

  app.setErrorHandler((error, request, reply) => {
    const details = typeof error === "object" && error !== null ? error : {};
    const status = "statusCode" in details ? details.statusCode : undefined;
    const clientError = typeof status === "number" && Number.isInteger(status) && status >= 400 && status < 500;
    const code = clientError ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
    if (!clientError) {
      const rawCode = "code" in details ? details.code : "errorCode" in details ? details.errorCode : undefined;
      const errorCode = typeof rawCode === "string" && /^(?:P\d{4}|FST_ERR_[A-Z_]{1,48})$/.test(rawCode)
        ? rawCode : "UNCLASSIFIED";
      request.log.error({ errorCode, route: request.routeOptions.url }, "Request failed");
    }
    return reply.code(clientError ? status : ERROR_HTTP_STATUS[code]).send({
      code,
      message: clientError ? "Yêu cầu không hợp lệ." : "Hệ thống gặp lỗi.",
      action: ErrorAction.None,
      correlationId: request.id,
    } satisfies ApiError);
  });

  app.get("/health", { config: { public: true }, exposeHeadRoute: false }, async () => ({
    status: "ok",
  }));
  return app;
}
