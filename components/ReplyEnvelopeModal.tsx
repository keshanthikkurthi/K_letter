'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Letter } from '@/lib/types';
import { springPresets } from '@/lib/motion';

interface ReplyEnvelopeModalProps {
  letterId: string | null;
  onClose: () => void;
}

export const ReplyEnvelopeModal: React.FC<ReplyEnvelopeModalProps> = ({
  letterId,
  onClose,
}) => {
  const [fetched, setFetched] = useState<{ id: string; letter: Letter | null } | null>(null);

  useEffect(() => {
    if (!letterId) return;
    let isMounted = true;

    fetch(`/api/letters/${letterId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted) setFetched({ id: letterId, letter: data?.letter ?? null });
      })
      .catch(() => {
        if (isMounted) setFetched({ id: letterId, letter: null });
      });

    return () => {
      isMounted = false;
    };
  }, [letterId]);

  const loading = Boolean(letterId) && fetched?.id !== letterId;
  const referencedLetter = fetched?.id === letterId ? fetched.letter : null;

  if (!letterId) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={springPresets.gentle}
          className="relative w-full max-w-lg bg-[#FAF8F3] border border-stone-300 rounded-lg shadow-2xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 text-lg p-1.5 rounded-full transition-colors"
            aria-label="Close original letter"
          >
            ✕
          </button>

          <div className="border-b border-stone-200 pb-3 mb-4">
            <span className="text-xs uppercase tracking-widest text-stone-500 font-sans">
              Original Letter
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-stone-400 font-sans">
              Unfolding earlier letter…
            </div>
          ) : referencedLetter ? (
            <div className="space-y-4">
              <div className="text-xs font-serif text-stone-500 flex justify-between">
                <span>From {referencedLetter.sender_name || 'Sender'}</span>
                <span>
                  {new Date(referencedLetter.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="font-serif text-stone-800 leading-relaxed whitespace-pre-wrap text-base">
                {referencedLetter.body}
              </div>
              <div className="pt-4 border-t border-stone-200/60 flex justify-between items-center">
                <span className="font-handwriting text-2xl text-stone-900">
                  {referencedLetter.signature}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-stone-400">
              Could not load original letter.
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
