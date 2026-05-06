import { getSupabase } from '@/lib/supabase';

export interface CreateOrderLine {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  price: number;
}

export async function createCustomerOrderRpc(customerName: string, customerPhone: string, items: CreateOrderLine[]) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('create_customer_order', {
    p_customer_name: customerName.trim(),
    p_customer_phone: customerPhone.trim(),
    p_items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    })),
  });

  if (error) throw error;

  const row = data as { result?: string; error?: string; orderId?: string };
  if (row?.result !== 'success') {
    throw new Error(row?.error || 'Не удалось создать заказ');
  }
  return row;
}
