import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SizeFilter } from './SizeFilter';
import { Product } from '@/types/catalog';
import { cn } from '@/lib/utils';

const CATEGORY_ORDER = ['Одежда', 'Аксессуары', 'Кепки', 'Разное'];

function CategorySelect({
  categories,
  selected,
  onSelect,
  className,
}: {
  categories: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  className?: string;
}) {
  return (
    <Select value={selected || 'all'} onValueChange={(v) => onSelect(v === 'all' ? null : v)}>
      <SelectTrigger className={cn('bg-foreground/5 border-foreground/10 text-foreground rounded-md', className)}>
        <SelectValue placeholder="Категория" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Все категории</SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  searchQuery: string;
  selectedSize: string | null;
  selectedCategory: string | null;
  onApply: (filters: { searchQuery: string; selectedSize: string | null; selectedCategory: string | null }) => void;
}

export function FiltersDrawer({
  open,
  onOpenChange,
  products,
  searchQuery,
  selectedSize,
  selectedCategory,
  onApply,
}: FiltersDrawerProps) {
  const [pendingSearch, setPendingSearch] = useState(searchQuery);
  const [pendingSize, setPendingSize] = useState<string | null>(selectedSize);
  const [pendingCategory, setPendingCategory] = useState<string | null>(selectedCategory);

  useEffect(() => {
    if (open) {
      setPendingSearch(searchQuery);
      setPendingSize(selectedSize);
      setPendingCategory(selectedCategory);
    }
  }, [open, searchQuery, selectedSize, selectedCategory]);

  const allSizes = [...new Set(products.flatMap((p) => p.sizes))];
  const allCategories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])].sort((a, b) => {
    const iA = CATEGORY_ORDER.indexOf(a);
    const iB = CATEGORY_ORDER.indexOf(b);
    if (iA !== -1 && iB !== -1) return iA - iB;
    if (iA !== -1) return -1;
    if (iB !== -1) return 1;
    return a.localeCompare(b, 'ru');
  });

  const handleApply = () => {
    onApply({
      searchQuery: pendingSearch,
      selectedSize: pendingSize,
      selectedCategory: pendingCategory,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl shadow-2xl backdrop-blur-xl bg-background/95 border-t border-foreground/10 max-h-[85vh] flex flex-col"
      >
        <div className="w-12 h-1 rounded-full bg-foreground/20 mx-auto mb-4" aria-hidden />
        <SheetHeader className="border-b border-foreground/10 pb-4">
          <SheetTitle className="text-foreground">Фильтры</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Поиск</label>
            <div className="relative flex items-center rounded-full bg-foreground/5 border border-foreground/10">
              <Search className="absolute left-4 h-5 w-5 text-foreground/50" />
              <input
                type="text"
                placeholder="Поиск товаров..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                className="w-full bg-transparent py-3 pl-12 pr-10 text-foreground placeholder:text-foreground/40 focus:outline-none text-base"
              />
              {pendingSearch && (
                <button
                  type="button"
                  onClick={() => setPendingSearch('')}
                  className="absolute right-3 p-1 rounded-full hover:bg-foreground/10"
                >
                  <X className="h-4 w-4 text-foreground/50" />
                </button>
              )}
            </div>
          </div>
          {allSizes.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Размер</label>
              <SizeFilter
                sizes={allSizes}
                selected={pendingSize}
                onSelect={setPendingSize}
              />
            </div>
          )}
          {allCategories.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Категория</label>
              <CategorySelect
                categories={allCategories}
                selected={pendingCategory}
                onSelect={setPendingCategory}
              />
            </div>
          )}
        </div>
        <div className="border-t border-foreground/10 pt-4">
          <Button
            className="w-full h-12 text-base"
            onClick={handleApply}
          >
            Применить фильтры
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
