import { useState } from 'react';
import { X, Minus, Plus, MessageCircle, Trash2 } from 'lucide-react';
import { CartItem } from '@/types/catalog';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createCustomerOrderRpc } from '@/lib/createCustomerOrder';
import { ORDER_CITIES } from '@/lib/orderCities';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, selectedSize: string, quantity: number) => void;
  onRemove: (id: string, selectedSize: string) => void;
  onClear: () => void;
  totalPrice: number;
  whatsappNumber?: string;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemove,
  onClear,
  totalPrice,
  whatsappNumber = '77775225374',
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ orderId: string; url: string } | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ₸';
  };

  const buildWhatsAppUrl = (orderId: string) => {
    const orderText = items
      .map(item => {
        const sizeText = item.selectedSize ? ` (${item.selectedSize})` : '';
        return `• ${item.name}${sizeText} x${item.quantity} — ${formatPrice(item.price * item.quantity)}`;
      })
      .join('\n');
    const clientBlock =
      `*Покупатель:* ${customerName.trim() || '—'}\n` +
      `*Телефон:* ${customerPhone.trim() || '—'}\n` +
      `*Город:* ${customerCity.trim() || '—'}\n\n`;
    const message =
      `*Новый заказ № ${orderId}*\n` +
      `*Номер:* ${orderId}\n\n` +
      `${clientBlock}${orderText}\n\n` +
      `*Итого: ${formatPrice(totalPrice)}*`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  };

  const finishCheckout = () => {
    setWhatsAppPrompt(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerCity('');
    onClear();
    onClose();
  };

  const openWhatsAppAndFinish = () => {
    if (!whatsAppPrompt) return;
    const url = whatsAppPrompt.url;
    finishCheckout();
    window.location.href = url;
  };

  const handleSheetOpenChange = (open: boolean) => {
    if (open) return;
    if (whatsAppPrompt) {
      finishCheckout();
      return;
    }
    onClose();
  };

  const createOrder = async () => {
    if (items.length === 0) return;
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const city = customerCity.trim();
    if (!name || !phone) {
      alert('Укажите имя и телефон покупателя.');
      return;
    }
    if (!city) {
      alert('Выберите город.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createCustomerOrderRpc(
        name,
        phone,
        city,
        items.map((item) => ({
          productId: item.id,
          productName: item.name,
          size: item.selectedSize,
          quantity: item.quantity,
          price: item.price,
        })),
      );
      const orderId = result.orderId || '—';
      setWhatsAppPrompt({ orderId, url: buildWhatsAppUrl(orderId) });
    } catch (e) {
      console.error('createOrder', e);
      alert(e instanceof Error ? e.message : 'Не удалось сохранить заказ. Проверьте подключение.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-primary text-foreground flex flex-col border-l border-white/20">
        <SheetHeader className="border-b border-white/20 pb-4">
          <SheetTitle className="text-foreground flex items-center justify-between">
            {whatsAppPrompt ? 'Отправьте заказ' : 'Корзина'}
            {!whatsAppPrompt && items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-foreground/60 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Очистить
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        {whatsAppPrompt ? (
          <div className="flex-1 flex flex-col justify-center gap-5 py-6">
            <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-500/15 p-4 space-y-3">
              <p className="text-lg font-bold text-emerald-300">
                Заказ № {whatsAppPrompt.orderId} сохранён
              </p>
              <p className="text-base font-semibold text-foreground leading-snug">
                Остался последний шаг — отправьте сообщение в WhatsApp.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-foreground/90">
                <li>Нажмите зелёную кнопку ниже — откроется WhatsApp</li>
                <li>
                  В WhatsApp нажмите <span className="font-bold">«Отправить»</span>
                </li>
              </ol>
              <p className="text-xs text-foreground/70">
                Без отправки в WhatsApp менеджер не увидит сообщение с заказом.
              </p>
            </div>

            <Button
              className="w-full min-h-[56px] gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-bold"
              size="lg"
              onClick={openWhatsAppAndFinish}
            >
              <MessageCircle className="h-6 w-6" />
              Открыть WhatsApp и отправить
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-foreground/50">
                  <p>Корзина пуста</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={`${item.id}-${item.selectedSize}`} className="flex gap-3">
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.name}</h4>
                        {item.selectedSize && (
                          <p className="text-xs text-foreground/60">Размер: {item.selectedSize}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium text-foreground">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={
                                item.stockBySize?.[item.selectedSize] !== undefined &&
                                item.quantity >= item.stockBySize[item.selectedSize]
                              }
                              onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => onRemove(item.id, item.selectedSize)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-white/20 pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-foreground/80">Имя</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-md border border-white/30 bg-white/10 px-3 py-2 text-sm text-foreground placeholder:text-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="Как к вам обращаться"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-foreground/80">Телефон</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onFocus={() => {
                        setCustomerPhone(prev => (prev.trim().length === 0 ? '+7 ' : prev));
                      }}
                      onClick={() => {
                        setCustomerPhone(prev => (prev.trim().length === 0 ? '+7 ' : prev));
                      }}
                      className="w-full rounded-md border border-white/30 bg-white/10 px-3 py-2 text-sm text-foreground placeholder:text-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="+7 ..."
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-foreground/80">Город</label>
                    <select
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      className="w-full rounded-md border border-white/30 bg-white/10 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Выберите город</option>
                      {ORDER_CITIES.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-lg font-bold text-foreground">
                  <span>Итого:</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>

                <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 px-3 py-2.5 text-sm text-amber-100 leading-snug">
                  После оформления откроется WhatsApp с текстом заказа.
                  <span className="font-bold"> Обязательно нажмите «Отправить»</span> в WhatsApp.
                </div>

                <Button
                  className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                  size="lg"
                  onClick={createOrder}
                  disabled={isSubmitting}
                >
                  <MessageCircle className="h-5 w-5" />
                  {isSubmitting ? 'Сохраняем заказ...' : 'Оформить → отправить в WhatsApp'}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
