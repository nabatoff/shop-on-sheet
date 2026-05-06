import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import logoWhite from '@/assets/logo-white.png';
import { RotatingBadge } from './RotatingBadge';
import { BannerSlide } from '@/types/catalog';

interface HeroSectionProps {
  title: string;
  subtitle: string;
  bannerImages?: string[];
  bannerSlides?: BannerSlide[];
  companyName?: string;
}

export function HeroSection({ title, subtitle, bannerImages = [], bannerSlides = [], companyName = 'Art Flowers' }: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const slides = bannerSlides.length > 0 ? bannerSlides : bannerImages.map(img => ({ image: img, text: '' }));
  
  const scrollToProducts = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  const nextSlide = useCallback(() => {
    if (slides.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }
  }, [slides.length]);

  const prevSlide = () => {
    if (slides.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [slides.length, nextSlide]);

  return (
    <section className="relative">
      {/* Title section with logo and rotating badge */}
      <div className="container px-4 py-4 sm:py-5 md:py-6">
        <div className="flex items-start justify-between">
          {/* Left: Title and logo */}
          <div className="flex-1 min-w-0">
            <h1 className="font-montserrat font-normal text-foreground" style={{ fontSize: '42px', lineHeight: '0.9', letterSpacing: '-0.04em' }}>
              {title}
            </h1>
            
            {/* Company logo under title */}
            <img 
              src={logoWhite} 
              alt={`${companyName} логотип`}
              className="h-8 sm:h-10 md:h-12 w-auto object-contain mt-1"
            />
            
            <p className="mt-2 md:mt-3 text-foreground/70 text-xs sm:text-sm">{subtitle}</p>
          </div>

          {/* Right: Rotating badge - visible on all devices */}
          <RotatingBadge className="flex-shrink-0" />
        </div>
      </div>

      {/* Hero banner carousel */}
      <div className="relative h-[400px] sm:h-[500px] md:h-[650px] lg:h-[750px] overflow-hidden">
        {slides.length > 0 ? (
          <>
            {/* Images with text overlay */}
            <div 
              className="flex h-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {slides.map((slide, index) => (
                <div key={index} className="relative w-full h-full flex-shrink-0">
                  <img
                    src={slide.image}
                    alt={`Баннер ${index + 1}`}
                    className="w-full h-full object-cover object-top"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    fetchPriority={index === 0 ? 'high' : 'low'}
                    width={1920}
                    height={750}
                  />
                  {/* Banner text overlay */}
                  {slide.text && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="font-montserrat font-normal text-white text-center px-4 sm:px-8 drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] whitespace-pre-line" style={{ fontSize: '54px', lineHeight: '0.85', letterSpacing: '-0.04em' }}>
                        {slide.text}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Navigation arrows */}
            {slides.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 hover:bg-background transition-colors"
                  aria-label="Предыдущий баннер"
                >
                  <ChevronLeft className="h-6 w-6 text-card-foreground" />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 hover:bg-background transition-colors"
                  aria-label="Следующий баннер"
                >
                  <ChevronRight className="h-6 w-6 text-card-foreground" />
                </button>

                {/* Dots indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={cn(
                        'w-2 h-2 rounded-full transition-all duration-200',
                        index === currentIndex
                          ? 'bg-background w-6'
                          : 'bg-background/50 hover:bg-background/75'
                      )}
                      aria-label={`Баннер ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-catalog-hero to-catalog-bg flex items-center justify-center">
            <div className="text-center text-foreground/90 px-4">
              <p className="text-xl md:text-2xl font-light">
                Коллекция фирменного мерча
              </p>
              <p className="text-lg md:text-xl font-light mt-1">
                по капсулам
              </p>
            </div>
          </div>
        )}

        {/* Scroll indicator */}
        <button
          onClick={scrollToProducts}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-foreground/80 hover:text-foreground transition-colors animate-bounce"
          aria-label="Прокрутить к товарам"
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </section>
  );
}
