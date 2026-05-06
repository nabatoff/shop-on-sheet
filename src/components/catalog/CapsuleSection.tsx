import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Capsule, Product } from '@/types/catalog';
import { ProductCard } from './ProductCard';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';

const BRAND_COLOR = '#0047BB';

const productCardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

// Category order for sorting
const CATEGORY_ORDER = ['Одежда', 'Аксессуары'];

// Animated wrapper component
function AnimatedElement({ 
  children, 
  animation, 
  delay = 0,
  className = ''
}: { 
  children: React.ReactNode; 
  animation: 'slide-in-left' | 'scale-in-up' | 'fade-in-up';
  delay?: number;
  className?: string;
}) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });
  
  return (
    <div
      ref={ref}
      className={cn(
        className,
        isVisible ? `animate-${animation}` : 'scroll-hidden'
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

interface CapsuleSectionProps {
  capsule: Capsule;
  products: Product[];
  onAddToCart: (product: Product, selectedSize: string) => void;
}

function CapsuleSectionInner({ capsule, products, onAddToCart }: CapsuleSectionProps) {
  const headerAnimation = useScrollAnimation<HTMLDivElement>({ threshold: 0.2 });

  // Get sorted categories
  const categories = [...new Set(products.map(p => p.category))].sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a);
    const indexB = CATEGORY_ORDER.indexOf(b);
    
    const orderA = indexA === -1 ? CATEGORY_ORDER.length : indexA;
    const orderB = indexB === -1 ? CATEGORY_ORDER.length : indexB;
    
    if (orderA !== orderB) return orderA - orderB;
    
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b, 'ru');
    }
    
    return 0;
  });

  const displayColor = capsule.color || BRAND_COLOR;
  const displayPrefix = capsule.prefix || 'Капсула';
  
  const textOutlineStyle = capsule.outline ? {
    WebkitTextStroke: `1px ${BRAND_COLOR}`,
    paintOrder: 'fill stroke' as const,
  } : {};

  return (
    <section className="py-10 sm:py-14 md:py-16">
      <div className="container px-3 sm:px-4">
        {/* Capsule header - alt page style */}
        <div 
          ref={headerAnimation.ref}
          className={cn(
            "mb-6 sm:mb-8",
            headerAnimation.isVisible ? "animate-slide-in-left" : "scroll-hidden"
          )}
        >
          <div className="flex items-center gap-4">
            <div>
              <span 
                className="text-xs uppercase tracking-widest font-semibold"
                style={{ color: displayColor, ...textOutlineStyle }}
              >
                {displayPrefix}
              </span>
              <h2 
                className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
                style={{ 
                  color: displayColor,
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  textShadow: capsule.outline ? 'none' : `1px 1px 0 ${displayColor}20`,
                  ...textOutlineStyle,
                }}
              >
                {capsule.name}
              </h2>
            </div>
            <div className="flex-1 h-px bg-foreground/20" />
            <span className="text-sm text-foreground/50 font-medium">{products.length} шт.</span>
          </div>
        </div>

        {/* Products grouped by category */}
        {categories.map((category) => {
          const categoryProducts = products.filter(p => p.category === category);
          if (categoryProducts.length === 0) return null;
          
          return (
            <div key={category} className="mb-10 sm:mb-14">
              {/* Category label - glass style with animation - hidden on mobile, shown on sm+ */}
              <AnimatedElement animation="scale-in-up" className="mb-4 sm:mb-6 hidden sm:flex justify-center relative">
                <div className="liquid-glass rounded-full px-3 sm:px-8 py-1 sm:py-3">
                  <span className="text-xs sm:text-base md:text-lg font-medium text-white lowercase">
                    {category}
                  </span>
                </div>
              </AnimatedElement>

              {/* Category label - mobile only, simple text style below flow */}
              <div className="flex sm:hidden justify-center mb-3">
                <div className="liquid-glass rounded-full px-4 py-1.5">
                  <span className="text-xs font-medium text-white lowercase">
                    {category}
                  </span>
                </div>
              </div>

              {/* Products grid - framer-motion stagger */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
                {categoryProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    custom={index}
                    variants={productCardVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <ProductCard product={product} onAddToCart={onAddToCart} />
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function areCapsuleSectionPropsEqual(
  prev: CapsuleSectionProps,
  next: CapsuleSectionProps
) {
  return (
    prev.capsule.id === next.capsule.id &&
    prev.products === next.products &&
    prev.onAddToCart === next.onAddToCart
  );
}

export const CapsuleSection = memo(CapsuleSectionInner, areCapsuleSectionPropsEqual);
