import { getSupabase } from '@/lib/supabase';
import { isOrderCity } from '@/lib/orderCities';

export interface CreateOrderLine {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  price: number;
}

function parseRpcPayload(data: unknown): { result?: string; error?: string; orderId?: string } {
  let row: unknown = data;
  if (typeof row === 'string') {
    try {
      row = JSON.parse(row);
    } catch {
      return {};
    }
  }
  if (Array.isArray(row)) row = row[0];
  if (!row || typeof row !== 'object') return {};
  const r = row as Record<string, unknown>;
  const orderId = r.orderId ?? r.order_id;
  return {
    result: r.result != null ? String(r.result) : undefined,
    error: r.error != null ? String(r.error) : undefined,
    orderId: orderId != null && String(orderId).trim() ? String(orderId).trim() : undefined,
  };
}

export async function createCustomerOrderRpc(
  customerName: string,
  customerPhone: string,
  customerCity: string,
  items: CreateOrderLine[],
) {
  if (!isOrderCity(customerCity.trim())) {
    throw new Error('Выберите город: Уральск, Алматы или Астана');
  }

  const sb = getSupabase();
  const { data, error } = await sb.rpc('create_customer_order', {
    p_customer_name: customerName.trim(),
    p_customer_phone: customerPhone.trim(),
    p_customer_city: customerCity.trim(),
    p_items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    })),
  });

  if (error) throw error;

  const row = parseRpcPayload(data);
  if (row.result !== 'success') {
    throw new Error(row.error || 'Не удалось создать заказ');
  }
  if (!row.orderId) {
    throw new Error('Заказ создан, но номер не получен. Обновите страницу и попробуйте снова.');
  }
  return { result: 'success' as const, orderId: row.orderId };
}
