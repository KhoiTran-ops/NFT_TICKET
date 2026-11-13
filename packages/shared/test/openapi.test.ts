import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  EventStatus,
  KycStatus,
  OrderStatus,
  PERMISSIONS,
  Role,
  ScopeType,
  VERIFICATION_LEVEL_ORDER,
  isErrorCode,
} from "../src/types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const spec: any = parse(readFileSync(fileURLToPath(new URL("../openapi.yaml", import.meta.url)), "utf8"));

const METHODS = ["get", "put", "post", "patch", "delete"] as const;
const SPECIAL_PERMISSIONS = ["public", "self", "system"] as const;
const AUTHZ_SCOPES = ["public", "own", "organization", "event", "platform"] as const;

type Op = { path: string; method: string; op: any };
const operations: Op[] = Object.entries(spec.paths as Record<string, any>).flatMap(([path, item]) =>
  METHODS.filter((m) => item[m]).map((method) => ({ path, method, op: item[method] })),
);
const label = ({ method, path }: Op) => `${method.toUpperCase()} ${path}`;

describe("openapi.yaml — từ chối mặc định (PRODUCT_CONTEXT 2.3)", () => {
  it("có operation", () => {
    expect(operations.length).toBeGreaterThan(0);
  });

  it.each(operations.map((o) => [label(o), o] as const))("%s khai báo x-authz hợp lệ", (_, { op }) => {
    const authz = op["x-authz"];
    expect(authz, "thiếu x-authz").toBeDefined();
    expect([...PERMISSIONS, ...SPECIAL_PERMISSIONS]).toContain(authz.permission);
    expect(AUTHZ_SCOPES).toContain(authz.scope);
    expect(VERIFICATION_LEVEL_ORDER).toContain(authz.minLevel);
    expect(typeof authz.mfa).toBe("boolean");
    expect(typeof authz.audit).toBe("boolean");
    for (const role of authz.roles ?? []) expect(Object.values(Role)).toContain(role);
  });

  it.each(operations.map((o) => [label(o), o] as const))("%s: security khớp với quyền", (_, { op }) => {
    const security = op.security ?? spec.security;
    const permission = op["x-authz"].permission;
    const isPublic = permission === "public" || op["x-authz"].scope === "public";
    if (isPublic) {
      // công khai: cho phép ẩn danh
      const anonymous = security.length === 0 || security.some((s: object) => Object.keys(s).length === 0);
      expect(anonymous).toBe(true);
    } else {
      // không công khai: phải có ít nhất một cơ chế xác thực, không cho ẩn danh, có response 401
      expect(security.length).toBeGreaterThan(0);
      expect(security.every((s: object) => Object.keys(s).length > 0)).toBe(true);
      expect(op.responses["401"], "thiếu response 401").toBeDefined();
    }
    if (op["x-authz"].mfa) expect(op["x-error-codes"]).toContain("MFA_REQUIRED");
    if (op["x-authz"].audit) {
      const bodySchema = op.requestBody?.content?.["application/json"]?.schema;
      const needsReason = !["self"].includes(permission);
      if (needsReason) expect(JSON.stringify(bodySchema)).toMatch(/reason/i);
    }
  });

  it.each(operations.map((o) => [label(o), o] as const))("%s: x-error-codes khớp types.ts và response", (_, { op }) => {
    const codes: string[] = op["x-error-codes"];
    expect(Array.isArray(codes) && codes.length > 0, "thiếu x-error-codes").toBe(true);
    for (const code of codes) {
      expect(isErrorCode(code), `mã ${code} không có trong types.ts`).toBe(true);
      const status = String(ERROR_HTTP_STATUS[code as keyof typeof ERROR_HTTP_STATUS]);
      expect(op.responses[status], `${code} cần response ${status}`).toBeDefined();
    }
    // mọi response lỗi khai báo phải có ít nhất một mã tương ứng
    for (const status of Object.keys(op.responses).filter((s) => /^[45]\d\d$/.test(s))) {
      const hasCode = codes.some((c) => String(ERROR_HTTP_STATUS[c as keyof typeof ERROR_HTTP_STATUS]) === status);
      expect(hasCode, `response ${status} không có mã lỗi nào`).toBe(true);
    }
  });
});

describe("openapi.yaml — không có hủy/hoàn vé cho người dùng (D-001)", () => {
  it("không có path refund và không có quyền hủy/hoàn của người dùng", () => {
    for (const o of operations) {
      expect(o.path).not.toMatch(/refund/i);
      expect(["order:cancel", "refund:request", "ticket:cancel"]).not.toContain(o.op["x-authz"].permission);
    }
  });

  it("path chứa 'cancel' chỉ dành cho hủy SỰ KIỆN bởi org_owner / platform_admin", () => {
    for (const o of operations.filter((x) => /cancel/i.test(x.path))) {
      expect(["event:cancel_request", "event:cancel_approve"]).toContain(o.op["x-authz"].permission);
      expect(o.path).toMatch(/^\/(events\/\{eventId\}\/cancel-request|event-cancellations\/)/);
    }
  });

  it("không có operation DELETE trên orders/tickets", () => {
    for (const o of operations) {
      if (o.method === "delete") expect(o.path).not.toMatch(/orders|tickets/);
    }
  });
});

describe("openapi.yaml ↔ types.ts — enum đồng bộ", () => {
  const schemas = spec.components.schemas;
  it.each([
    ["ErrorCode", ERROR_CODES],
    ["EventStatus", Object.values(EventStatus)],
    ["OrderStatus", Object.values(OrderStatus)],
    ["KycStatus", Object.values(KycStatus)],
    ["Role", Object.values(Role)],
    ["ScopeType", Object.values(ScopeType)],
    ["VerificationLevel", VERIFICATION_LEVEL_ORDER],
  ])("%s", (name, values) => {
    expect([...schemas[name].enum].sort()).toEqual([...values].sort());
  });
});
