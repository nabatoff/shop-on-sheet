/** Устаревший клиентский генератор — номера заказов теперь из RPC (1, 2, 3…). */
export function formatUtcOrderDisplay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** @deprecated Номер выдаёт generate_order_id в БД (sequence). */
export function generateOrderIdUtc(_customerPhone: string): string {
  return '';
}
