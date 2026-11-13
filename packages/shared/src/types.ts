/**
 * Kiểu dùng chung FE + BE — hợp đồng v0 (TIC-29).
 *
 * Nguồn: PRODUCT_CONTEXT.md mục 2 (vai trò, quyền), 3 (bán sơ cấp, hoàn tiền khi hủy sự kiện),
 * 4 (đấu giá), 5.4–5.7 (cấp xác minh, eKYC, mã lỗi), 6 (mô hình dữ liệu).
 *
 * Đổi file này = đổi hợp đồng → PR riêng, cần 2 approve (WORKING_RULES 0.5).
 * Enum viết dạng `as const` + union type để dùng được cả lúc chạy (validate, map) lẫn lúc compile.
 *
 * Quy ước: tiền là số nguyên đơn vị nhỏ nhất (VND không có phần lẻ); thời gian là chuỗi ISO 8601 UTC.
 */

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

type ValueOf<T> = T[keyof T];

/** Tiền: số nguyên theo đơn vị nhỏ nhất. MVP chỉ có VND (PRODUCT_CONTEXT mục 1). */
export type MinorUnits = number;
export const CURRENCIES = ["VND"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Chuỗi thời gian ISO 8601, UTC (ví dụ `2026-11-10T07:00:00Z`). */
export type IsoDateTimeUtc = string;

// ---------------------------------------------------------------------------
// Vai trò, phạm vi, quyền (PRODUCT_CONTEXT 2.1–2.3, D-003)
// ---------------------------------------------------------------------------

export const Role = {
  Guest: "guest",
  User: "user",
  OrgOwner: "org_owner",
  OrgManager: "org_manager",
  GateStaff: "gate_staff",
  PlatformOperator: "platform_operator",
  KycReviewer: "kyc_reviewer",
  PlatformAdmin: "platform_admin",
} as const;
export type Role = ValueOf<typeof Role>;

/** Vai trò nhân sự: bắt buộc TOTP 2FA (PRODUCT_CONTEXT 2.3.6, 5.1). */
export const STAFF_ROLES: readonly Role[] = [
  Role.OrgOwner,
  Role.OrgManager,
  Role.GateStaff,
  Role.PlatformOperator,
  Role.KycReviewer,
  Role.PlatformAdmin,
];

export const ScopeType = {
  Platform: "platform",
  Organization: "organization",
  Event: "event",
} as const;
export type ScopeType = ValueOf<typeof ScopeType>;

/**
 * Quyền dạng `resource:action` theo ma trận PRODUCT_CONTEXT 2.2.
 * KHÔNG có `order:cancel` / `refund:request` cho người dùng (D-001).
 */
export const PERMISSIONS = [
  "event:read_public",
  "event:create",
  "event:update_draft",
  "tier:manage",
  "event:publish",
  "event:cancel_request",
  "event:cancel_approve",
  "org:staff_assign",
  "order:create",
  "order:read",
  "ticket:read",
  "ticket:gate_qr",
  "checkin:scan",
  "auction:create",
  "auction:bid",
  "refund:read",
  "refund:retry",
  "exception:resolve",
  "kyc:submit",
  "kyc:read_own",
  "kyc:review",
  "kyc:revoke",
  "organizer:approve",
  "role:grant_platform",
  "config:update",
  "audit:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// ---------------------------------------------------------------------------
// Cấp xác minh (PRODUCT_CONTEXT 5.4, D-006)
// ---------------------------------------------------------------------------

export const VerificationLevel = {
  /** Chưa đăng nhập. */
  L0: "L0",
  /** Email đã xác thực. */
  L1: "L1",
  /** L1 + SĐT đã xác thực + có ví. */
  L2: "L2",
  /** L2 + eKYC `verified`. */
  L3: "L3",
} as const;
export type VerificationLevel = ValueOf<typeof VerificationLevel>;

export const VERIFICATION_LEVEL_ORDER: readonly VerificationLevel[] = ["L0", "L1", "L2", "L3"];

/** `true` nếu `actual` đạt tối thiểu `required`. */
export function meetsLevel(actual: VerificationLevel, required: VerificationLevel): boolean {
  return VERIFICATION_LEVEL_ORDER.indexOf(actual) >= VERIFICATION_LEVEL_ORDER.indexOf(required);
}

// ---------------------------------------------------------------------------
// Sự kiện (PRODUCT_CONTEXT 3.3, 6)
// ---------------------------------------------------------------------------

export const EventStatus = {
  Draft: "draft",
  Published: "published",
  /** org_owner đã gửi yêu cầu hủy: dừng bán sơ cấp, không mở phiên mới. */
  CancelRequested: "cancel_requested",
  /** platform_admin đã duyệt hủy: mọi vé → void_pending_refund. */
  Cancelled: "cancelled",
  Completed: "completed",
} as const;
export type EventStatus = ValueOf<typeof EventStatus>;

/** Trạng thái yêu cầu hủy sự kiện (EventCancellation, PRODUCT_CONTEXT 3.3). */
export const EventCancellationStatus = {
  Requested: "requested",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type EventCancellationStatus = ValueOf<typeof EventCancellationStatus>;

// ---------------------------------------------------------------------------
// Đơn hàng sơ cấp (PRODUCT_CONTEXT 3.1, 6)
// ---------------------------------------------------------------------------

/**
 * Vòng đời đơn sơ cấp. ĐỀ XUẤT v0 — PRODUCT_CONTEXT mục 6 chỉ nêu "trạng thái thanh toán và phát hành",
 * chưa liệt kê giá trị; BE xác nhận khi viết Prisma schema (S0-05 · TIC-31).
 *
 * Không có trạng thái "người dùng hủy" (D-001). Khi sự kiện bị hủy, đơn giữ nguyên `issued`;
 * hoàn tiền theo dõi ở `Refund`, vé chuyển `void_pending_refund`.
 */
export const OrderStatus = {
  /** Đang giữ chỗ, chờ thanh toán; có `expiresAt`. */
  Reserved: "reserved",
  /** Đã ghi nhận thanh toán hợp lệ, đang phát hành vé. */
  Paid: "paid",
  /** Phát hành vé thành công. */
  Issued: "issued",
  /** Hết hạn giữ chỗ trước khi thanh toán; giữ chỗ đã giải phóng. */
  Expired: "expired",
  /** Thanh toán thất bại; giữ chỗ đã giải phóng. */
  PaymentFailed: "payment_failed",
  /** Thanh toán đến muộn / lặp / phát hành lỗi sau khi thu tiền → vận hành xử lý, hoàn tiền kỹ thuật. */
  Exception: "exception",
} as const;
export type OrderStatus = ValueOf<typeof OrderStatus>;

// ---------------------------------------------------------------------------
// Vé (PRODUCT_CONTEXT 3, 6)
// ---------------------------------------------------------------------------

/** Trạng thái vé phía ứng dụng (mục 6). Trạng thái on-chain định nghĩa cùng ABI ở Sprint 1. */
export const TicketStatus = {
  Active: "active",
  /** Đang trong phiên đấu giá: không xuất QR vào cổng. */
  Listed: "listed",
  /** Đang quyết toán đấu giá: không xuất QR vào cổng. */
  Settling: "settling",
  Used: "used",
  /** Sự kiện đã hủy, chờ hoàn tiền. */
  VoidPendingRefund: "void_pending_refund",
  Void: "void",
} as const;
export type TicketStatus = ValueOf<typeof TicketStatus>;

// ---------------------------------------------------------------------------
// Phiên đấu giá (PRODUCT_CONTEXT 4)
// ---------------------------------------------------------------------------

/**
 * ĐỀ XUẤT v0. Phần quyết toán (`settling` → `settled` | `settlement_failed`) phụ thuộc NFT-11 (TIC-17)
 * và D-004 (đang "Đề xuất") — chưa chốt, có thể đổi.
 */
export const AuctionStatus = {
  Open: "open",
  /** Đã chốt kết quả (có hoặc không có người thắng). */
  Closed: "closed",
  Settling: "settling",
  Settled: "settled",
  SettlementFailed: "settlement_failed",
  Cancelled: "cancelled",
} as const;
export type AuctionStatus = ValueOf<typeof AuctionStatus>;

/** Lý do đóng phiên (PRODUCT_CONTEXT 4 "Kết thúc phiên"). */
export const AuctionCloseReason = {
  CapReached: "cap_reached",
  /** Tới hạn người bán đặt (kể cả khi không có bid). Hai mốc bằng nhau ghi lý do này. */
  DeadlineReached: "deadline_reached",
  SilenceTimeout: "silence_timeout",
  /** Người bán hủy khi chưa có bid hợp lệ. */
  SellerCancelled: "seller_cancelled",
  /** Vận hành hủy (đã có bid, có lý do, ghi kiểm toán). */
  OperatorCancelled: "operator_cancelled",
  EventCancelled: "event_cancelled",
} as const;
export type AuctionCloseReason = ValueOf<typeof AuctionCloseReason>;

// ---------------------------------------------------------------------------
// Hoàn tiền (PRODUCT_CONTEXT 3.2–3.4, D-001)
// ---------------------------------------------------------------------------

export const RefundStatus = {
  Pending: "pending",
  Processing: "processing",
  Succeeded: "succeeded",
  Failed: "failed",
} as const;
export type RefundStatus = ValueOf<typeof RefundStatus>;

/** Chỉ hai lý do. Không có lý do "người dùng yêu cầu" (D-001). */
export const RefundReason = {
  EventCancelled: "event_cancelled",
  Technical: "technical",
} as const;
export type RefundReason = ValueOf<typeof RefundReason>;

// ---------------------------------------------------------------------------
// eKYC (PRODUCT_CONTEXT 5.5, D-006)
// ---------------------------------------------------------------------------

export const KycStatus = {
  NotStarted: "not_started",
  Pending: "pending",
  Verified: "verified",
  Rejected: "rejected",
  Revoked: "revoked",
} as const;
export type KycStatus = ValueOf<typeof KycStatus>;

export const KycReasonCode = {
  DocUnreadable: "DOC_UNREADABLE",
  DocExpired: "DOC_EXPIRED",
  DocNotSupported: "DOC_NOT_SUPPORTED",
  FaceMismatch: "FACE_MISMATCH",
  LivenessFailed: "LIVENESS_FAILED",
  DuplicateIdentity: "DUPLICATE_IDENTITY",
  /** Ngưỡng tuổi đang mở (DECISIONS "Đang mở"): tạm 18. */
  Underage: "UNDERAGE",
  /** Lỗi hệ thống, không tính vào số lần thử. */
  ProviderError: "PROVIDER_ERROR",
} as const;
export type KycReasonCode = ValueOf<typeof KycReasonCode>;

// ---------------------------------------------------------------------------
// Mã lỗi (PRODUCT_CONTEXT 5.7)
// ---------------------------------------------------------------------------

/**
 * Mã lý do khi chặn — đúng bảng PRODUCT_CONTEXT 5.7. Không thêm/bớt nếu không sửa PRODUCT_CONTEXT.
 */
export const BLOCKING_ERROR_CODES = {
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
} as const;
export type BlockingErrorCode = keyof typeof BLOCKING_ERROR_CODES;

/**
 * Mã lỗi chung — ĐỀ XUẤT, KHÔNG có trong bảng 5.7. Cần cho các tình huống 5.7 không phủ:
 * 404 ngoài phạm vi (2.3.2), validate đầu vào, OTP (5.1), giới hạn gửi (5.1), CSRF (5.1),
 * hết suất / hết giữ chỗ (3.1), chuyển trạng thái sai. Chờ BE + UI duyệt trong PR này;
 * nếu được chấp nhận, LEAD bổ sung vào PRODUCT_CONTEXT 5.7.
 */
export const GENERAL_ERROR_CODES = {
  VALIDATION_ERROR: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  /** OTP sai, hết hạn hoặc đã dùng — gộp một mã để không lộ thông tin. */
  OTP_INVALID: 400,
  CSRF_INVALID: 403,
  /** Tài nguyên không tồn tại hoặc ngoài phạm vi của người gọi (không lộ sự tồn tại). */
  NOT_FOUND: 404,
  SOLD_OUT: 409,
  RESERVATION_EXPIRED: 409,
  /** Thao tác không hợp lệ với trạng thái hiện tại (ví dụ xuất bản sự kiện không ở `draft`). */
  INVALID_STATE: 409,
  /** Cùng `Idempotency-Key` nhưng nội dung khác. */
  IDEMPOTENCY_CONFLICT: 409,
  /** Quá 5 lần OTP sai → khóa đăng nhập 15 phút (5.1). */
  OTP_LOCKED: 429,
  /** Vượt giới hạn gửi OTP / theo IP (5.1). */
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;
export type GeneralErrorCode = keyof typeof GENERAL_ERROR_CODES;

export const ERROR_HTTP_STATUS = { ...BLOCKING_ERROR_CODES, ...GENERAL_ERROR_CODES } as const;
export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;
export const ERROR_CODES = Object.keys(ERROR_HTTP_STATUS) as ErrorCode[];

/** Hành động gợi ý cho frontend (cột "Hướng dẫn" của 5.7). */
export const ErrorAction = {
  Login: "login",
  EnterTotp: "enter_totp",
  ContactSupport: "contact_support",
  VerifyPhone: "verify_phone",
  LinkWallet: "link_wallet",
  StartKyc: "start_kyc",
  WaitKyc: "wait_kyc",
  RetryKyc: "retry_kyc",
  None: "none",
} as const;
export type ErrorAction = ValueOf<typeof ErrorAction>;

export const DEFAULT_ERROR_ACTION: Record<BlockingErrorCode, ErrorAction> = {
  AUTH_REQUIRED: "login",
  MFA_REQUIRED: "enter_totp",
  ACCOUNT_LOCKED: "contact_support",
  PHONE_NOT_VERIFIED: "verify_phone",
  WALLET_NOT_LINKED: "link_wallet",
  KYC_REQUIRED: "start_kyc",
  KYC_PENDING: "wait_kyc",
  KYC_REJECTED: "retry_kyc",
  KYC_REVOKED: "contact_support",
  ROLE_FORBIDDEN: "none",
  ORGANIZER_CONFLICT: "none",
  PURCHASE_LIMIT_REACHED: "none",
  SALE_WINDOW_CLOSED: "none",
  EVENT_NOT_ACTIVE: "none",
};

/** Thân lỗi API: `{ code, message, action }` (PRODUCT_CONTEXT 5.7). `message` không chứa PII. */
export interface ApiError {
  code: ErrorCode;
  message: string;
  action?: ErrorAction;
  /** ID tương quan để tra log (PRODUCT_CONTEXT 6). */
  correlationId?: string;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_HTTP_STATUS, value);
}
