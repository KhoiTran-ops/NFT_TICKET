import { isIP } from "node:net";
import nodemailer from "nodemailer";

export function authConfig(env: NodeJS.ProcessEnv) {
  const { JWT_SECRET, OTP_PEPPER, FIELD_ENCRYPTION_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, OTP_FROM } = env;
  // Auth is mandatory: a missing or partial configuration stops startup instead of serving without login.
  const key = /^[0-9a-f]{64}$/i;
  const port = Number(SMTP_PORT || "587");
  if (!JWT_SECRET || !OTP_PEPPER || !key.test(JWT_SECRET) || !key.test(OTP_PEPPER)
    || !FIELD_ENCRYPTION_KEY || !key.test(FIELD_ENCRYPTION_KEY)
    || new Set([JWT_SECRET, OTP_PEPPER, FIELD_ENCRYPTION_KEY].map((value) => value.toLowerCase())).size !== 3
    || !SMTP_HOST || !(isIP(SMTP_HOST) || /^[a-z0-9.-]{1,253}$/i.test(SMTP_HOST))
    || !Number.isInteger(port) || port < 1 || port > 65535 || !OTP_FROM || /[\r\n]/.test(OTP_FROM)
    || Boolean(SMTP_USER) !== Boolean(SMTP_PASSWORD)) {
    throw new Error("Invalid auth configuration");
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
    auth: SMTP_USER && SMTP_PASSWORD ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 10_000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return {
    jwtSecret: Buffer.from(JWT_SECRET, "hex"), otpPepper: Buffer.from(OTP_PEPPER, "hex"),
    fieldKey: Buffer.from(FIELD_ENCRYPTION_KEY, "hex"),
    async deliver(email: string, code: string) {
      const sent = await transport.sendMail({
        from: OTP_FROM, to: { name: "", address: email }, subject: "Mã đăng nhập Vé Lại",
        text: `Mã đăng nhập của bạn là ${code}. Mã hết hạn sau 5 phút.`,
      });
      if (sent.accepted.length !== 1) throw new Error("OTP delivery failed");
    },
  };
}
