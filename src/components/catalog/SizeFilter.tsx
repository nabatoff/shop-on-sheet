import { ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Size order for sorting
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL', '5XL'];

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const aUpper = a.toUpperCase();
    const bUpper = b.toUpperCase();
    
    const aIndex = SIZE_ORDER.indexOf(aUpper);
    const bIndex = SIZE_ORDER.indexOf(bUpper);
    
    // Both are standard sizes
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // Only a is standard size
    if (aIndex !== -1) return -1;
    
    // Only b is standard size
    if (bIndex !== -1) return 1;
    
    // Both are numeric
    const aNum = parseFloat(a);
    const bNum = parseFloat(b);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    
    // Only a is numeric
    if (!isNaN(aNum)) return 1;
    
    // Only b is numeric
    if (!isNaN(bNum)) return -1;
    
    // Alphabetical fallback
    return a.localeCompare(b);
  });
}

interface SizeFilterProps {
  sizes: string[];
  selected: string | null;
  onSelect: (size: string | null) => void;
}

export function SizeFilter({ sizes, selected, onSelect }: SizeFilterProps) {
  const sortedSizes = sortSizes(sizes);
  
  return (
    <Select
      value={selected || 'all'}
      onValueChange={(value) => onSelect(value === 'all' ? null : value)}
    >
      <SelectTrigger className="w-[140px] sm:w-[160px] bg-foreground/5 border-foreground/10 text-foreground rounded-full">
        <SelectValue placeholder="Размер" />
      </SelectTrigger>
      <SelectContent className="bg-background border-foreground/10 z-50">
        <SelectItem value="all" className="text-foreground">
          Все размеры
        </SelectItem>
        {sortedSizes.map((size) => (
          <SelectItem key={size} value={size} className="text-foreground">
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}