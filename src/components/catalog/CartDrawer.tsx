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
  whatsappNumber = '77001234567',
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ₸';
  };

  const sendToWhatsApp = () => {
    const orderText = items
      .map(item => {
        const sizeText = item.selectedSize ? ` (${item.selectedSize})` : '';
        return `• ${item.name}${sizeText} x${item.quantity} — ${formatPrice(item.price * item.quantity)}`;
      })
      .join('\n');
    const clientBlock = (customerName.trim() || customerPhone.trim())
      ? `*Клиент:* ${customerName.trim() || '—'}\n*Телефон:* ${customerPhone.trim() || '—'}\n\n`
      : '';
    const message = `🛒 *Новый заказ*\n\n${clientBlock}${orderText}\n\n*Итого: ${formatPrice(totalPrice)}*`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const createOrder = async () => {
    if (items.length === 0) return;
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name || !phone) {
      alert('Укажите имя и телефон покупателя.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createCustomerOrderRpc(
        name,
        phone,
        items.map((item) => ({
          productId: item.id,
          productName: item.name,
          size: item.selectedSize,
          quantity: item.quantity,
          price: item.price,
        })),
      );
      sendToWhatsApp();
      onClear();
      onClose();
    } catch (e) {
      console.error('createOrder', e);
      alert(e instanceof Error ? e.message : 'Не удалось сохранить заказ. Проверьте подключение.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md bg-primary text-foreground flex flex-col border-l border-white/20">
        <SheetHeader className="border-b border-white/20 pb-4">
          <SheetTitle className="text-foreground flex items-center justify-between">
            Корзина
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-foreground/70 hover:text-red-400 hover:bg-white/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Очистить
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-foreground/70">
              <p className="text-lg">Корзина пуста</p>
              <p className="text-sm mt-1">Добавьте товары из каталога</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div 
                  key={`${item.id}-${item.selectedSize}`} 
                  className="flex gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <img
                    src={item.images[0]}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-md"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{item.name}</h4>
                    {item.selectedSize && (
                      <p className="text-xs text-foreground/80">Размер: {item.selectedSize}</p>
                    )}
                    <p className="text-sm text-foreground/90 font-medium mt-1">{formatPrice(item.price)}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-7 sm:w-7 sm:min-h-0 sm:min-w-0 border-white/30 bg-white/10 hover:bg-white/20 text-foreground touch-manipulation"
                        onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity - 1)}
                        aria-label="Уменьшить количество"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium text-foreground">{item.quantity}</span>
                      {(() => {
                        const maxStock = item.stockBySize?.[item.selectedSize];
                        const atLimit = maxStock !== undefined && item.quantity >= maxStock;
                        return (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-7 sm:w-7 sm:min-h-0 sm:min-w-0 border-white/30 bg-white/10 hover:bg-white/20 text-foreground disabled:opacity-50 touch-manipulation"
                            onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity + 1)}
                            disabled={atLimit}
                            aria-label="Увеличить количество"
                            title={atLimit ? `В наличии: ${maxStock} шт.` : undefined}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        );
                      })()}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-7 sm:w-7 sm:min-h-0 sm:min-w-0 ml-auto text-foreground/70 hover:text-red-400 hover:bg-white/10 touch-manipulation"
                        onClick={() => onRemove(item.id, item.selectedSize)}
                        aria-label="Удалить из корзины"
                      >
                        <X className="h-4 w-4" />
                      </Button>
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
            </div>

            <div className="flex items-center justify-between text-lg font-bold text-foreground">
              <span>Итого:</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>
            
            <Button
              className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
              size="lg"
              onClick={createOrder}
              disabled={isSubmitting}
            >
              <MessageCircle className="h-5 w-5" />
              {isSubmitting ? 'Оформляем заказ...' : 'Оформить заказ в WhatsApp'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
