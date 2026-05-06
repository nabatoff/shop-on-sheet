import { motion } from 'framer-motion';
import { RotatingBadge } from './RotatingBadge';

const ALT_BLUE = '#0047BB';

export function AltLoadingScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ backgroundColor: ALT_BLUE }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <RotatingBadge
          text="ВАШ НАДЕЖНЫЙ ПАРТНЕР"
          color="#ffffff"
          className="w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52"
        />
      </motion.div>

      <div className="flex gap-1.5 mt-8">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-white/70"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
