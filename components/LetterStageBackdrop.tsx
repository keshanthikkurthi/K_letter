'use client';

import React from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { getOrigami } from '@/lib/origami';

type Piece = {
  id: string;
  pos: React.CSSProperties;
  rotate: number;
  /** Parallax strength; larger = feels closer. */
  depth: number;
  drift: number;
  delay: number;
  dir: 1 | -1;
};

// Large origami resting around the edges, partly off-screen, like objects on a desk.
const PIECES: Piece[] = [
  { id: 'crane', pos: { left: '-4%', top: '6%' }, rotate: -12, depth: 0.1, drift: 12, delay: 0, dir: 1 },
  { id: 'boat', pos: { right: '-5%', top: '4%' }, rotate: 10, depth: 0.16, drift: 14, delay: 1.2, dir: -1 },
  { id: 'fox', pos: { left: '-6%', bottom: '5%' }, rotate: 16, depth: 0.22, drift: 11, delay: 0.6, dir: 1 },
  { id: 'flower', pos: { right: '-4%', bottom: '9%' }, rotate: -8, depth: 0.14, drift: 13, delay: 2, dir: -1 },
];

const SIZE = 'clamp(120px, 24vw, 340px)';

function FloatingPiece({ piece, progress, reduced }: { piece: Piece; progress: MotionValue<number>; reduced: boolean }) {
  const def = getOrigami(piece.id);
  const { scrollY } = useScroll();
  // Parallax from page scroll plus the letter's rise, so the desk "tilts away" as the letter comes out.
  const y = useTransform(() => -(scrollY.get() * piece.depth) - progress.get() * piece.depth * 500);
  const rotateY = useTransform(progress, [0, 1], [0, piece.dir * 22]);
  const rotateX = useTransform(progress, [0, 1], [0, 12]);

  if (!def) return null;

  return (
    <motion.div className="absolute" style={{ ...piece.pos, width: SIZE, y, rotateX, rotateY }}>
      <motion.img
        src={def.file}
        alt=""
        draggable={false}
        className="block w-full select-none"
        style={{ filter: 'drop-shadow(0 34px 38px rgba(4,10,28,0.5)) drop-shadow(0 6px 10px rgba(4,10,28,0.3))' }}
        initial={{ rotate: piece.rotate, y: 0 }}
        animate={reduced ? undefined : { y: [0, -piece.drift, 0], rotate: [piece.rotate, piece.rotate + 3 * piece.dir, piece.rotate] }}
        transition={{ duration: 9 + piece.delay * 1.5, repeat: Infinity, ease: 'easeInOut', delay: piece.delay }}
      />
    </motion.div>
  );
}

/** Navy desk behind the letter: gradient, drifting origami, print grain and vignette. */
export function LetterStageBackdrop({ progress }: { progress: MotionValue<number> }) {
  const reduced = Boolean(useReducedMotion());
  return (
    <div aria-hidden className="letter-stage-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ perspective: 1200 }}>
      {PIECES.map((p) => (
        <FloatingPiece key={p.id} piece={p} progress={progress} reduced={reduced} />
      ))}
      <div className="letter-stage-grain absolute inset-0" />
      <div className="letter-stage-vignette absolute inset-0" />
    </div>
  );
}
