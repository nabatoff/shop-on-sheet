import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingCart, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase';
import type { Product } from '@/types/catalog';

interface OrderItem {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  price: number;
}

interface Order {
  orderId: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  status: string;
  items: OrderItem[];
  total: number;
}

interface OrderManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

const ORDER_STATUSES = ['Новый', 'В работе', 'Выполнен'] as const;

const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function mapRowsToOrders(rows: Record<string, unknown>[]): Order[] {
  return rows.map((row) => {
    const rawItems = (row.order_items as Record<string, unknown>[] | null) || [];
    const items: OrderItem[] = rawItems.map((i) => ({
      productId: String(i.product_id ?? ''),
      productName: String(i.product_name ?? ''),
      size: String(i.size ?? ''),
      quantity: Number(i.quantity) || 0,
      price: Number(i.price) || 0,
    }));
    return {
      orderId: String(row.order_id ?? ''),
      createdAt: String(row.created_at_display || row.created_at || ''),
      customerName: String(row.customer_name ?? ''),
      customerPhone: String(row.customer_phone ?? ''),
      status: String(row.status ?? ''),
      total: Number(row.total) || 0,
      items,
    };
  });
}

function formatOrderDateRu(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const s = dateStr.trim();
  let date: Date;
  const dmys = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (dmys) {
    date = new Date(
      parseInt(dmys[3], 10),
      parseInt(dmys[2], 10) - 1,
      parseInt(dmys[1], 10),
      parseInt(dmys[4], 10),
      parseInt(dmys[5], 10),
      parseInt(dmys[6] || '0', 10)
    );
  } else {
    date = new Date(s);
  }
  if (isNaN(date.getTime())) return dateStr;
  const wd = WEEKDAYS_RU[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_RU[date.getMonth()];
  const year = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  return `${wd}, ${day} ${month} ${year}, ${h}:${m}:${sec}`;
}

export function OrderManager({ open, onOpenChange, products }: OrderManagerProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualItems, setManualItems] = useState<OrderItem[]>([
    { productId: '', productName: '', size: '', quantity: 1, price: 0 },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const productOptions = useMemo(
    () =>
      products
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .map(p => ({
          id: p.id,
          label: `${p.id} — ${p.name}`,
          preview: p.images?.[0],
          price: p.price,
        })),
    [products],
  );

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('orders')
        .select(
          `
          order_id,
          created_at,
          created_at_display,
          customer_name,
          customer_phone,
          status,
          total,
          order_items ( product_id, product_name, size, quantity, price )
        `,
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        toast({
          title: 'Ошибка',
          description: error.message || 'Не удалось загрузить заказы',
          variant: 'destructive',
        });
        setOrders([]);
        return;
      }

      setOrders(mapRowsToOrders((data || []) as Record<string, unknown>[]));
    } catch (e) {
      console.error('Ошибка запроса заказов', e);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить заказы',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadOrders();
    }
  }, [open, loadOrders]);

  const handleStatusChange = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      const sb = getSupabase();
      const { error } = await sb.from('orders').update({ status }).eq('order_id', orderId);
      if (error) {
        toast({
          title: 'Ошибка',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
      setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status } : o)));
      toast({
        title: 'Статус обновлён',
        description: `Заказ ${orderId} теперь: ${status}`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить статус заказа',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleManualItemChange = (index: number, field: keyof OrderItem, value: string) => {
    setManualItems(prev => {
      const next = [...prev];
      const item = { ...next[index] };
      if (field === 'quantity' || field === 'price') {
        // числовые поля
        const num = Number(value.replace(',', '.'));
        (item as any)[field] = isNaN(num) ? 0 : num;
      } else {
        (item as any)[field] = value;
      }
      next[index] = item;
      return next;
    });
  };

  const addManualItemRow = () => {
    setManualItems(prev => [...prev, { productId: '', productName: '', size: '', quantity: 1, price: 0 }]);
  };

  const handleCreateManualOrder = async () => {
    const name = manualName.trim();
    const phone = manualPhone.trim();
    const phoneDigits = (phone || '').replace(/\D/g, '');
    if (!name) {
      toast({
        title: 'Обязательное поле',
        description: 'Укажите имя клиента',
        variant: 'destructive',
      });
      return;
    }
    if (!phone || phoneDigits.length < 10) {
      toast({
        title: 'Обязательное поле',
        description: 'Укажите номер телефона (минимум 10 цифр)',
        variant: 'destructive',
      });
      return;
    }

    const items = manualItems
      .map((it) => ({
        ...it,
        productId: it.productId.trim(),
        productName: it.productName.trim(),
        size: it.size.trim(),
      }))
      .filter((it) => it.productId && it.productName && it.size && it.quantity > 0);

    if (items.length === 0) {
      toast({
        title: 'Нет позиций',
        description: 'Добавьте хотя бы одну позицию с ID, названием, размером и количеством',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const sb = getSupabase();
      const { data, error } = await sb.rpc('create_manual_order', {
        p_customer_name: name,
        p_customer_phone: phone,
        p_items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          size: it.size,
          quantity: it.quantity,
          price: it.price,
        })),
      });
      if (error) throw error;
      const row = (data || {}) as { result?: string; error?: string; orderId?: string };
      if (row.result !== 'success') {
        throw new Error(row.error || 'Не удалось создать заказ');
      }

      toast({
        title: 'Заказ создан',
        description: `OrderId: ${row.orderId || '—'}`,
      });
      setManualName('');
      setManualPhone('');
      setManualItems([{ productId: '', productName: '', size: '', quantity: 1, price: 0 }]);
      await loadOrders();
    } catch (e) {
      console.error('Ошибка создания заказа (ручной)', e);
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось создать заказ',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Удалить заказ #' + orderId + '? Это действие нельзя отменить.')) return;
    setDeletingId(orderId);
    try {
      const sb = getSupabase();
      const { error } = await sb.from('orders').delete().eq('order_id', orderId);
      if (error) {
        toast({
          title: 'Ошибка',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
      setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      toast({ title: 'Заказ удалён', description: `#${orderId}` });
    } catch (e) {
      console.error('Ошибка deleteOrder', e);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить заказ',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'Выполнен') {
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Выполнен</Badge>;
    }
    if (status === 'Отмена') {
      return <Badge className="bg-gray-200 text-gray-700 hover:bg-gray-200">Отмена</Badge>;
    }
    if (status === 'В работе') {
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">В работе</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Новый</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-hidden bg-white p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <ShoppingCart className="h-5 w-5 text-indigo-600" />
            Заказы
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1.4fr] gap-6 flex-1 min-h-0">
          {/* Список заказов */}
          <div className="flex flex-col min-h-0 border border-gray-200 rounded-lg overflow-hidden bg-gray-50/60">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">Все заказы</span>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                  {orders.length}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadOrders}
                disabled={isLoading}
                className="bg-white border-2 border-gray-400 text-gray-900 hover:bg-gray-100 hover:text-gray-900"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Loader2 className="h-4 w-4" />
                )}
                <span className="ml-2 font-medium">Обновить заказы</span>
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              {isLoading && orders.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Загрузка заказов...
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-center px-4">
                  <ShoppingCart className="h-10 w-10 mb-2" />
                  <div>Заказов пока нет</div>
                  <div className="text-[11px] text-gray-400 mt-2 max-w-xs">
                    Заказы хранятся в Supabase (таблицы orders и order_items).
                  </div>
                </div>
              ) : (
                orders
                  .slice()
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                  .map(order => (
                    <div
                      key={order.orderId}
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="space-y-1">
                          <div className="text-xs font-mono text-gray-500">
                            #{order.orderId}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatOrderDateRu(order.createdAt)}
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {order.customerName || 'Без имени'}
                          </div>
                          <div className="text-xs text-gray-600">
                            {order.customerPhone}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {renderStatusBadge(order.status)}
                            {order.status !== 'Выполнен' && order.status !== 'Отмена' && (
                              <select
                                className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={order.status}
                                onChange={e => handleStatusChange(order.orderId, e.target.value)}
                                disabled={updatingId === order.orderId}
                              >
                                {ORDER_STATUSES.map(st => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            )}
                            {order.status === 'Выполнен' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(order.orderId, 'Отмена')}
                                disabled={updatingId === order.orderId}
                                className="text-xs font-medium border-2 border-gray-500 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900"
                              >
                                {updatingId === order.orderId && (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                )}
                                Отмена заказа
                              </Button>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            Сумма: {order.total || 0} ₸
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteOrder(order.orderId)}
                            disabled={deletingId === order.orderId}
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            title="Удалить заказ"
                            aria-label={`Удалить заказ ${order.orderId}`}
                          >
                            {deletingId === order.orderId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-3 mt-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                          Позиции
                        </div>
                        <div className="space-y-2">
                          {order.items.map((item, idx) => {
                            const product = products.find(p => p.id === item.productId);
                            const thumb = product?.images?.[0];
                            return (
                              <div
                                key={`${item.productId}-${item.size}-${idx}`}
                                className="flex items-center gap-2 text-xs text-gray-700"
                              >
                                <div className="flex-shrink-0 w-10 h-10 rounded-md border border-gray-200 overflow-hidden bg-gray-100">
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                      <ShoppingCart className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    {item.productName || item.productId}
                                  </div>
                                  <div className="text-gray-500">
                                    ID: {item.productId} • Размер: {item.size || '—'}
                                  </div>
                                </div>
                                <div className="text-right pl-2 flex-shrink-0">
                                  <div>
                                    x{item.quantity} × {item.price} ₸
                                  </div>
                                  <div className="font-semibold">
                                    {item.quantity * item.price} ₸
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Ручное создание заказа */}
          <div className="flex flex-col min-h-0 border border-gray-200 rounded-lg bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold text-gray-900">
                  Добавить заказ вручную
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-700">Имя клиента <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={manualName}
                  onChange={e => {
                    const v = e.target.value;
                    if (!v) setManualName('');
                    else setManualName(v.charAt(0).toUpperCase() + v.slice(1));
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Как к клиенту обращаться"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-700">Телефон клиента <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={manualPhone}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (raw === '') {
                      setManualPhone('+7');
                      return;
                    }
                    if (raw.startsWith('8')) setManualPhone('+7' + raw.slice(1, 11));
                    else if (raw.startsWith('7')) setManualPhone('+' + raw.slice(0, 11));
                    else setManualPhone('+7' + raw.slice(0, 10));
                  }}
                  onFocus={e => { if (!manualPhone || manualPhone === '') setManualPhone('+7'); }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="+7 ..."
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50/60">
              {manualItems.map((item, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-md p-2 space-y-2"
                >
                  {/* Выбор товара с превью */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-700">Товар</label>
                    <div className="flex items-start gap-2">
                      <select
                        value={item.productId}
                        onChange={e => {
                          const newId = e.target.value;
                          const selected = productOptions.find(p => p.id === newId);
                          setManualItems(prev => {
                            const next = [...prev];
                            const updated = { ...next[index] };
                            updated.productId = newId;
                            updated.productName = selected?.label ?? '';
                            if (selected && (!updated.price || updated.price === 0)) {
                              updated.price = selected.price ?? 0;
                            }
                            next[index] = updated;
                            return next;
                          });
                        }}
                        className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Выберите товар…</option>
                        {productOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const selected = productOptions.find(p => p.id === item.productId);
                        if (!selected?.preview) return null;
                        return (
                          <img
                            src={selected.preview}
                            alt={selected.label}
                            className="w-10 h-10 rounded-md object-cover border border-gray-200 flex-shrink-0"
                          />
                        );
                      })()}
                    </div>
                  </div>

                  {/* Размер + количество + цена в одной строке */}
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_80px_80px] gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-700">Размер</label>
                      {(() => {
                        const product = products.find(p => p.id === item.productId);
                        const sizes = product?.sizes ?? [];
                        if (sizes.length > 0) {
                          return (
                            <>
                              <select
                                value={item.size}
                                onChange={e =>
                                  handleManualItemChange(index, 'size', e.target.value)
                                }
                                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">Выберите размер…</option>
                                {sizes.map(s => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                Доступные размеры: {sizes.join(', ')}
                              </div>
                              {item.size && (
                                <div className="text-[10px] font-medium text-emerald-600 mt-0.5">
                                  В наличии: {product?.stockBySize?.[item.size] ?? 0} шт.
                                </div>
                              )}
                            </>
                          );
                        }
                        // Фоллбек: ручной ввод, если в товаре нет списка размеров (товар без размера)
                        return (
                          <>
                            <input
                              type="text"
                              value={item.size}
                              onChange={e =>
                                handleManualItemChange(index, 'size', e.target.value)
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Напр. M или оставьте пустым"
                            />
                            <div className="text-[10px] font-medium text-emerald-600 mt-0.5">
                              В наличии: {product?.stock ?? 0} шт.
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-700">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e =>
                          handleManualItemChange(index, 'quantity', e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-700">Цена</label>
                      <input
                        type="number"
                        min={0}
                        value={item.price}
                        onChange={e =>
                          handleManualItemChange(index, 'price', e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addManualItemRow}
                  className="w-full bg-white border-2 border-gray-400 text-gray-900 hover:bg-gray-100 hover:text-gray-900 font-medium"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Добавить ещё позицию
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setManualName('');
                  setManualPhone('');
                  setManualItems([{ productId: '', productName: '', size: '', quantity: 1, price: 0 }]);
                }}
              >
                Очистить форму
              </Button>
              <Button
                size="sm"
                onClick={handleCreateManualOrder}
                disabled={isCreating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PlusCircle className="h-4 w-4 mr-2" />
                )}
                Создать заказ
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

