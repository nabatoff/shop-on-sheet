import { useState, useRef, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Product } from '@/types/catalog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ImageLightbox } from './ImageLightbox';
import { useToast } from '@/hooks/use-toast';

export function ProductCardSkeleton() {
  return (
    <div className="product-card rounded-lg overflow-hidden">
      <div className="relative aspect-square overflow-hidden bg-catalog-card">
        <Skeleton className="h-full w-full rounded-none animate-shimmer" />
      </div>
      <div className="p-3 md:p-4 bg-card space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-6 w-8 rounded" />
          <Skeleton className="h-6 w-8 rounded" />
          <Skeleton className="h-6 w-10 rounded" />
        </div>
      </div>
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, selectedSize: string) => void;
}

function stockForSize(product: Product, size: string): number | undefined {
  return product.stockBySize?.[size];
}

function preorderForSize(product: Product, size: string): boolean {
  return product.preorderBySize?.[size] === true;
}

// Tiny 1x1 gray pixel for blur placeholder
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop';

function ProductCardInner({ product, onAddToCart }: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>(product.sizes[0] || '');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number>(0);
  const { toast } = useToast();

  const currentSrc = product.images[currentImageIndex];
  const currentLoaded = imageLoaded[currentImageIndex];
  const currentError = imageError[currentImageIndex];
  const displaySrc = currentError ? FALLBACK_IMAGE : currentSrc;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ₸';
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const selectedStock = stockForSize(product, selectedSize);
  const selectedPreorder = preorderForSize(product, selectedSize);
  const canAddSelected = product.preorder || selectedPreorder || selectedStock === undefined || selectedStock > 0;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const delta = touchStartX.current - endX;
      const threshold = 50;
      if (product.images.length > 1 && Math.abs(delta) > threshold) {
        if (delta > threshold) {
          setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
        } else {
          setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
        }
      } else if (Math.abs(delta) <= 10) {
        setLightboxOpen(true);
      }
    },
    [product.images.length]
  );

  const handleAddToCart = () => {
    if (!selectedSize && product.sizes.length > 0) return;
    if (!product.preorder && selectedStock !== undefined && selectedStock <= 0) {
      toast({
        title: 'Нет в наличии',
        description: `Размер ${selectedSize} закончился`,
        variant: 'destructive',
      });
      return;
    }
    onAddToCart(product, selectedSize);
  };

  return (
    <>
    <div className="product-card group rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-1">
      {/* Image gallery - swipe on touch devices */}
      <div
        className="relative aspect-square overflow-hidden bg-catalog-card rounded-t-lg touch-pan-y cursor-zoom-in"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setLightboxOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxOpen(true); } }}
        aria-label="Увеличить фото"
      >
        <img
          src={BLUR_PLACEHOLDER}
          alt=""
          aria-hidden
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            currentLoaded ? 'opacity-0' : 'opacity-100'
          )}
        />
        <img
          src={displaySrc}
          alt={product.name}
          className={cn(
            'absolute inset-0 w-full h-full object-cover scale-110 transition-all duration-300 group-hover:scale-120 pointer-events-none',
            !currentLoaded && 'blur-sm'
          )}
          loading="lazy"
          onLoad={() => setImageLoaded(prev => ({ ...prev, [currentImageIndex]: true }))}
          onError={() => setImageError(prev => ({ ...prev, [currentImageIndex]: true }))}
        />
        {/* Navigation arrows */}
        {product.images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 bg-background/80 rounded-full p-1 hover:bg-background"
              aria-label="Предыдущее фото"
            >
              <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 text-card-foreground" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 bg-background/80 rounded-full p-1 hover:bg-background"
              aria-label="Следующее фото"
            >
              <ChevronRight className="h-3 w-3 md:h-4 md:w-4 text-card-foreground" />
            </button>

            {/* Dots indicator */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {product.images.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all duration-200',
                    index === currentImageIndex
                      ? 'bg-background w-3'
                      : 'bg-background/50 hover:bg-background/75'
                  )}
                  aria-label={`Фото ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Add to cart button */}
        <Button
          size="icon"
          className="absolute bottom-2 right-2 md:bottom-3 md:right-3 h-11 w-11 min-h-[44px] min-w-[44px] md:h-10 md:w-10 md:min-h-0 md:min-w-0 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 ease-out hover:scale-105 active:scale-95 bg-background text-card-foreground hover:bg-background/90 shadow-lg disabled:opacity-60"
          onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}
          disabled={(product.sizes.length > 0 && !selectedSize) || !canAddSelected}
          aria-label="Добавить в корзину"
        >
          <Plus className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>

      {/* Product info */}
      <div className="p-4 md:p-5 bg-card rounded-b-lg space-y-3">
        {/* Category label - mobile only */}
        {product.category && (
          <span className="inline-block sm:hidden text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5 mb-1">
            {product.category}
          </span>
        )}
        <h3 className="font-medium text-card-foreground text-sm md:text-base truncate mb-0.5">{product.name}</h3>
        <div className="flex items-center gap-2">
          <span className="font-bold text-card-foreground text-sm md:text-base">{formatPrice(product.price)}</span>
          {(product.preorder || selectedPreorder) && (
            <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded bg-amber-500 text-white">
              Под заказ
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-xs text-card-foreground/70 mt-1 mb-2 line-clamp-2 hidden md:block">{product.description}</p>
        )}

        {/* Stock info */}
        {product.stock !== undefined && product.stock > 0 && (
          <p className="text-xs font-medium text-emerald-600 mb-2">В наличии: {product.stock} шт.</p>
        )}

        {/* Size selector */}
        {product.sizes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.sizes.map((size) => {
              const sizeStock = stockForSize(product, size);
              const outOfStock = !preorderForSize(product, size) && sizeStock !== undefined && sizeStock <= 0;
              return (
                <button
                  key={size}
                  onClick={() => !outOfStock && setSelectedSize(size)}
                  disabled={outOfStock}
                  className={cn(
                    'min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 px-2 py-1 text-xs font-medium rounded border transition-all duration-200 ease-out hover:scale-105 active:scale-95',
                    selectedSize === size
                      ? 'bg-card-foreground text-card border-card-foreground'
                      : 'bg-card text-card-foreground border-border hover:border-card-foreground',
                    outOfStock && 'opacity-50 cursor-not-allowed line-through'
                  )}
                  title={outOfStock ? 'Нет в наличии' : undefined}
                >
                  {size}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* Lightbox for full-screen image viewing */}
    <ImageLightbox
      images={product.images}
      currentIndex={currentImageIndex}
      isOpen={lightboxOpen}
      onClose={() => setLightboxOpen(false)}
      onNavigate={setCurrentImageIndex}
    />
    </>
  );
}

function areProductCardPropsEqual(prev: ProductCardProps, next: ProductCardProps) {
  return (
    prev.product.id === next.product.id &&
    prev.product === next.product &&
    prev.onAddToCart === next.onAddToCart
  );
}

export const ProductCard = memo(ProductCardInner, areProductCardPropsEqual);
