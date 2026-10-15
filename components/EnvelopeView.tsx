'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
import type { Letter, OrigamiObjectPlacement } from '@/lib/types';
import { scrollRiseSpring, springPresets } from '@/lib/motion';
import { WaxSeal } from './WaxSeal';
import { PaperSheet } from './PaperSheet';
import { LetterStageBackdrop } from './LetterStageBackdrop';

interface EnvelopeViewProps {
  letter: Letter;
  objects?: OrigamiObjectPlacement[];
  /** Already opened before: replay a shorter version automatically. */
  isReRead?: boolean;
  isSender?: boolean;
  onBack?: () => void;
  onReplyClick?: () => void;
  onOpenReplyReference?: (id: string) => void;
  /** Fired when the seal is broken (first open). */
  onBreakSeal?: () => void;
}

// Envelope geometry. The envelope's top edge sits at 58vh and runs off the bottom of the screen.
const ENV_W = 'min(92vw, 760px)';
const ENV_TOP_VH = 58;
const FLAP_H = `calc(${ENV_W} * 0.32)`;
const POCKET_TOP = `calc(${ENV_W} * 0.06)`;
const PAPER_PEEK = 0.035; // paper top sits just above the pocket edge (fraction of envelope width)
const PAPER_W = 'min(calc(100vw - 2.5rem), 640px)';
const PAPER_FINAL_TOP_VH = 9;

const CRACK_MS = 480; // seal cracks before the flap moves
const FLAP_SWAP_MS = 380; // flap has passed 90deg: drop it behind the paper
const IDLE_MS = 2200; // no scroll input for this long -> the letter keeps rising on its own

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export const EnvelopeView: React.FC<EnvelopeViewProps> = ({
  letter,
  objects = [],
  isReRead = false,
  isSender = false,
  onBack,
  onReplyClick,
  onOpenReplyReference,
  onBreakSeal,
}) => {
  const reduced = Boolean(useReducedMotion());
  // Sender viewing their own still-scheduled letter: stays sealed with an arrival label.
  const [scheduled] = useState(() => isSender && new Date(letter.deliver_at).getTime() > Date.now());
  const [revealed, setRevealed] = useState(() => reduced && isReRead && !scheduled);
  const [started, setStarted] = useState(() => isReRead && !scheduled);
  const progress = useMotionValue(revealed ? 1 : 0);

  // Navy page colour while the letter is open (avoids a light flash on overscroll).
  useEffect(() => {
    document.body.classList.add('is-reading');
    return () => document.body.classList.remove('is-reading');
  }, []);

  const reveal = () => {
    progress.set(1);
    setRevealed(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="letter-stage relative">
      <LetterStageBackdrop progress={progress} />

      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between p-4">
        {onBack ? (
          <button type="button" onClick={onBack} className="stage-pill pointer-events-auto">
            ← Back to desk
          </button>
        ) : (
          <span />
        )}
        {started && !revealed && (
          <button type="button" onClick={reveal} className="stage-pill pointer-events-auto">
            Skip
          </button>
        )}
      </div>

      {revealed ? (
        <motion.div
          initial={{ opacity: reduced ? 0 : 0.85 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: 0.25 } : springPresets.gentle}
          className="relative pt-[calc(9vh-2rem)]"
        >
          <PaperSheet
            letter={letter}
            initialObjects={objects}
            isSender={isSender}
            onReplyClick={onReplyClick}
            onOpenReplyReference={onOpenReplyReference}
          />
        </motion.div>
      ) : (
        <EnvelopeOpening
          letter={letter}
          isSender={isSender}
          isReRead={isReRead}
          scheduled={scheduled}
          reduced={reduced}
          progress={progress}
          onStarted={() => {
            setStarted(true);
            onBreakSeal?.();
          }}
          onRevealed={reveal}
        />
      )}
    </div>
  );
};

type OpenStage = 'sealed' | 'cracking' | 'flap' | 'open';

interface OpeningProps {
  letter: Letter;
  isSender: boolean;
  isReRead: boolean;
  scheduled: boolean;
  reduced: boolean;
  progress: MotionValue<number>;
  onStarted: () => void;
  onRevealed: () => void;
}

/**
 * Sealed envelope at the bottom of the screen. Tap the seal: it cracks, the flap swings up,
 * then the letter rises out of the pocket tied to scrolling. If the reader doesn't scroll,
 * the page scrolls itself with a soft spring (any wheel/touch/key input takes over again).
 */
function EnvelopeOpening({ letter, isSender, isReRead, scheduled, reduced, progress, onStarted, onRevealed }: OpeningProps) {
  const [stage, setStage] = useState<OpenStage>(isReRead && !scheduled ? 'open' : 'sealed');
  const sectionRef = useRef<HTMLElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const done = useRef(false);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const gate = useMotionValue(isReRead && !scheduled ? 1 : 0);
  const rawRise = useTransform(() => gate.get() * scrollYProgress.get());
  const rise = useSpring(rawRise, scrollRiseSpring);

  useMotionValueEvent(rise, 'change', (v) => {
    progress.set(Math.min(1, Math.max(0, v)));
    if (v > 0.985 && !done.current) {
      done.current = true;
      onRevealed();
    }
  });

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Once open: link to scroll, and auto-scroll after a short idle period.
  useEffect(() => {
    if (stage !== 'open') return;
    gate.set(1);
    const firstDelay = isReRead ? 250 : 1400;
    let lastInput = Date.now() - (IDLE_MS - firstDelay);
    let controls: ReturnType<typeof animate> | null = null;

    const takeOver = () => {
      lastInput = Date.now();
      controls?.stop();
      controls = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) takeOver();
    };
    window.addEventListener('wheel', takeOver, { passive: true });
    window.addEventListener('touchstart', takeOver, { passive: true });
    window.addEventListener('keydown', onKey);

    const tick = setInterval(() => {
      if (controls || done.current || document.hidden) return;
      if (Date.now() - lastInput < IDLE_MS) return;
      const el = sectionRef.current;
      if (!el) return;
      const end = el.getBoundingClientRect().top + window.scrollY + el.offsetHeight - window.innerHeight;
      controls = animate(window.scrollY, end, {
        ...(isReRead ? springPresets.letterRiseReRead : springPresets.letterRise),
        onUpdate: (v) => window.scrollTo(0, v),
        onComplete: () => {
          controls = null;
        },
      });
    }, 200);

    return () => {
      clearInterval(tick);
      controls?.stop();
      window.removeEventListener('wheel', takeOver);
      window.removeEventListener('touchstart', takeOver);
      window.removeEventListener('keydown', onKey);
    };
  }, [stage, isReRead, gate]);

  const breakSeal = () => {
    if (stage !== 'sealed' || scheduled) return;
    onStarted();
    if (reduced) {
      onRevealed();
      return;
    }
    setStage('cracking');
    timers.current.push(setTimeout(() => setStage('flap'), CRACK_MS));
    timers.current.push(setTimeout(() => setStage('open'), CRACK_MS + FLAP_SWAP_MS));
  };

  const flapOpen = stage === 'flap' || stage === 'open';
  const flapInFront = stage !== 'open';
  const sealVisible = stage === 'sealed' || stage === 'cracking';

  const headOpacity = useTransform(rise, [0, 0.3], [1, 0]);
  const headY = useTransform(rise, [0, 0.3], ['0vh', '-6vh']);
  const hintOpacity = useTransform(rise, [0, 0.06], [1, 0]);
  const envY = useTransform(rise, [0.5, 1], ['0vh', '36vh']);
  const envOpacity = useTransform(rise, [0.78, 1], [1, 0]);
  const paperScale = useTransform(rise, [0, 1], [0.94, 1]);
  const paperY = useTransform(rise, (v) => {
    const p = Math.min(1, Math.max(0, v));
    const vh = (ENV_TOP_VH - PAPER_FINAL_TOP_VH) * p;
    return `calc(${(-vh).toFixed(3)}vh - ${(PAPER_PEEK * p).toFixed(4)} * ${ENV_W})`;
  });

  const kicker = isSender ? `To ${letter.recipient_name ?? ''}` : `For ${letter.recipient_name ?? 'you'}`;
  const title = isSender ? 'Your letter' : `A letter from ${letter.sender_name ?? ''}`;

  const envLayer = (z: number, children: React.ReactNode) => (
    <motion.div
      style={{ y: envY, opacity: envOpacity, zIndex: z, top: `${ENV_TOP_VH}vh` }}
      className="pointer-events-none absolute inset-x-0 flex justify-center"
    >
      <div className="relative h-[60vh]" style={{ width: ENV_W, perspective: 1400 }}>
        {children}
      </div>
    </motion.div>
  );

  return (
    <section
      ref={sectionRef}
      className="relative -mx-4 -mt-8 select-none sm:-mx-6"
      style={{ height: stage === 'open' ? '260vh' : '100vh' }}
      aria-label={`${title}, ${fmtDate(letter.deliver_at)}`}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Headline */}
        <motion.header
          style={{ opacity: headOpacity, y: headY }}
          className="absolute inset-x-0 top-[15vh] px-6 text-center"
        >
          <p className="font-handwriting text-xl uppercase tracking-[0.12em] text-[#E7DDC6]/80 sm:text-2xl">{kicker}</p>
          <h1 className="stage-title mx-auto mt-2 max-w-4xl font-serif text-[clamp(2.4rem,7.2vw,5.6rem)] leading-[1.02] tracking-tight">
            {title}
          </h1>
          <p className="mt-4 text-sm tracking-wide text-[#CFC6B2]/75">
            {fmtDate(letter.deliver_at)}
            {letter.reply_to ? ' · in reply to your letter' : ''}
          </p>
        </motion.header>

        {/* Hint above the envelope */}
        <motion.div style={{ opacity: hintOpacity }} className="absolute inset-x-0 top-[49vh] text-center">
          {scheduled ? (
            <p className="font-serif text-[15px] text-[#E7DDC6]/85">
              Arrives on {new Date(letter.deliver_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          ) : stage === 'sealed' ? (
            <button
              type="button"
              onClick={breakSeal}
              className="rounded-full px-5 py-2.5 text-sm text-[#E7DDC6]/85 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#E7DDC6]"
            >
              Tap the seal to open
            </button>
          ) : stage === 'open' ? (
            <p className="flex flex-col items-center gap-1 text-sm text-[#E7DDC6]/80">
              Scroll to draw it out
              <motion.span
                aria-hidden
                animate={reduced ? undefined : { y: [0, 5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                ↓
              </motion.span>
            </p>
          ) : null}
        </motion.div>

        {/* Envelope back (inside of the pocket) */}
        {envLayer(
          10,
          <div className="absolute inset-0 rounded-t-[6px] bg-[#C9B98F] shadow-[0_30px_80px_rgba(5,10,30,0.55)]">
            <div className="absolute inset-0 rounded-t-[6px] bg-gradient-to-b from-black/15 via-transparent to-transparent" />
          </div>
        )}

        {/* Flap: in front while closed, swings up and drops behind the paper once open */}
        {envLayer(
          flapInFront ? 40 : 15,
          <motion.div
            initial={false}
            animate={{ rotateX: flapOpen ? 180 : 0 }}
            transition={springPresets.envelope}
            style={{ transformOrigin: 'top center', transformStyle: 'preserve-3d', height: FLAP_H }}
            className="absolute inset-x-0 top-0"
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="backface-hidden absolute inset-0 h-full w-full drop-shadow-[0_6px_10px_rgba(60,40,10,0.25)]" aria-hidden>
              <polygon points="0,0 100,0 50,100" fill="#D3C39A" />
              <polyline points="0,0 50,100 100,0" fill="none" stroke="#B8A57A" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
            </svg>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="backface-hidden absolute inset-0 h-full w-full" style={{ transform: 'rotateX(180deg)' }} aria-hidden>
              <polygon points="0,0 100,0 50,100" fill="#BFAE84" />
            </svg>
          </motion.div>
        )}

        {/* The letter, rising out of the pocket */}
        <div className="absolute inset-x-0 z-20 flex justify-center" style={{ top: `calc(${ENV_TOP_VH}vh + ${PAPER_PEEK} * ${ENV_W})` }}>
          <motion.div
            style={{ y: paperY, scale: paperScale, width: PAPER_W, transformOrigin: 'top center' }}
            className="paper-sheet relative h-[72vh] overflow-hidden rounded-[4px] px-6 py-10 sm:px-12 sm:py-14 md:px-16"
            aria-hidden
          >
            <div className="mb-8 flex flex-col gap-1 border-b border-stone-200/80 pb-5 sm:flex-row sm:items-baseline sm:justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
                {isSender ? `To ${letter.recipient_name ?? ''}` : `From ${letter.sender_name ?? ''}`}
              </p>
              <p className="font-serif text-sm text-stone-500">{fmtDate(letter.deliver_at)}</p>
            </div>
            <div className="whitespace-pre-wrap break-words font-serif text-[17px] leading-[1.75] text-stone-800 sm:text-lg">
              {letter.body}
            </div>
            <div className="stage-paper-fade pointer-events-none absolute inset-x-0 bottom-0 h-28" />
          </motion.div>
        </div>

        {/* Pocket front, in front of the paper */}
        {envLayer(
          30,
          <div
            className="absolute inset-x-0 bottom-0 bg-[#DCCDA6] shadow-[0_-10px_24px_rgba(60,40,10,0.18)]"
            style={{ top: POCKET_TOP }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              <polyline points="0,0 2.5,18 2.5,100" fill="none" stroke="#BCA97E" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <polyline points="100,0 97.5,18 97.5,100" fill="none" stroke="#BCA97E" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1="2.5" y1="18" x2="97.5" y2="18" stroke="#C6B48A" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        )}

        {/* Wax seal on the flap tip */}
        {envLayer(
          50,
          <AnimatePresence>
            {sealVisible && (
              <motion.div
                key="seal"
                className="pointer-events-auto absolute left-1/2"
                style={{ top: FLAP_H, marginLeft: -32, marginTop: -32 }}
                animate={{ scale: stage === 'cracking' ? 1.1 : 1 }}
                exit={{ opacity: 0, scale: 0.7, y: 12 }}
                transition={springPresets.bouncy}
              >
                <WaxSeal
                  svg={letter.seal_svg}
                  color={letter.seal_color}
                  size={64}
                  cracked={stage === 'cracking'}
                  interactive={stage === 'sealed' && !scheduled}
                  onClick={breakSeal}
                  label={scheduled ? 'Sealed until delivery' : 'Break the seal to open'}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
