'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springPresets } from '@/lib/motion';

interface ResetBannerProps {
  targetName: string;
  token: string;
  onDismiss: () => void;
}

export const ResetBanner: React.FC<ResetBannerProps> = ({
  targetName,
  token,
  onDismiss,
}) => {
  const [copied, setCopied] = useState(false);
  const resetUrl = typeof window !== 'undefined' ? `${window.location.origin}/reset/${token}` : `/reset/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={springPresets.gentle}
        className="w-full bg-[#FFFDF9] border border-amber-200/90 rounded-md p-4 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h4 className="text-sm font-sans font-semibold text-stone-900">
              {targetName} requested a password reset
            </h4>
          </div>
          <p className="text-xs text-stone-600 font-sans">
            Share this single-use link with {targetName} or open it to set a new password on their behalf:
          </p>
          <div className="text-xs font-mono text-stone-700 bg-stone-100/80 px-2 py-1 rounded select-all break-all inline-block mt-1">
            {resetUrl}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-sans font-medium transition-colors cursor-pointer"
          >
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
          <a
            href={`/reset/${token}`}
            className="px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-800 text-white text-xs font-sans font-medium transition-colors inline-block"
          >
            Open link
          </a>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded text-stone-400 hover:text-stone-600 text-xs transition-colors cursor-pointer"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
