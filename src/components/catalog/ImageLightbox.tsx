import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const SWIPE_THRESHOLD = 50;

export function ImageLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const touchStartX = useRef(0);
  const [direction, setDirection] = useState(0);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    onNavigate((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  const handleNext = useCallback(() => {
    setDirection(1);
    onNavigate((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen, onClose, handlePrev, handleNext]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (images.length <= 1) return;
      const endX = e.changedTouches[0].clientX;
      const delta = touchStartX.current - endX;
      if (delta > SWIPE_THRESHOLD) handleNext();
      else if (delta < -SWIPE_THRESHOLD) handlePrev();
    },
    [images.length, handlePrev, handleNext]
  );

  if (!isOpen || images.length === 0) return null;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
      role="button"
      tabIndex={-1}
      aria-label="Закрыть просмотр"
    >
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Modal container */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-[95vw] max-w-3xl bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
        style={{
          maxHeight: '90dvh',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            {images.length > 1 && (
              <span className="text-sm text-white/60 font-medium">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Image area */}
        <div className="relative flex items-center justify-center px-4 pb-4 sm:px-6 sm:pb-6" style={{ minHeight: '50dvh', maxHeight: '75dvh' }}>
          {/* Nav arrows - desktop */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-all touch-manipulation"
                aria-label="Предыдущее фото"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 transition-all touch-manipulation"
                aria-label="Следующее фото"
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
            </>
          )}

          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.img
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              src={images[currentIndex]}
              alt={`Фото ${currentIndex + 1}`}
              className="max-h-[70dvh] max-w-full w-auto h-auto object-contain select-none rounded-xl"
              draggable={false}
            />
          </AnimatePresence>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex justify-center gap-2 px-4 pb-4 sm:px-6 sm:pb-6">
            {images.map((src, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  onNavigate(index);
                }}
                className={cn(
                  'w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 touch-manipulation flex-shrink-0',
                  index === currentIndex
                    ? 'border-white/80 ring-1 ring-white/40 scale-105'
                    : 'border-white/20 opacity-50 hover:opacity-80'
                )}
              >
                <img
                  src={src}
                  alt={`Миниатюра ${index + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>{isOpen && content}</AnimatePresence>,
    document.body
  );
}
