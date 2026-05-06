import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 md:gap-3">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'category-tag transition-all duration-200',
          selected === null 
            ? 'bg-foreground text-background' 
            : 'hover:bg-foreground/20'
        )}
      >
        все
      </button>
      {categories.map(category => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={cn(
            'category-tag transition-all duration-200',
            selected === category 
              ? 'bg-foreground text-background' 
              : 'hover:bg-foreground/20'
          )}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
