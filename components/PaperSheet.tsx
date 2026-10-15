'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Letter, OrigamiObjectPlacement } from '@/lib/types';
import { applyReaderDrag, computeCornerPins, type CornerId } from '@/lib/origami';
import { springPresets } from '@/lib/motion';
import { WaxSeal } from './WaxSeal';
import { OrigamiPaperweight } from './OrigamiPaperweight';
import { CornerPageCurl } from './CornerPageCurl';
import { ReplyTapedEnvelope } from './ReplyTapedEnvelope';

interface PaperSheetProps {
  letter: Letter;
  initialObjects?: OrigamiObjectPlacement[];
  isSender?: boolean;
  onReplyClick?: () => void;
  onOpenReplyReference?: (letterId: string) => void;
}

const CORNER_IDS: CornerId[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

// Gust shape over ~2s: ease in, flutter, ease out. [ms offset, fraction of peak]
const GUST_KEYFRAMES: [number, number][] = [
  [0, 0.45], [300, 0.85], [600, 0.6], [900, 1], [1200, 0.7], [1500, 0.9], [1800, 0.35], [2100, 0],
];

export const PaperSheet: React.FC<PaperSheetProps> = ({
  letter,
  initialObjects = [],
  isSender = false,
  onReplyClick,
  onOpenReplyReference,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Reader-side positions are view state only. PERSIST_READER_POSITIONS is false,
  // so they're never sent anywhere and reset on every open (component remounts).
  const [objects, setObjects] = useState<OrigamiObjectPlacement[]>(initialObjects);
  const [aspect, setAspect] = useState(1.3);
  const [paperWidth, setPaperWidth] = useState(600);
  const [gust, setGust] = useState(0);
  const [cornerJitter, setCornerJitter] = useState<Record<CornerId, number>>({
    'top-left': 1, 'top-right': 1, 'bottom-left': 1, 'bottom-right': 1,
  });

  useLayoutEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) {
        setAspect(height / width);
        setPaperWidth(width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Breeze loop: a gust every 6-14s; paused while the tab is hidden; stops on unmount (letter closed).
  useEffect(() => {
    if (reduced) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    const schedule = () => {
      later(() => {
        if (!alive) return;
        if (document.hidden) return schedule();
        const peak = 0.7 + Math.random() * 0.3;
        setCornerJitter({
          'top-left': 0.8 + Math.random() * 0.2,
          'top-right': 0.8 + Math.random() * 0.2,
          'bottom-left': 0.8 + Math.random() * 0.2,
          'bottom-right': 0.8 + Math.random() * 0.2,
        });
        for (const [t, f] of GUST_KEYFRAMES) later(() => alive && setGust(peak * f), t);
        later(schedule, GUST_KEYFRAMES[GUST_KEYFRAMES.length - 1][0]);
      }, 6000 + Math.random() * 8000);
    };
    schedule();

    const onVis = () => document.hidden && setGust(0);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced]);

  const pins = useMemo(() => computeCornerPins(objects, aspect), [objects, aspect]);
  const lifts = useMemo(() => {
    const out = {} as Record<CornerId, number>;
    for (const id of CORNER_IDS) out[id] = gust * (1 - pins[id]) * cornerJitter[id];
    return out;
  }, [gust, pins, cornerJitter]);

  // Tilt the sheet slightly toward lifting corners (max 3deg).
  const clamp3 = (v: number) => Math.max(-3, Math.min(3, v));
  const top = lifts['top-left'] + lifts['top-right'];
  const bottom = lifts['bottom-left'] + lifts['bottom-right'];
  const left = lifts['top-left'] + lifts['bottom-left'];
  const right = lifts['top-right'] + lifts['bottom-right'];
  const tiltX = clamp3(-(top - bottom) * 1.5);
  const tiltY = clamp3(-(right - left) * 1.5);

  const curlSize = Math.round(Math.max(56, Math.min(120, paperWidth * 0.16)));
  const dateLabel = new Date(letter.deliver_at).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="w-full max-w-2xl mx-auto px-1 sm:px-4 pb-10 perspective-1200">
      {letter.reply_preview && (
        <div className="relative z-30 -mb-6 flex justify-center">
          <ReplyTapedEnvelope
            date={letter.reply_preview.created_at}
            sealSvg={letter.reply_preview.seal_svg}
            sealColor={letter.reply_preview.seal_color}
            onOpen={letter.reply_to ? () => onOpenReplyReference?.(letter.reply_to!) : undefined}
          />
        </div>
      )}

      <motion.article
        ref={paperRef}
        animate={reduced ? undefined : { rotateX: tiltX, rotateY: tiltY }}
        transition={springPresets.breezeCorner}
        className="paper-sheet relative rounded-[4px] px-6 py-10 sm:px-12 sm:py-14 md:px-16 transform-style-3d"
        aria-label={`Letter from ${letter.sender_name ?? ''}`}
      >
        {!reduced && CORNER_IDS.map((id) => <CornerPageCurl key={id} corner={id} lift={lifts[id]} sizePx={curlSize} />)}

        {objects.map((obj, index) => (
          <OrigamiPaperweight
            key={obj.id ?? `obj-${index}`}
            objectId={obj.object_id}
            initialXPct={obj.x_pct}
            initialYPct={obj.y_pct}
            rotationDeg={obj.rotation_deg}
            zIndex={obj.z_index}
            containerRef={paperRef}
            onPositionChange={(x, y) => setObjects((prev) => applyReaderDrag(prev, index, x, y))}
          />
        ))}

        <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between border-b border-stone-200/80 pb-5 mb-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
            {isSender ? `To ${letter.recipient_name ?? ''}` : `From ${letter.sender_name ?? ''}`}
          </p>
          <time dateTime={letter.deliver_at} className="font-serif text-sm text-stone-500">
            {dateLabel}
          </time>
        </header>

        {/* Plain text only. React escapes it; whitespace-pre-wrap keeps line breaks. */}
        <div className="relative z-10 font-serif text-[17px] sm:text-lg leading-[1.75] text-stone-800 whitespace-pre-wrap break-words min-h-[180px]">
          {letter.body}
        </div>

        <footer className="relative z-10 mt-12 flex items-end justify-between gap-4">
          <p className="font-handwriting text-4xl text-stone-900 leading-none">{letter.signature}</p>
          <WaxSeal svg={letter.seal_svg} color={letter.seal_color} size={56} label={`${letter.sender_name ?? ''}'s wax seal`} />
        </footer>
      </motion.article>

      {!isSender && onReplyClick && (
        <div className="mt-6 flex justify-end">
          <motion.button
            type="button"
            onClick={onReplyClick}
            whileTap={{ scale: 0.97 }}
            transition={springPresets.bouncy}
            className="inline-flex items-center gap-2 rounded-full bg-[#F2ECDF] px-5 py-3 text-sm font-medium text-[#17264A] shadow-[0_8px_24px_rgba(5,12,32,0.35)] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2ECDF]"
          >
            Reply
          </motion.button>
        </div>
      )}
    </div>
  );
};
