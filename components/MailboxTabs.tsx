'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Letter } from '@/lib/types';
import { WaxSeal } from './WaxSeal';
import { springPresets } from '@/lib/motion';

interface MailboxTabsProps {
  forYou: Letter[];
  read: Letter[];
  sent: Letter[];
  onOpenLetter: (letterId: string) => void;
  onWriteClick: () => void;
  onSettingsClick: () => void;
  onLogoutClick: () => void;
  currentPersonName: string;
}

type TabKey = 'forYou' | 'read' | 'sent';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** A sealed envelope card. Used for unopened letters and the sender's scheduled ones. */
function EnvelopeCard({ letter, title, caption, onOpen, index }: { letter: Letter; title: string; caption: string; onOpen: () => void; index: number }) {
  return (
    <motion.button
      type="button"
      layout
      onClick={onOpen}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springPresets.gentle, delay: index * 0.04 }}
      whileHover={{ y: -3, rotate: -0.4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative w-full aspect-[16/10] rounded-[4px] bg-[#EDE6D8] text-left shadow-[0_2px_6px_rgba(35,25,20,0.08),0_12px_28px_rgba(35,25,20,0.08)] hover:shadow-[0_4px_10px_rgba(35,25,20,0.1),0_20px_40px_rgba(35,25,20,0.12)] transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-800"
    >
      <svg viewBox="0 0 320 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <polygon points="0,200 320,200 160,105" fill="#E6DECD" />
        <polygon points="0,0 320,0 160,112" fill="#E1D7C4" />
        <polyline points="0,0 160,112 320,0" fill="none" stroke="#D2C6AF" strokeWidth="1" />
      </svg>
      <span className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2">
        <WaxSeal svg={letter.seal_svg} color={letter.seal_color} size={48} />
      </span>
      <span className="absolute inset-x-4 bottom-3 flex items-baseline justify-between gap-2">
        <span className="font-serif text-[15px] text-stone-800">{title}</span>
        <span className="text-xs text-stone-500">{caption}</span>
      </span>
    </motion.button>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300/80 px-6 py-16 text-center">
      <p className="font-serif text-lg text-stone-700">{title}</p>
      <p className="mt-1 text-sm text-stone-500">{body}</p>
    </div>
  );
}

export const MailboxTabs: React.FC<MailboxTabsProps> = ({
  forYou,
  read,
  sent,
  onOpenLetter,
  onWriteClick,
  onSettingsClick,
  onLogoutClick,
  currentPersonName,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('forYou');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'forYou', label: 'For you', count: forYou.length },
    { key: 'read', label: 'Read', count: read.length },
    { key: 'sent', label: 'Sent', count: sent.length },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="flex items-center justify-between gap-3 pb-6">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Letters</h1>
          <p className="mt-0.5 text-sm text-stone-500">{currentPersonName}&rsquo;s desk</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSettingsClick}
            className="rounded-full px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-stone-800"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onLogoutClick}
            className="rounded-full px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-stone-800"
          >
            Lock
          </button>
        </div>
      </header>

      <motion.button
        type="button"
        onClick={onWriteClick}
        whileTap={{ scale: 0.98 }}
        transition={springPresets.bouncy}
        className="mb-8 flex w-full items-center justify-between rounded-lg bg-stone-900 px-5 py-4 text-left text-stone-50 shadow-sm hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
      >
        <span className="font-serif text-lg">Write a letter</span>
        <span aria-hidden className="text-stone-400">→</span>
      </motion.button>

      <div role="tablist" aria-label="Mailbox" className="flex gap-6 border-b border-stone-200">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-stone-800 ${active ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-800'}`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-stone-900 text-stone-50' : 'bg-stone-200 text-stone-600'}`}>
                  {tab.count}
                </span>
              )}
              {active && <motion.span layoutId="tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 bg-stone-900" transition={springPresets.snappy} />}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={activeTab}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={springPresets.gentle}
          className="pt-6"
        >
          {activeTab === 'forYou' &&
            (forYou.length === 0 ? (
              <Empty title="Nothing new on your desk" body="New letters appear here, sealed, until you open them." />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {forYou.map((l, i) => (
                  <EnvelopeCard key={l.id} index={i} letter={l} title={`From ${l.sender_name ?? ''}`} caption={fmtDate(l.deliver_at)} onOpen={() => onOpenLetter(l.id)} />
                ))}
              </div>
            ))}

          {activeTab === 'read' &&
            (read.length === 0 ? (
              <Empty title="No opened letters yet" body="Letters you open stay here to re-read any time." />
            ) : (
              <ul className="space-y-3">
                {read.map((l, i) => (
                  <motion.li key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springPresets.gentle, delay: i * 0.03 }}>
                    <button
                      type="button"
                      onClick={() => onOpenLetter(l.id)}
                      className="paper-sheet flex w-full items-center gap-4 rounded-[4px] px-5 py-4 text-left hover:-translate-y-0.5 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline justify-between gap-3">
                          <span className="font-serif text-stone-900">From {l.sender_name}</span>
                          <span className="shrink-0 text-xs text-stone-500">{fmtDate(l.deliver_at)}</span>
                        </p>
                        <p className="mt-1 truncate font-serif text-sm text-stone-600">{l.body}</p>
                      </div>
                      <WaxSeal svg={l.seal_svg} color={l.seal_color} size={30} cracked />
                    </button>
                  </motion.li>
                ))}
              </ul>
            ))}

          {activeTab === 'sent' &&
            (sent.length === 0 ? (
              <Empty title="You haven’t sent anything yet" body="Letters you send, including scheduled ones, are kept here." />
            ) : (
              <div className="space-y-6">
                {sent.some((l) => new Date(l.deliver_at).getTime() > now) && (
                  <div>
                    <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-stone-500">On their way</h2>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {sent
                        .filter((l) => new Date(l.deliver_at).getTime() > now)
                        .map((l, i) => (
                          <EnvelopeCard key={l.id} index={i} letter={l} title={`To ${l.recipient_name ?? ''}`} caption={`Arrives on ${fmtDateTime(l.deliver_at)}`} onOpen={() => onOpenLetter(l.id)} />
                        ))}
                    </div>
                  </div>
                )}
                <ul className="space-y-3">
                  {sent
                    .filter((l) => new Date(l.deliver_at).getTime() <= now)
                    .map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => onOpenLetter(l.id)}
                          className="paper-sheet flex w-full items-center gap-4 rounded-[4px] px-5 py-4 text-left hover:-translate-y-0.5 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex items-baseline justify-between gap-3">
                              <span className="font-serif text-stone-900">To {l.recipient_name}</span>
                              <span className="shrink-0 text-xs text-stone-500">
                                {fmtDate(l.deliver_at)}
                                {l.first_opened_at ? ' · opened' : ''}
                              </span>
                            </p>
                            <p className="mt-1 truncate font-serif text-sm text-stone-600">{l.body}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
        </motion.section>
      </AnimatePresence>
    </div>
  );
};
