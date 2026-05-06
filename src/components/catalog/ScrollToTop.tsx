import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SCROLL_THRESHOLD = 300;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Button
      size="icon"
      variant="secondary"
      className={cn(
        'fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg backdrop-blur-md bg-background/95 border border-foreground/10 transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
      onClick={scrollToTop}
      aria-label="Прокрутить вверх"
    >
      <ChevronUp className="h-6 w-6 text-foreground" />
    </Button>
  );
}
