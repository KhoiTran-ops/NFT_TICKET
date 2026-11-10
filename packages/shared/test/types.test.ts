import { describe, expect, it } from "vitest";
import {
  BLOCKING_ERROR_CODES,
  DEFAULT_ERROR_ACTION,
  ERROR_HTTP_STATUS,
  GENERAL_ERROR_CODES,
  PERMISSIONS,
  RefundReason,
  meetsLevel,
} from "../src/types.js";

describe("mã lỗi PRODUCT_CONTEXT 5.7", () => {
  it("khớp đúng bảng 5.7 (mã + HTTP)", () => {
    expect(BLOCKING_ERROR_CODES).toEqual({
      AUTH_REQUIRED: 401,
      MFA_REQUIRED: 401,
      ACCOUNT_LOCKED: 403,
      PHONE_NOT_VERIFIED: 403,
      WALLET_NOT_LINKED: 403,
      KYC_REQUIRED: 403,
      KYC_PENDING: 403,
      KYC_REJECTED: 403,
      KYC_REVOKED: 403,
      ROLE_FORBIDDEN: 403,
      ORGANIZER_CONFLICT: 403,
      PURCHASE_LIMIT_REACHED: 409,
      SALE_WINDOW_CLOSED: 409,
      EVENT_NOT_ACTIVE: 409,
    });
  });

  it("mã chung không trùng mã 5.7", () => {
    for (const code of Object.keys(GENERAL_ERROR_CODES)) expect(BLOCKING_ERROR_CODES).not.toHaveProperty(code);
    expect(Object.keys(ERROR_HTTP_STATUS)).toHaveLength(
      Object.keys(BLOCKING_ERROR_CODES).length + Object.keys(GENERAL_ERROR_CODES).length,
    );
  });

  it("mọi mã 5.7 có hành động gợi ý", () => {
    expect(Object.keys(DEFAULT_ERROR_ACTION).sort()).toEqual(Object.keys(BLOCKING_ERROR_CODES).sort());
  });
});

describe("D-001: không có hủy/hoàn theo yêu cầu người dùng", () => {
  it("không có quyền order:cancel / refund:request", () => {
    expect(PERMISSIONS).not.toContain("order:cancel");
    expect(PERMISSIONS).not.toContain("refund:request");
  });
  it("lý do hoàn tiền chỉ gồm event_cancelled và technical", () => {
    expect(Object.values(RefundReason).sort()).toEqual(["event_cancelled", "technical"]);
  });
});

describe("cấp xác minh", () => {
  it("meetsLevel", () => {
    expect(meetsLevel("L3", "L2")).toBe(true);
    expect(meetsLevel("L2", "L2")).toBe(true);
    expect(meetsLevel("L1", "L2")).toBe(false);
  });
});
