import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogAdmin } from '@/hooks/useCatalogAdmin';
import type { ProductFormData } from '@/types/admin';

const rpcMock = vi.fn();
const insertMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    rpc: rpcMock,
    from: (table: string) => ({
      insert: insertMock,
      select: () => ({ order: () => ({ order: () => ({}) }) }),
    }),
  }),
}));

function baseProduct(): ProductFormData {
  return {
    id: '1001',
    category: 'Футболки',
    name: 'Футболка базовая',
    sizes: [
      { size: 'S', quantity: 0, enabled: true },
      { size: 'M', quantity: 0, enabled: true },
    ],
    price: 10000,
    image1: 'https://example.com/1.jpg',
    image2: '',
    image3: '',
    image4: '',
    capsule: 'Синяя капсула',
    description: 'Описание',
    preorder: false,
    disabled: false,
  };
}

describe('useCatalogAdmin updateProduct RPC integration', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    insertMock.mockReset();
    rpcMock.mockResolvedValue({ data: { updated: 2, added: 0, deleted: 0 }, error: null });
    insertMock.mockResolvedValue({ error: null });
  });

  it('rename без изменения остатков отправляет increment=0', async () => {
    const { result } = renderHook(() => useCatalogAdmin());
    const product = baseProduct();
    product.name = 'Футболка базовая NEW';

    const ok = await act(async () => result.current.updateProduct(product));
    expect(ok).toBe(true);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const payload = rpcMock.mock.calls[0][1].p_rows as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(2);
    expect(payload[0].name).toBe('Футболка базовая NEW');
    expect(payload[0].quantity).toBe(0);
    expect(payload[0].set_quantity).toBe(false);
    expect(payload[1].quantity).toBe(0);
    expect(payload[1].set_quantity).toBe(false);
  });

  it('add stock (increment) отправляет положительный delta', async () => {
    const { result } = renderHook(() => useCatalogAdmin());
    const product = baseProduct();
    product.sizes = [
      { size: 'S', quantity: 5, enabled: true },
      { size: 'M', quantity: 2, enabled: true },
    ];

    const ok = await act(async () => result.current.updateProduct(product));
    expect(ok).toBe(true);

    const payload = rpcMock.mock.calls[0][1].p_rows as Array<Record<string, unknown>>;
    expect(payload.map((r) => [r.size, r.quantity, r.set_quantity])).toEqual([
      ['S', 5, false],
      ['M', 2, false],
    ]);
  });

  it('set stock (absolute) отправляет set_quantity=true', async () => {
    const { result } = renderHook(() => useCatalogAdmin());
    const product = baseProduct();
    product.sizes = [
      { size: 'S', quantity: 0, quantitySet: 12, enabled: true },
      { size: 'M', quantity: 3, enabled: true },
    ];

    const ok = await act(async () => result.current.updateProduct(product));
    expect(ok).toBe(true);

    const payload = rpcMock.mock.calls[0][1].p_rows as Array<Record<string, unknown>>;
    expect(payload.map((r) => [r.size, r.quantity, r.set_quantity])).toEqual([
      ['S', 12, true],
      ['M', 3, false],
    ]);
  });

  it('preorder + zero stock + selectable sizes проходит и сохраняет размеры', async () => {
    const { result } = renderHook(() => useCatalogAdmin());
    const product = baseProduct();
    product.preorder = true;
    product.sizes = [
      { size: 'S', quantity: 0, enabled: true },
      { size: 'M', quantity: 0, enabled: true },
      { size: 'L', quantity: 0, enabled: true },
    ];

    const ok = await act(async () => result.current.updateProduct(product));
    expect(ok).toBe(true);

    const payload = rpcMock.mock.calls[0][1].p_rows as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(3);
    expect(payload.every((r) => r.preorder === true)).toBe(true);
    expect(payload.map((r) => r.size)).toEqual(['S', 'M', 'L']);
  });
});
