import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCatalog } from '@/hooks/useCatalog';
import { useCart } from '@/hooks/useCart';
import { useDebounce } from '@/hooks/useDebounce';
import { CartItem } from '@/types/catalog';
import { ScrollToTop } from '@/components/catalog/ScrollToTop';
import { Skeleton } from '@/components/ui/skeleton';
import { Product, BannerSlide } from '@/types/catalog';
import { ShoppingCart, Search, X, Plus, Minus, ChevronLeft, ChevronRight, Filter, Package, Menu, Home, Info, Phone, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import logoWhite from '@/assets/logo-white.png';
import { RotatingBadge } from '@/components/catalog/RotatingBadge';
import { AltLoadingScreen } from '@/components/catalog/AltLoadingScreen';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MenuContainer, MenuItem } from '@/components/ui/fluid-menu';
import { createCustomerOrderRpc } from '@/lib/createCustomerOrder';
import { ImageLightbox } from '@/components/catalog/ImageLightbox';

const BRAND_COLOR = '#0047BB';
const WHATSAPP_PHONE = '77001234567'; // номер без +

// ============================================
// КАСТОМНАЯ КОРЗИНА
// ============================================
function AltCartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemove,
  onClear,
  totalPrice,
  whatsappNumber = '77001234567',
}: {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, selectedSize: string, quantity: number) => void;
  onRemove: (id: string, selectedSize: string) => void;
  onClear: () => void;
  totalPrice: number;
  whatsappNumber?: string;
}) {
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
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
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
      <SheetContent className="w-full sm:max-w-md bg-white flex flex-col">
        <SheetHeader className="border-b border-gray-200 pb-4">
          <SheetTitle className="text-gray-900 flex items-center justify-between">
            <span style={{ color: BRAND_COLOR }}>Корзина</span>
            {items.length > 0 && (
              <button
                onClick={onClear}
                className="text-sm text-gray-500 hover:text-red-500 transition-colors"
              >
                Очистить
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium text-gray-500">Корзина пуста</p>
              <p className="text-sm text-gray-400 mt-1">Добавьте товары из каталога</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div 
                  key={`${item.id}-${item.selectedSize}`} 
                  className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <img
                    src={item.images[0]}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{item.name}</h4>
                    {item.selectedSize && (
                      <p className="text-xs text-gray-500 mt-0.5">Размер: {item.selectedSize}</p>
                    )}
                    <p 
                      className="text-sm font-bold mt-1"
                      style={{ color: BRAND_COLOR }}
                    >
                      {formatPrice(item.price)}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity - 1)}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="w-8 text-center font-semibold text-gray-900">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.selectedSize, item.quantity + 1)}
                        disabled={item.stockBySize?.[item.selectedSize] !== undefined && item.quantity >= item.stockBySize[item.selectedSize]}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => onRemove(item.id, item.selectedSize)}
                        className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-700">Имя</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Как к вам обращаться"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-700">Телефон</label>
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
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+7 ..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Итого:</span>
              <span 
                className="text-2xl font-bold"
                style={{ color: BRAND_COLOR }}
              >
                {formatPrice(totalPrice)}
              </span>
            </div>
            
            <button
              onClick={createOrder}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#25D366' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {isSubmitting ? 'Оформляем заказ...' : 'Оформить заказ в WhatsApp'}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// HEADER с Fluid Menu
// ============================================
function AltHeader({ 
  cartCount, 
  onCartClick,
}: { 
  cartCount: number; 
  onCartClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="container px-4 h-16 flex items-center justify-between">
        {/* Меню и слоган слева */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <MenuContainer>
              <MenuItem icon={<Menu className="w-6 h-6" style={{ color: BRAND_COLOR }} />} />
              <MenuItem 
                icon={<Home className="w-5 h-5" style={{ color: BRAND_COLOR }} />} 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              />
              <MenuItem 
                icon={<Info className="w-5 h-5" style={{ color: BRAND_COLOR }} />}
                onClick={() => {}}
              />
              <MenuItem 
                icon={<Phone className="w-5 h-5" style={{ color: BRAND_COLOR }} />}
                onClick={() => {}}
              />
            </MenuContainer>
          </div>
          <span 
            className="text-base sm:text-lg font-bold tracking-wide"
            style={{ 
              color: BRAND_COLOR,
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic',
            }}
          >
            стиль, который объединяет
          </span>
        </div>
        
        {/* Корзина */}
        <button
          onClick={onCartClick}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100"
          style={{ color: BRAND_COLOR }}
        >
          <ShoppingCart className="w-6 h-6" />
          {cartCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

// ============================================
// HERO SECTION с баннером
// ============================================
function AltHeroSection({ 
  title, 
  subtitle,
  bannerSlides,
}: { 
  title: string; 
  subtitle: string;
  bannerSlides?: BannerSlide[];
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = bannerSlides?.filter(s => s.image) || [];
  
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative">
      {/* Баннер */}
      {slides.length > 0 ? (
        <div className="relative h-[280px] sm:h-[380px] md:h-[480px] lg:h-[550px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentSlide}
              src={slides[currentSlide].image}
              alt={`Баннер ${currentSlide + 1}`}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="w-full h-full object-cover"
            />
          </AnimatePresence>
          
          {/* Overlay с градиентом */}
          <div 
            className="absolute inset-0"
            style={{ 
              background: `linear-gradient(to right, ${BRAND_COLOR}ee 0%, ${BRAND_COLOR}99 30%, transparent 70%)` 
            }}
          />
          
          {/* Контент поверх баннера */}
          <div className="absolute inset-0 flex items-center">
            <div className="container px-4">
              <div className="max-w-lg">
                <motion.img 
                  src={logoWhite} 
                  alt="Logo" 
                  className="h-14 md:h-20 w-auto mb-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                />
                <motion.h1 
                  className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  {title}
                </motion.h1>
                <motion.p 
                  className="mt-3 text-white/80 text-base md:text-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  {subtitle}
                </motion.p>
              </div>
            </div>
          </div>
          
          {/* Rotating Badge справа */}
          <div className="absolute right-4 md:right-8 lg:right-12 top-1/2 -translate-y-1/2 hidden sm:block z-10">
            <RotatingBadge color={BRAND_COLOR} />
          </div>
          
          {/* Навигация слайдов */}
          {slides.length > 1 && (
            <>
              <button
                onClick={() => setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setCurrentSlide(prev => (prev + 1) % slides.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === currentSlide ? 'w-8 bg-white' : 'w-1.5 bg-white/50'
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        // Fallback без баннера
        <div 
          className="relative py-16 md:py-24"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          <div className="container px-4">
            <img src={logoWhite} alt="Logo" className="h-14 md:h-20 w-auto mb-4" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
              {title}
            </h1>
            <p className="mt-3 text-white/80 text-base md:text-lg max-w-lg">
              {subtitle}
            </p>
          </div>
          
          {/* Rotating Badge справа */}
          <div className="absolute right-4 md:right-8 lg:right-12 top-1/2 -translate-y-1/2 hidden sm:block">
            <RotatingBadge color={BRAND_COLOR} />
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================
// ЕДИНАЯ ПАНЕЛЬ ФИЛЬТРОВ
// ============================================
function FiltersBar({
  searchQuery,
  onSearchChange,
  capsules,
  selectedCapsule,
  onCapsuleChange,
  categories,
  selectedCategory,
  onCategoryChange,
  sizes,
  selectedSize,
  onSizeChange,
  totalProducts,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  capsules: { id: string; name: string }[];
  selectedCapsule: string | null;
  onCapsuleChange: (c: string | null) => void;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (c: string | null) => void;
  sizes: string[];
  selectedSize: string | null;
  onSizeChange: (s: string | null) => void;
  totalProducts: number;
}) {
  const hasFilters = Boolean(selectedCapsule || selectedCategory || selectedSize);
  const filterCount = (selectedCapsule ? 1 : 0) + (selectedCategory ? 1 : 0) + (selectedSize ? 1 : 0);
  
  return (
    <div className="sticky top-16 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="container px-4 py-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Поиск */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Найти товар..."
              className="w-full h-10 pl-10 pr-10 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all text-sm"
              style={{ '--tw-ring-color': BRAND_COLOR } as React.CSSProperties}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
          
          {/* Десктоп фильтры */}
          <div className="hidden lg:flex items-center gap-2">
            {/* Капсула */}
            <Select
              value={selectedCapsule || 'all'}
              onValueChange={(v) => onCapsuleChange(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-40 h-10 bg-white border-gray-300 text-sm text-gray-900">
                <SelectValue placeholder="Коллекция" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все коллекции</SelectItem>
                {capsules.map(cap => (
                  <SelectItem key={cap.id} value={cap.id}>{cap.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Категория */}
            <Select
              value={selectedCategory || 'all'}
              onValueChange={(v) => onCategoryChange(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-40 h-10 bg-white border-gray-300 text-sm text-gray-900">
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Размер */}
            <Select
              value={selectedSize || 'all'}
              onValueChange={(v) => onSizeChange(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-32 h-10 bg-white border-gray-300 text-sm text-gray-900">
                <SelectValue placeholder="Размер" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все размеры</SelectItem>
                {sizes.map(size => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Счётчик */}
            <span className="text-sm text-gray-500 ml-2 whitespace-nowrap">
              {totalProducts} {totalProducts === 1 ? 'товар' : totalProducts < 5 ? 'товара' : 'товаров'}
            </span>
          </div>
          
          {/* Мобильные фильтры */}
          <div className="flex lg:hidden items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <button 
                  className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                  style={hasFilters ? { backgroundColor: `${BRAND_COLOR}10`, borderColor: BRAND_COLOR, color: BRAND_COLOR } : {}}
                >
                  <Filter className="w-4 h-4" />
                  <span className="font-medium">Фильтры</span>
                  {filterCount > 0 && (
                    <span 
                      className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center"
                      style={{ backgroundColor: BRAND_COLOR }}
                    >
                      {filterCount}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Фильтры</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4 pb-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Коллекция</label>
                    <Select
                      value={selectedCapsule || 'all'}
                      onValueChange={(v) => onCapsuleChange(v === 'all' ? null : v)}
                    >
                      <SelectTrigger className="w-full h-12 bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Все коллекции" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все коллекции</SelectItem>
                        {capsules.map(cap => (
                          <SelectItem key={cap.id} value={cap.id}>{cap.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Категория</label>
                    <Select
                      value={selectedCategory || 'all'}
                      onValueChange={(v) => onCategoryChange(v === 'all' ? null : v)}
                    >
                      <SelectTrigger className="w-full h-12 bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Все категории" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все категории</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Размер</label>
                    <Select
                      value={selectedSize || 'all'}
                      onValueChange={(v) => onSizeChange(v === 'all' ? null : v)}
                    >
                      <SelectTrigger className="w-full h-12 bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Все размеры" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все размеры</SelectItem>
                        {sizes.map(size => (
                          <SelectItem key={size} value={size}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {totalProducts} шт.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// КАРТОЧКА ТОВАРА
// ============================================
function ProductCard({ 
  product, 
  onAddToCart,
}: { 
  product: Product; 
  onAddToCart: (product: Product, size: string) => void;
}) {
  const [selectedSize, setSelectedSize] = useState<string | null>(
    product.sizes.length === 1 ? product.sizes[0] : null
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [showDescription, setShowDescription] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number>(0);
  const { toast } = useToast();
  
  const stockForSize = (size: string) => product.stockBySize?.[size] ?? 0;
  const availableSizes = product.preorder
    ? product.sizes
    : product.sizes.filter(s => stockForSize(s) > 0);
  
  const handleAddToCart = () => {
    if (product.sizes.length > 0 && !selectedSize) {
      toast({ title: 'Выберите размер', variant: 'destructive' });
      return;
    }
    if (!product.preorder && selectedSize && stockForSize(selectedSize) <= 0) {
      toast({ title: 'Нет в наличии', variant: 'destructive' });
      return;
    }
    onAddToCart(product, selectedSize || 'one-size');
    toast({
      title: 'Добавлено',
      description: `${product.name}${selectedSize ? ` (${selectedSize})` : ''}`,
    });
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightboxOpen(true);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const delta = touchStartX.current - endX;
    if (product.images.length > 1 && Math.abs(delta) > 50) {
      if (delta > 0) {
        setImageIndex(prev => (prev + 1) % product.images.length);
      } else {
        setImageIndex(prev => (prev - 1 + product.images.length) % product.images.length);
      }
    } else if (Math.abs(delta) <= 10) {
      setLightboxOpen(true);
    }
  }, [product.images.length]);

  const hasDescription = product.description && product.description.trim().length > 0;
  const isLongDescription = hasDescription && product.description.length > 80;
  
  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-300 flex flex-col"
    >
      {/* Изображение */}
      <div 
        className="relative aspect-square overflow-hidden bg-gray-50 cursor-zoom-in"
        onClick={handleImageClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={product.images[imageIndex] || '/placeholder.svg'}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Индикаторы фото */}
        {product.images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {product.images.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === imageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                )}
              />
            ))}
          </div>
        )}
        
        {/* Стрелки при наведении */}
        {product.images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setImageIndex(prev => (prev - 1 + product.images.length) % product.images.length); }}
              className="absolute inset-y-0 left-0 w-1/3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start pl-2 z-10"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: BRAND_COLOR }}
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setImageIndex(prev => (prev + 1) % product.images.length); }}
              className="absolute inset-y-0 right-0 w-1/3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pr-2 z-10"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: BRAND_COLOR }}
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </div>
            </button>
          </>
        )}
        
        {/* Категория - скрыта, отображается в ProductCard на мобильном */}
      </div>
      
      {/* Контент */}
      <div className="p-4 flex flex-col flex-1">
        {/* Category label */}
        {product.category && (
          <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5 mb-1 self-start">
            {product.category}
          </span>
        )}
        <h3 className="font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        
        <div className="mt-1 flex items-center gap-2">
          <p 
            className="text-xl font-bold"
            style={{ color: BRAND_COLOR }}
          >
            {product.price.toLocaleString('ru-RU')} ₸
          </p>
          {product.preorder && (
            <span 
              className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded text-white"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              Под заказ
            </span>
          )}
        </div>
        
        {/* Описание */}
        {hasDescription && (
          <div className="mt-2">
            <p className={cn(
              'text-sm text-gray-500 leading-relaxed',
              !showDescription && isLongDescription && 'line-clamp-2'
            )}>
              {product.description}
            </p>
            {isLongDescription && (
              <button
                onClick={() => setShowDescription(!showDescription)}
                className="text-xs font-medium mt-1 hover:underline"
                style={{ color: BRAND_COLOR }}
              >
                {showDescription ? 'Свернуть' : 'Читать далее'}
              </button>
            )}
          </div>
        )}
        
        {/* Spacer для выравнивания кнопки */}
        <div className="flex-1 min-h-2" />
        
        {/* Размеры */}
        {product.sizes.length > 1 ? (
          <div className="mt-3">
            <Select
              value={selectedSize || ''}
              onValueChange={(v) => setSelectedSize(v || null)}
            >
              <SelectTrigger className="w-full h-10 bg-white border-gray-300 text-sm text-gray-900">
                <SelectValue placeholder="Выберите размер" />
              </SelectTrigger>
              <SelectContent>
                {product.sizes.map(size => {
                  const stock = stockForSize(size);
                  const outOfStock = stock <= 0;
                  return (
                    <SelectItem 
                      key={size} 
                      value={size}
                      disabled={outOfStock}
                      className={outOfStock ? 'text-gray-300 line-through' : ''}
                    >
                      {size} {outOfStock ? '(нет в наличии)' : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ) : product.sizes.length === 1 ? (
          <div className="mt-3">
            <span className="inline-block px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700">
              Размер: {product.sizes[0]}
            </span>
          </div>
        ) : null}
        
        {/* Кнопка */}
        <button
          onClick={handleAddToCart}
          disabled={product.sizes.length > 0 && !selectedSize}
          className={cn(
            'mt-3 w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
            'disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed',
            'text-white hover:opacity-90 active:scale-[0.98]'
          )}
          style={{ backgroundColor: product.sizes.length > 0 && !selectedSize ? undefined : BRAND_COLOR }}
        >
          <Plus className="w-4 h-4" />
          В корзину
        </button>
      </div>
    </motion.div>
    <ImageLightbox
      images={product.images}
      currentIndex={imageIndex}
      isOpen={lightboxOpen}
      onClose={() => setLightboxOpen(false)}
      onNavigate={setImageIndex}
    />
    </>
  );
}

// ============================================
// SKELETON
// ============================================
function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      <Skeleton className="aspect-square" />
      <div className="p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-6 w-1/3 mt-2" />
        <div className="flex gap-1.5 mt-3">
          <Skeleton className="h-8 w-10 rounded-md" />
          <Skeleton className="h-8 w-10 rounded-md" />
          <Skeleton className="h-8 w-10 rounded-md" />
        </div>
        <Skeleton className="h-11 w-full mt-4 rounded-xl" />
      </div>
    </div>
  );
}

// ============================================
// СЕКЦИЯ КАПСУЛЫ (группа товаров)
// ============================================
function CapsuleProductSection({
  title,
  products,
  onAddToCart,
  isCapsule = true,
}: {
  title: string;
  products: Product[];
  onAddToCart: (product: Product, size: string) => void;
  isCapsule?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-4 mb-5">
        <div>
          <h2
            className="text-2xl md:text-3xl font-bold tracking-tight"
            style={{
              color: BRAND_COLOR,
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: `1px 1px 0 ${BRAND_COLOR}20`,
            }}
          >
            {title}
          </h2>
        </div>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-400 font-medium">{products.length} шт.</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================
// MAIN
// ============================================
const IndexAlt = () => {
  const { data, loading, error, refetch } = useCatalog();
  const cart = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedCapsule, setSelectedCapsule] = useState<string | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { categories, sizes } = useMemo(() => {
    if (!data) return { categories: [], sizes: [] };
    
    const catSet = new Set<string>();
    const sizeSet = new Set<string>();
    
    data.products.forEach(p => {
      if (p.category) catSet.add(p.category);
      p.sizes.forEach(s => sizeSet.add(s));
    });
    
    const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];
    const sortedSizes = Array.from(sizeSet).sort((a, b) => {
      const iA = SIZE_ORDER.indexOf(a.toUpperCase());
      const iB = SIZE_ORDER.indexOf(b.toUpperCase());
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return {
      categories: Array.from(catSet).sort((a, b) => a.localeCompare(b, 'ru')),
      sizes: sortedSizes,
    };
  }, [data]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    
    let result = data.products;
    
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    if (selectedSize) {
      result = result.filter(p => p.sizes.includes(selectedSize));
    }
    
    if (selectedCapsule) {
      result = result.filter(p => p.capsule === selectedCapsule);
    }
    
    return result;
  }, [data, debouncedSearchQuery, selectedCategory, selectedSize, selectedCapsule]);

  // Группировка по капсулам
  const productsByCapsule = useMemo(() => {
    if (!data || selectedCapsule) return [];
    
    return data.capsules.map(capsule => ({
      capsule,
      products: filteredProducts.filter(p => p.capsule === capsule.id),
    })).filter(g => g.products.length > 0);
  }, [data, filteredProducts, selectedCapsule]);

  const productsWithoutCapsule = useMemo(() => {
    if (!data) return [];
    const capsuleIds = new Set(data.capsules.map(c => c.id));
    return filteredProducts.filter(p => !p.capsule || !capsuleIds.has(p.capsule));
  }, [data, filteredProducts]);

  const addToCart = useCallback(
    (product: Product, size: string) => cart.addItem(product, size),
    [cart]
  );

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedSize(null);
    setSelectedCapsule(null);
  };

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AltHeader cartCount={cart.totalItems} onCartClick={cart.toggleCart} />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Package className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">Не удалось загрузить каталог</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-3 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: BRAND_COLOR }}
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {loading && <AltLoadingScreen />}

      <AltHeader cartCount={cart.totalItems} onCartClick={cart.toggleCart} />

      <main>
        <AltHeroSection
          title={data?.banners.heroTitle || 'Фирменная атрибутика'}
          subtitle={data?.banners.heroSubtitle || 'каталог для сотрудников компании'}
          bannerSlides={data?.bannerSlides}
        />
        
        {data && (
          <FiltersBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            capsules={data.capsules}
            selectedCapsule={selectedCapsule}
            onCapsuleChange={setSelectedCapsule}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sizes={sizes}
            selectedSize={selectedSize}
            onSizeChange={setSelectedSize}
            totalProducts={filteredProducts.length}
          />
        )}
        
        <div className="container px-4 py-6">
          {!loading && filteredProducts.length === 0 ? (
            <div className="py-20 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg text-gray-500 mb-4">Товары не найдены</p>
              <button
                onClick={clearFilters}
                className="font-medium hover:underline"
                style={{ color: BRAND_COLOR }}
              >
                Сбросить фильтры
              </button>
            </div>
          ) : selectedCapsule ? (
            // Показ товаров выбранной капсулы
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          ) : (
            // Показ по секциям капсул
            <>
              {productsByCapsule.map(({ capsule, products }) => (
                <CapsuleProductSection
                  key={capsule.id}
                  title={capsule.name}
                  products={products}
                  onAddToCart={addToCart}
                />
              ))}

              {productsWithoutCapsule.length > 0 && (
                <CapsuleProductSection
                  title={productsByCapsule.length > 0 ? 'Другие товары' : 'Все товары'}
                  products={productsWithoutCapsule}
                  onAddToCart={addToCart}
                  isCapsule={false}
                />
              )}
            </>
          )}
        </div>
      </main>

      <AltCartDrawer
        isOpen={cart.isOpen}
        onClose={cart.closeCart}
        items={cart.items}
        onUpdateQuantity={cart.updateQuantity}
        onRemove={cart.removeItem}
        onClear={cart.clearCart}
        totalPrice={cart.totalPrice}
      />

      <ScrollToTop />

      {/* Плавающая кнопка WhatsApp */}
      <a
        href={`https://wa.me/${WHATSAPP_PHONE}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 sm:px-4 sm:py-3 rounded-full shadow-lg text-white font-medium hover:opacity-95 transition-opacity text-sm sm:text-base max-sm:px-3 max-sm:py-2 max-sm:text-xs max-sm:gap-1.5"
        style={{ backgroundColor: BRAND_COLOR }}
        aria-label="Написать в WhatsApp"
      >
        <MessageCircle className="w-5 h-5 sm:w-5 sm:h-5 max-sm:w-4 max-sm:h-4 shrink-0" />
        <span>Узнать у Виктории</span>
      </a>
    </div>
  );
};

export default IndexAlt;
