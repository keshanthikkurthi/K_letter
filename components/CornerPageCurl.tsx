'use client';

import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { springPresets } from '@/lib/motion';
import type { CornerId } from '@/lib/origami';

interface CornerPageCurlProps {
  corner: CornerId;
  /** 0 (flat) .. 1 (fully lifted). Target value; the spring does the easing and overshoot. */
  lift: number;
  /** Corner flap size as a fraction of the sheet's width. */
  sizePx: number;
}

const MAX_ANGLE = 64; // degrees around the diagonal fold line

const CORNERS: Record<CornerId, { sx: -1 | 1; sy: -1 | 1; pos: string; clip: string; grad: string }> = {
  'top-left': { sx: -1, sy: -1, pos: 'top-0 left-0', clip: 'polygon(0 0, 100% 0, 0 100%)', grad: '135deg' },
  'top-right': { sx: 1, sy: -1, pos: 'top-0 right-0', clip: 'polygon(0 0, 100% 0, 100% 100%)', grad: '225deg' },
  'bottom-left': { sx: -1, sy: 1, pos: 'bottom-0 left-0', clip: 'polygon(0 0, 100% 100%, 0 100%)', grad: '45deg' },
  'bottom-right': { sx: 1, sy: 1, pos: 'bottom-0 right-0', clip: 'polygon(100% 0, 100% 100%, 0 100%)', grad: '315deg' },
};

/**
 * CSS 3D page-curl for one corner: a triangular flap (clip-path) rotates around
 * the diagonal fold line toward the viewer, showing a lighter underside, with a
 * soft shadow cast on the desk/paper beneath. Only transform + opacity animate.
 */
export const CornerPageCurl: React.FC<CornerPageCurlProps> = ({ corner, lift, sizePx }) => {
  const c = CORNERS[corner];
  const angle = useSpring(0, springPresets.breezeCorner);

  useEffect(() => {
    angle.set(Math.max(0, Math.min(1, lift)) * MAX_ANGLE);
  }, [lift, angle]);

  // Axis (sy, -sx) is perpendicular to the corner's diagonal; positive angles lift toward the viewer.
  const flapTransform = useTransform(angle, (a) => `rotate3d(${c.sy}, ${-c.sx}, 0, ${a}deg)`);
  const flapOpacity = useTransform(angle, [0, 4, 12], [0, 0.6, 1]);
  const shadowOpacity = useTransform(angle, [0, MAX_ANGLE], [0, 0.55]);
  const shadowScale = useTransform(angle, [0, MAX_ANGLE], [0.6, 1.08]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${c.pos} z-20`}
      style={{ width: sizePx, height: sizePx, transformStyle: 'preserve-3d' }}
    >
      {/* Shadow under the lifted corner */}
      <motion.div
        className="absolute inset-0"
        style={{
          clipPath: c.clip,
          opacity: shadowOpacity,
          scale: shadowScale,
          background: `linear-gradient(${c.grad}, rgba(40,30,20,0.32), rgba(40,30,20,0.05) 70%)`,
          filter: 'blur(5px)',
        }}
      />
      {/* Paper hidden under the flap reads as "gone": tint the corner with desk tone */}
      <motion.div
        className="absolute inset-0"
        style={{ clipPath: c.clip, opacity: flapOpacity, background: 'var(--bg-desk)' }}
      />
      {/* The flap itself (underside of the paper) */}
      <motion.div
        className="absolute inset-0 curl-underside"
        style={{
          clipPath: c.clip,
          transform: flapTransform,
          opacity: flapOpacity,
          transformOrigin: '50% 50%',
          background: `linear-gradient(${c.grad}, #FFFFFF 0%, #F3EEE4 45%, #E2D9C9 100%)`,
        }}
      />
    </div>
  );
};
