import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

interface EmergencyBannerProps {
  message: string;
  type?: 'priority' | 'alert';
}

export default function EmergencyBanner({ message, type = 'priority' }: EmergencyBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-brand-emergency text-white relative z-50 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="font-semibold text-sm">{message}</span>
          <button 
            onClick={() => setIsVisible(false)}
            className="absolute right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
