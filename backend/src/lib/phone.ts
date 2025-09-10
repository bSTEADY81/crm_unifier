export function normalizePhoneE164(input: string): string {
  const s = String(input || "").trim();
  if (!s) return s;
  // keep leading +, strip other non-digits
  const kept = s.startsWith("+")
    ? "+" + s.slice(1).replace(/[^\d]/g, "")
    : s.replace(/[^\d]/g, "");
  return kept;
}