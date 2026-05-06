import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingCartProps {
  itemCount: number;
  onClick: () => void;
}

export function FloatingCart({ itemCount, onClick }: FloatingCartProps) {
  if (itemCount <= 0) return null;

  return (
    <Button
      size="icon"
      className={cn(
        'fixed bottom-20 left-4 z-40 h-14 w-14 rounded-full shadow-lg backdrop-blur-md bg-primary text-primary-foreground border border-white/20',
        'transition-all duration-300 hover:scale-105 active:scale-95 md:hidden'
      )}
      onClick={onClick}
      aria-label={`Корзина: ${itemCount} товаров`}
    >
      <span className="relative">
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-primary-foreground text-primary text-xs font-bold flex items-center justify-center animate-bounce-in">
          {itemCount}
        </span>
      </span>
    </Button>
  );
}
