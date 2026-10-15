'use client';

import React from 'react';
import { motion } from 'motion/react';
import { springPresets } from '@/lib/motion';
import { WaxSeal } from './WaxSeal';

interface ReplyTapedEnvelopeProps {
  date: string; // ISO
  sealSvg?: string | null;
  sealColor?: string;
  onOpen?: () => void;
}

export function formatReplyDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Small envelope taped to the top of the page: "In reply to <date>". Click opens the original. */
export const ReplyTapedEnvelope: React.FC<ReplyTapedEnvelopeProps> = ({ date, sealSvg, sealColor, onOpen }) => {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      initial={{ opacity: 0, y: -8, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: -2 }}
      whileHover={onOpen ? { rotate: 0, y: -2 } : undefined}
      whileTap={onOpen ? { scale: 0.97 } : undefined}
      transition={springPresets.gentle}
      className="group relative mx-auto block w-[210px] aspect-[16/10] rounded-[3px] bg-[#EFE8DA] text-left shadow-[0_2px_6px_rgba(35,25,20,0.12),0_8px_18px_rgba(35,25,20,0.08)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-800 enabled:cursor-pointer"
      aria-label={`In reply to the letter from ${formatReplyDate(date)}${onOpen ? '. Open original' : ''}`}
    >
      {/* Flap */}
      <svg viewBox="0 0 210 131" className="absolute inset-0 w-full h-full" aria-hidden>
        <polygon points="0,0 210,0 105,70" fill="#E4DBC9" />
        <polyline points="0,0 105,70 210,0" fill="none" stroke="#D3C7B1" strokeWidth="1" />
      </svg>
      {/* Tape */}
      <span aria-hidden className="washi-tape absolute -top-3 left-1/2 h-5 w-20 -translate-x-1/2 rotate-[3deg]" />
      <span className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
        <WaxSeal svg={sealSvg} color={sealColor} size={26} />
      </span>
      <span className="absolute inset-x-0 bottom-2.5 text-center font-serif text-[12px] text-stone-700">
        In reply to {formatReplyDate(date)}
      </span>
    </motion.button>
  );
};
