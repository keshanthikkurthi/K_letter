'use client';

import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { WaxSeal } from './WaxSeal';
import { springPresets } from '@/lib/motion';

interface SendAnimationProps {
  sealSvg?: string | null;
  sealColor?: string;
  isScheduled?: boolean;
  deliverAt?: string;
  onFinished: () => void;
}

type SendStage = 'foldingPaper' | 'slideIntoEnvelope' | 'closingFlap' | 'stampingSeal' | 'envelopeGliding' | 'done';

export const SendAnimation: React.FC<SendAnimationProps> = ({
  sealSvg,
  sealColor = '#8B1E2D',
  isScheduled = false,
  deliverAt,
  onFinished,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [stage, setStage] = useState<SendStage>('foldingPaper');

  useEffect(() => {
    if (prefersReducedMotion) {
      setTimeout(() => onFinished(), 800);
      return;
    }

    // Sequence timeline:
    // 0ms: Paper folds in thirds
    // 600ms: Paper slides into envelope pocket
    // 1200ms: Flap folds closed over pocket
    // 1700ms: Wax seal stamps onto flap
    // 2300ms: Envelope glides off screen with inertia
    // 3200ms: Finished

    const t1 = setTimeout(() => setStage('slideIntoEnvelope'), 600);
    const t2 = setTimeout(() => setStage('closingFlap'), 1200);
    const t3 = setTimeout(() => setStage('stampingSeal'), 1700);
    const t4 = setTimeout(() => setStage('envelopeGliding'), 2300);
    const t5 = setTimeout(() => {
      setStage('done');
      onFinished();
    }, 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [prefersReducedMotion, onFinished]);

  const formattedDelivery = deliverAt
    ? new Date(deliverAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F2EB]/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 overflow-hidden select-none">
      {/* 3D Envelope Container */}
      <motion.div
        animate={
          stage === 'envelopeGliding'
            ? {
                x: 450,
                y: -120,
                rotateZ: 6,
                opacity: 0,
                scale: 0.9,
              }
            : { x: 0, y: 0, opacity: 1, scale: 1 }
        }
        transition={springPresets.snappy}
        className="relative w-[340px] sm:w-[420px] h-[240px] sm:h-[280px] perspective-1000"
      >
        {/* Paper Sheet folding and sliding into envelope */}
        <motion.div
          animate={
            stage === 'foldingPaper'
              ? { scaleY: 0.65, y: -80, opacity: 0.95 }
              : stage === 'slideIntoEnvelope'
              ? { scaleY: 0.45, y: 30, opacity: 0.4 }
              : { y: 60, opacity: 0 }
          }
          transition={springPresets.paperUnfold}
          className="absolute left-6 right-6 top-0 h-[220px] bg-[#FCFBF9] border border-stone-300 rounded shadow-md z-10"
        />

        {/* Envelope Base */}
        <div className="absolute inset-0 rounded-md bg-[#EDE6D8] border border-[#D5C9B5] shadow-2xl overflow-hidden" />

        {/* Envelope Pocket Front */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <svg viewBox="0 0 420 280" className="w-full h-full">
            <polygon points="0,0 0,280 210,170" fill="#E2D7C3" />
            <polygon points="420,0 420,280 210,170" fill="#DDD1BC" />
            <polygon points="0,280 420,280 210,145" fill="#E9DFC9" stroke="#D1C3A9" strokeWidth="0.8" />
          </svg>
        </div>

        {/* Top Flap Closing Down */}
        <motion.div
          animate={{
            rotateX:
              stage === 'foldingPaper' || stage === 'slideIntoEnvelope'
                ? -175
                : 0,
          }}
          transition={springPresets.envelope}
          style={{
            transformOrigin: 'top center',
            transformStyle: 'preserve-3d',
            zIndex: stage === 'closingFlap' || stage === 'stampingSeal' || stage === 'envelopeGliding' ? 30 : 5,
          }}
          className="absolute inset-x-0 top-0 h-[148px]"
        >
          {/* Front of Flap */}
          <div className="w-full h-full relative backface-hidden">
            <svg viewBox="0 0 420 148" className="w-full h-full filter drop-shadow-sm">
              <polygon points="0,0 420,0 210,145" fill="#DFD4BE" stroke="#C9BC9F" strokeWidth="0.8" />
            </svg>

            {/* Hot Wax Seal Stamping Down */}
            {(stage === 'stampingSeal' || stage === 'envelopeGliding') && (
              <motion.div
                initial={{ scale: 2.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springPresets.bouncy}
                className="absolute left-1/2 bottom-[-8px] -translate-x-1/2 z-40"
              >
                <WaxSeal svg={sealSvg} color={sealColor} size={58} />
              </motion.div>
            )}
          </div>

          {/* Underside of Flap */}
          <div
            className="w-full h-full absolute inset-0 backface-hidden"
            style={{ transform: 'rotateX(180deg)' }}
          >
            <svg viewBox="0 0 420 148" className="w-full h-full">
              <polygon points="0,0 420,0 210,145" fill="#CBBDA4" stroke="#BAAC94" strokeWidth="0.8" />
            </svg>
          </div>
        </motion.div>
      </motion.div>

      {/* Status Label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-10 text-center max-w-sm"
      >
        <p className="font-serif text-lg text-stone-800">
          {isScheduled ? 'Letter sealed & scheduled' : 'Letter sent'}
        </p>
        {isScheduled && deliverAt && (
          <p className="text-xs text-stone-500 font-sans mt-1">
            Arrives on {formattedDelivery}
          </p>
        )}
      </motion.div>
    </div>
  );
};
