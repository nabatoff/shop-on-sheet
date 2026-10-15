const CODE_LENGTH = 3;

/** Название целиком: только буквы и цифры, заглавными (Свитшоты → СВИТШОТЫ). */
function fullCode(name: string): string {
  return (name || '').replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
}

/** Код из названия: первые 3 буквы/цифры заглавными (Свитшоты → СВИ). */
function nameCode(name: string): string {
  return (name || '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, CODE_LENGTH)
    .toUpperCase();
}

/**
 * Артикул = ID + КАТЕГОРИЯ (полностью) + КАПСУЛА (3 буквы) + РАЗМЕР без разделителей, например 1СВИТШОТЫБЕЛL.
 * Для товара без размера артикул один, без суффикса размера.
 */
export function buildSku(
  product: { id: string; category?: string; capsule?: string },
  size?: string
): string {
  const sizePart = (size || '').replace(/\s+/g, '').toUpperCase();
  const idPart = String(product.id).replace(/\s+/g, '');
  return idPart + fullCode(product.category || '') + nameCode(product.capsule || '') + sizePart;
}

/** Сохранённый в БД артикул; если его ещё нет (старые данные) — вычисляем. */
export function getSku(
  product: { id: string; category?: string; capsule?: string; skuBySize?: Record<string, string> },
  size?: string
): string {
  return product.skuBySize?.[size || ''] || buildSku(product, size);
}
