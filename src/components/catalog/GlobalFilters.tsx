import { useState, useMemo, memo } from 'react';
import { Search, X } from 'lucide-react';
import { SizeFilter } from './SizeFilter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';
import { Product } from '@/types/catalog';

function CategorySelect({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
}) {
  return (
    <Select
      value={selected || 'all'}
      onValueChange={(v) => onSelect(v === 'all' ? null : v)}
    >
      <SelectTrigger className={cn(
        "w-[140px] sm:w-[160px] bg-foreground/5 border border-foreground/10 text-foreground rounded-md transition-all duration-200",
        selected && "bg-foreground/15 border-foreground/30"
      )}>
        <SelectValue placeholder="Категория" />
      </SelectTrigger>
      <SelectContent className="bg-background border-foreground/10 z-50">
        <SelectItem value="all" className="text-foreground focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
          Все категории
        </SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat} value={cat} className="text-foreground focus:bg-blue-50 focus:text-gray-900 hover:bg-blue-50 hover:text-gray-900">
            {cat}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface GlobalFiltersProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedSize: string | null;
  onSizeChange: (size: string | null) => void;
  selectedCategory?: string | null;
  onCategoryChange?: (category: string | null) => void;
  activeFiltersCount?: number;
}

const CATEGORY_ORDER = ['Одежда', 'Аксессуары', 'Кепки', 'Разное'];

function GlobalFiltersInner({
  products,
  searchQuery,
  onSearchChange,
  selectedSize,
  onSizeChange,
  selectedCategory = null,
  onCategoryChange,
  activeFiltersCount = 0,
}: GlobalFiltersProps) {
  const [isFocused, setIsFocused] = useState(false);
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });

  const allSizes = useMemo(() => {
    const sizeSet = new Set<string>();
    products.forEach(p => p.sizes.forEach(s => sizeSet.add(s)));
    return Array.from(sizeSet);
  }, [products]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category?.trim()) set.add(p.category!.trim()); });
    return Array.from(set).sort((a, b) => {
      const iA = CATEGORY_ORDER.indexOf(a);
      const iB = CATEGORY_ORDER.indexOf(b);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.localeCompare(b, 'ru');
    });
  }, [products]);

  return (
    <div
      ref={ref}
      className={cn(
        "container px-3 sm:px-4 py-6 sm:py-8",
        isVisible ? "animate-fade-in-up" : "scroll-hidden"
      )}
    >
      <div className="flex flex-wrap items-center gap-3 max-w-2xl mx-auto">
        {allSizes.length > 0 && (
          <SizeFilter
            sizes={allSizes}
            selected={selectedSize}
            onSelect={onSizeChange}
          />
        )}

        {allCategories.length > 0 && onCategoryChange && (
          <CategorySelect
            categories={allCategories}
            selected={selectedCategory}
            onSelect={onCategoryChange}
          />
        )}

        {/* Search input */}
        <div
          className={cn(
            "relative flex-1 flex items-center rounded-full transition-all duration-300",
            "bg-foreground/5 border border-foreground/10",
            isFocused && "ring-2 ring-foreground/20 border-foreground/20"
          )}
        >
          <Search className="absolute left-4 h-5 w-5 text-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск товаров..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={cn(
              "w-full bg-transparent py-3 pl-12 pr-10 text-foreground",
              "placeholder:text-foreground/40 focus:outline-none",
              "text-sm sm:text-base"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 p-1 rounded-full hover:bg-foreground/10 transition-colors"
            >
              <X className="h-4 w-4 text-foreground/50" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const GlobalFilters = memo(GlobalFiltersInner);
