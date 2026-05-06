import { ShoppingCart, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  companyName?: string;
  tagline?: string;
}

export function Header({ cartCount, onCartClick, companyName = 'Brand', tagline = 'стиль, который объединяет' }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-foreground hover:bg-foreground/10 md:hidden" aria-label="Меню">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-foreground/80 font-machina">{tagline}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-foreground hover:bg-foreground/10"
            onClick={onCartClick}
            aria-label={cartCount > 0 ? `Корзина: ${cartCount} товаров` : 'Открыть корзину'}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="cart-badge animate-bounce-in">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
