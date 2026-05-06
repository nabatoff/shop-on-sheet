/** Строка даты как в RPC create_customer_order (UTC). */
export function formatUtcOrderDisplay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** Формат как в Google Apps Script / RPC create_customer_order (UTC). */
export function generateOrderIdUtc(customerPhone: string): string {
  const digits = customerPhone.replace(/\D/g, '');
  const suffix =
    digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, '0').slice(-4);
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `${ts}-${suffix}`;
}
