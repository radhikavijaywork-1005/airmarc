import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export default function CaptureFlash({ active }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="capture-flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.26, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}
