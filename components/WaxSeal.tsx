'use client';

import React from 'react';
import { motion } from 'motion/react';

interface WaxSealProps {
  svg?: string | null;
  color?: string;
  size?: number;
  cracked?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  label?: string;
}

export const WaxSeal: React.FC<WaxSealProps> = ({
  svg,
  color = '#8B1E2D',
  size = 56,
  cracked = false,
  interactive = false,
  onClick,
  className = '',
  label,
}) => {
  // Convert SVG string to safe data URI to guarantee script execution is physically impossible
  const safeDataUri = React.useMemo(() => {
    if (!svg) return null;
    const encoded = encodeURIComponent(svg.trim());
    return `data:image/svg+xml;utf8,${encoded}`;
  }, [svg]);

  return (
    <motion.div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ' ? onClick?.() : null) : undefined}
      whileHover={interactive ? { scale: 1.05 } : undefined}
      whileTap={interactive ? { scale: 0.96 } : undefined}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      className={`wax-seal-blob inline-flex items-center justify-center relative select-none ${
        interactive ? 'cursor-pointer' : ''
      } ${className}`}
      aria-label={label || 'Wax seal'}
    >
      {/* Organic rim highlight overlay */}
      <div className="absolute inset-0 rounded-full opacity-30 bg-gradient-to-tr from-black/40 via-transparent to-white/60 pointer-events-none" />

      {/* Wax inner stamp recess */}
      <div
        className="wax-seal-inner relative flex items-center justify-center overflow-hidden"
        style={{
          width: size * 0.76,
          height: size * 0.76,
          backgroundColor: color,
          filter: 'brightness(0.92)',
        }}
      >
        {/* Render sanitized SVG as an img element (Spec requirement: never raw HTML) */}
        {safeDataUri ? (
          <img
            src={safeDataUri}
            alt="Seal stamp"
            className="w-full h-full object-contain p-1 pointer-events-none drop-shadow-sm select-none"
            loading="lazy"
          />
        ) : (
          <div className="text-white font-serif font-bold text-lg drop-shadow pointer-events-none">
            ✦
          </div>
        )}

        {/* Visual crack effect when letter is broken open */}
        {cracked && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full stroke-black/80 stroke-2 fill-none drop-shadow">
              <path d="M 50,0 Q 42,25 56,48 T 46,75 L 52,100" strokeWidth="2.5" />
              <path d="M 46,45 L 30,55" strokeWidth="1.5" />
            </svg>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
