/** Use for approved, partially masked views. Request logs omit these fields. */
export function maskPii(value: string, kind: "email" | "phone" | "secret" = "secret"): string {
  if (kind === "email" && /^[a-zA-Z0-9][^\s@]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
    return `${value[0]}***${value.slice(value.lastIndexOf("@"))}`;
  }
  if (kind === "phone" && /^\+?\d{9,15}$/.test(value)) {
    const digits = value.replace(/^\+/, "");
    return `${digits.slice(0, 2)}****${digits.slice(-3)}`;
  }
  return "[REDACTED]";
}
