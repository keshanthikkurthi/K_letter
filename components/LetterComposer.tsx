'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { OrigamiObjectPlacement, Letter } from '@/lib/types';
import { ORIGAMI_MANIFEST, MAX_OBJECTS_PER_LETTER } from '@/lib/origami';
import { OrigamiPicker } from './OrigamiPicker';
import { OrigamiPaperweight } from './OrigamiPaperweight';
import { WaxSeal } from './WaxSeal';
import { ReplyTapedEnvelope } from './ReplyTapedEnvelope';
import { springPresets } from '@/lib/motion';

interface LetterComposerProps {
  defaultSignature: string;
  senderSealSvg: string | null;
  senderSealColor: string;
  replyToLetter?: Letter | null;
  onOpenOriginal?: (letterId: string) => void;
  onLetterSent: (letterId: string, isScheduled: boolean, deliverAt?: string) => void;
  onCancel: () => void;
}

function localDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const LetterComposer: React.FC<LetterComposerProps> = ({
  defaultSignature,
  senderSealSvg,
  senderSealColor,
  replyToLetter,
  onOpenOriginal,
  onLetterSent,
  onCancel,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState('');
  const [signature, setSignature] = useState(defaultSignature || '');
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState(() => localDateInput(new Date(Date.now() + 86400000)));
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const manifest = ORIGAMI_MANIFEST;
  const [placedObjects, setPlacedObjects] = useState<OrigamiObjectPlacement[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddObject = (objectId: string) => {
    if (placedObjects.length >= MAX_OBJECTS_PER_LETTER) return;
    // Place near one of the corners or center with subtle offset
    const positions = [
      { x: 18, y: 18 },
      { x: 82, y: 22 },
      { x: 80, y: 80 },
    ];
    const pos = positions[placedObjects.length] || { x: 50, y: 50 };

    setPlacedObjects((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        object_id: objectId,
        x_pct: pos.x,
        y_pct: pos.y,
        rotation_deg: Math.floor(Math.random() * 30) - 15,
        z_index: prev.length + 1,
      },
    ]);
  };

  const handleRemoveObject = (index: number) => {
    setPlacedObjects((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePosition = (index: number, xPct: number, yPct: number) => {
    setPlacedObjects((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], x_pct: xPct, y_pct: yPct };
      }
      return next;
    });
  };

  const validateAndPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError('Please write some words before sending your letter.');
      return;
    }
    if (!signature.trim()) {
      setError('Please add your signature.');
      return;
    }

    if (sendMode === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        setError('Please select a date and time for scheduled delivery.');
        return;
      }
      const selected = new Date(`${scheduleDate}T${scheduleTime}`);
      if (selected <= new Date()) {
        setError('Scheduled delivery time must be in the future.');
        return;
      }
    }

    setError(null);
    setShowConfirmModal(true);
  };

  const handleConfirmSend = async () => {
    setSubmitting(true);
    setError(null);

    let deliverAtIso: string | undefined = undefined;
    if (sendMode === 'schedule') {
      deliverAtIso = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    try {
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          signature,
          replyTo: replyToLetter?.id || null,
          deliverAt: deliverAtIso,
          objects: placedObjects,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to dispatch letter');
        setShowConfirmModal(false);
      } else {
        setShowConfirmModal(false);
        onLetterSent(data.letterId, sendMode === 'schedule', deliverAtIso);
      }
    } catch {
      setError('Network error occurred while sending.');
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header and Back Action */}
      <div className="flex items-center justify-between border-b border-stone-200/80 pb-4">
        <div>
          <h2 className="font-serif text-2xl text-stone-900">
            {replyToLetter ? 'Writing a reply' : 'Compose a letter'}
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Take your time. Once sent, letters are permanent and immutable.
          </p>
        </div>

        <button
          onClick={onCancel}
          type="button"
          className="text-xs font-sans text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-full hover:bg-stone-200/60 transition-colors"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-md font-sans">
          {error}
        </div>
      )}

      {/* Origami Paperweight Tray */}
      <OrigamiPicker
        manifest={manifest}
        currentObjects={placedObjects}
        onAddObject={handleAddObject}
        onRemoveObject={handleRemoveObject}
      />

      {/* Small envelope taped to the top of the page */}
      {replyToLetter && (
        <div className="relative z-30 -mb-12 flex justify-center pt-4">
          <ReplyTapedEnvelope
            date={replyToLetter.deliver_at}
            sealSvg={replyToLetter.seal_svg}
            sealColor={replyToLetter.seal_color}
            onOpen={onOpenOriginal ? () => onOpenOriginal(replyToLetter.id) : undefined}
          />
        </div>
      )}

      {/* Paper Sheet Writing Canvas */}
      <div
        ref={paperRef}
        className={`paper-sheet relative rounded-md px-6 py-10 sm:p-12 md:p-16 min-h-[480px] flex flex-col justify-between ${replyToLetter ? 'pt-16 sm:pt-20' : ''}`}
      >
        {/* Placed Origami Paperweights */}
        {placedObjects.map((obj, i) => (
          <OrigamiPaperweight
            key={obj.id}
            objectId={obj.object_id}
            initialXPct={obj.x_pct}
            initialYPct={obj.y_pct}
            rotationDeg={obj.rotation_deg}
            zIndex={i + 1}
            isDraggable={true}
            containerRef={paperRef}
            onPositionChange={(x, y) => handleUpdatePosition(i, x, y)}
          />
        ))}

        <div className="space-y-4">
          <div className="text-xs font-serif uppercase tracking-widest text-stone-400">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>

          <textarea
            required
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your letter here…&#10;&#10;Use plain sentences, thoughtful pauses, and genuine words."
            className="w-full bg-transparent resize-y font-serif text-lg leading-relaxed text-stone-900 placeholder:text-stone-300 focus:outline-none border-none p-0 selection:bg-amber-100"
          />
        </div>

        {/* Signature & Seal Footer */}
        <div className="flex flex-col sm:flex-row items-end justify-between pt-8 border-t border-stone-200/60 mt-8 gap-4">
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] uppercase tracking-wider text-stone-400 font-sans mb-1">
              Your signature
            </label>
            <input
              type="text"
              required
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="bg-transparent border-b border-stone-300 focus:border-stone-800 font-handwriting text-3xl sm:text-4xl text-stone-900 focus:outline-none pb-1 w-48 sm:w-64"
              placeholder="Harvey"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="block text-[10px] uppercase tracking-widest text-stone-400 font-sans">
                Wax Seal
              </span>
              <span className="text-xs text-stone-500 font-serif">
                Sender snapshot
              </span>
            </div>
            <WaxSeal
              svg={senderSealSvg}
              color={senderSealColor}
              size={50}
              label="Sender wax seal preview"
            />
          </div>
        </div>
      </div>

      {/* Sending Controls: Send Now vs Schedule */}
      <form onSubmit={validateAndPrompt} className="bg-[#FAF8F3] border border-stone-200/80 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-sans text-stone-800">
            <input
              type="radio"
              name="sendMode"
              checked={sendMode === 'now'}
              onChange={() => setSendMode('now')}
              className="accent-stone-900"
            />
            <span>Send now</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-sm font-sans text-stone-800">
            <input
              type="radio"
              name="sendMode"
              checked={sendMode === 'schedule'}
              onChange={() => setSendMode('schedule')}
              className="accent-stone-900"
            />
            <span>Schedule for later</span>
          </label>
        </div>

        {sendMode === 'schedule' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-2 border-t border-stone-200/60 flex flex-wrap gap-4 items-center"
          >
            <div>
              <label className="block text-[11px] font-sans text-stone-500 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-stone-300 rounded text-xs text-stone-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-sans text-stone-500 mb-1">
                Time
              </label>
              <input
                type="time"
                required
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="px-3 py-1.5 bg-white border border-stone-300 rounded text-xs text-stone-800 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-stone-500 font-sans self-end pb-1.5">
              Local time (stored in UTC). The recipient cannot see it until this moment.
            </p>
          </motion.div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-full bg-stone-900 text-stone-100 hover:bg-stone-800 text-sm font-sans font-medium transition-all shadow-sm hover:shadow cursor-pointer"
          >
            {sendMode === 'now' ? 'Seal & Send now' : 'Seal & Schedule'}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {/* Spec: "A confirmation dialog says: 'Once sent, a letter can't be edited or deleted.'" */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={springPresets.gentle}
              className="w-full max-w-sm bg-[#FCFBF9] border border-stone-300 rounded-lg p-6 shadow-2xl text-center space-y-4"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-lg font-serif">
                ✉
              </div>
              <h3 className="font-serif text-xl text-stone-900">
                Ready to send?
              </h3>
              <p className="text-xs text-stone-600 font-sans leading-relaxed">
                Once sent, a letter can&apos;t be edited or deleted.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="flex-1 py-2 px-3 rounded border border-stone-300 text-stone-700 text-xs font-sans hover:bg-stone-100 cursor-pointer"
                >
                  Return to letter
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSend}
                  disabled={submitting}
                  className="flex-1 py-2 px-3 rounded bg-stone-900 text-stone-100 text-xs font-sans font-medium hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Sealing…' : 'Yes, send letter'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
