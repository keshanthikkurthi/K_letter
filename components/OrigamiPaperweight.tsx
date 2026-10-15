'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion } from 'motion/react';
import { springPresets } from '@/lib/motion';
import { getOrigami } from '@/lib/origami';

interface OrigamiPaperweightProps {
  objectId: string;
  initialXPct: number;
  initialYPct: number;
  rotationDeg?: number;
  isDraggable?: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Called with the object's center as % of the paper, after every drop. */
  onPositionChange?: (xPct: number, yPct: number) => void;
  zIndex?: number;
}

/**
 * A draggable origami paperweight.
 *
 * The anchor (left/top %) is captured once at mount; dragging moves it with
 * transform only. Reopening a letter remounts it, which resets to the sender's
 * placement. The shadow is a silhouette of the image (static CSS filter) whose
 * opacity/offset animate, so only transform and opacity ever change.
 */
export const OrigamiPaperweight: React.FC<OrigamiPaperweightProps> = ({
  objectId,
  initialXPct,
  initialYPct,
  rotationDeg = 0,
  isDraggable = true,
  containerRef,
  onPositionChange,
  zIndex = 1,
}) => {
  const reduced = useReducedMotion();
  const item = getOrigami(objectId);
  const width = item?.width ?? 80;
  const src = item?.file ?? '/origami/crane.svg';

  const [anchor] = useState(() => ({ x: initialXPct, y: initialYPct }));
  const selfRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [held, setHeld] = useState(false);

  const reportPosition = () => {
    const box = containerRef.current?.getBoundingClientRect();
    const me = selfRef.current?.getBoundingClientRect();
    if (!box || !me || box.width === 0 || box.height === 0) return;
    const cx = ((me.left + me.width / 2 - box.left) / box.width) * 100;
    const cy = ((me.top + me.height / 2 - box.top) / box.height) * 100;
    onPositionChange?.(Math.max(0, Math.min(100, cx)), Math.max(0, Math.min(100, cy)));
  };

  const springs = reduced ? { duration: 0 } : held ? springPresets.origamiLift : springPresets.origamiDrop;

  return (
    <motion.div
      ref={selfRef}
      drag={isDraggable}
      dragConstraints={containerRef}
      dragElastic={reduced ? 0 : 0.08}
      dragMomentum={!reduced}
      dragTransition={{ power: 0.18, timeConstant: 160, bounceStiffness: 420, bounceDamping: 22 }}
      onDragStart={() => setHeld(true)}
      onDragEnd={() => {
        setHeld(false);
        reportPosition();
      }}
      onDragTransitionEnd={reportPosition}
      whileDrag={{ cursor: 'grabbing' }}
      className="origami-piece absolute select-none touch-none"
      style={{
        left: `${anchor.x}%`,
        top: `${anchor.y}%`,
        width,
        marginLeft: -width / 2,
        marginTop: -width / 2,
        x,
        y,
        zIndex: held ? 40 : 25 + zIndex,
      }}
      role={isDraggable ? 'button' : undefined}
      aria-label={`${item?.name ?? objectId} paperweight${isDraggable ? ', drag to move' : ''}`}
    >
      <motion.div
        className="relative"
        initial={reduced ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: held ? 1.12 : 1, opacity: 1, rotate: rotationDeg }}
        transition={springs}
      >
        {/* Resting shadow: tight and close */}
        <motion.img
          src={src}
          alt=""
          draggable={false}
          aria-hidden
          className="absolute inset-0 w-full h-auto pointer-events-none"
          style={{ filter: 'brightness(0) blur(1.5px)' }}
          animate={{ opacity: held ? 0 : 0.22, y: 2, x: 1 }}
          transition={springs}
        />
        {/* Lifted shadow: larger, softer, further away */}
        <motion.img
          src={src}
          alt=""
          draggable={false}
          aria-hidden
          className="absolute inset-0 w-full h-auto pointer-events-none"
          style={{ filter: 'brightness(0) blur(9px)' }}
          animate={{ opacity: held ? 0.26 : 0, y: held ? 16 : 4, x: held ? 6 : 1, scale: held ? 0.96 : 1 }}
          transition={springs}
        />
        <img src={src} alt="" draggable={false} className="relative w-full h-auto pointer-events-none select-none" />
      </motion.div>
    </motion.div>
  );
};
