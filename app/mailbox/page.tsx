'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Letter, OrigamiObjectPlacement, Person } from '@/lib/types';
import { MailboxTabs } from '@/components/MailboxTabs';
import { EnvelopeView } from '@/components/EnvelopeView';
import { LetterComposer } from '@/components/LetterComposer';
import { SendAnimation } from '@/components/SendAnimation';
import { SettingsModal } from '@/components/SettingsModal';
import { FirstLoginPopup } from '@/components/FirstLoginPopup';
import { ResetBanner } from '@/components/ResetBanner';
import { ReplyEnvelopeModal } from '@/components/ReplyEnvelopeModal';

export default function MailboxPage() {
  const router = useRouter();

  // Authentication & Profile state
  const [profile, setProfile] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  // Mailbox Collections state
  const [forYou, setForYou] = useState<Letter[]>([]);
  const [read, setRead] = useState<Letter[]>([]);
  const [sent, setSent] = useState<Letter[]>([]);
  const [resetBanner, setResetBanner] = useState<{
    id: string;
    targetName: string;
    token: string;
    expiresAt: string;
  } | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'mailbox' | 'reading' | 'writing'>('mailbox');

  // Currently open letter (when reading)
  const [activeLetter, setActiveLetter] = useState<Letter | null>(null);
  const [activeObjects, setActiveObjects] = useState<OrigamiObjectPlacement[]>([]);
  const [isReRead, setIsReRead] = useState(false);

  // Reply reference modal
  const [replyReferenceId, setReplyReferenceId] = useState<string | null>(null);

  // Replying context for composer
  const [replyTargetLetter, setReplyTargetLetter] = useState<Letter | null>(null);

  // Send animation state
  const [sendAnimationData, setSendAnimationData] = useState<{
    active: boolean;
    isScheduled: boolean;
    deliverAt?: string;
  } | null>(null);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  // First login popup
  const [showFirstLoginPopup, setShowFirstLoginPopup] = useState(false);

  // 1. Fetch current profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setProfile(data);
      if (data.must_prompt_change) {
        setShowFirstLoginPopup(true);
      }
    } catch {
      router.push('/');
    }
  }, [router]);

  // 2. Fetch mailbox letters & reset banner
  const fetchMailbox = useCallback(async () => {
    try {
      const res = await fetch('/api/letters');
      if (res.ok) {
        const data = await res.json();
        setForYou(data.forYou || []);
        setRead(data.read || []);
        setSent(data.sent || []);
        setResetBanner(data.resetBanner || null);
      }
    } catch {}
  }, []);

  // Initialize and run periodic inbox polling (every 35s per spec)
  useEffect(() => {
    // setState runs only after awaited fetches resolve, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfile().then(() => {
      fetchMailbox().finally(() => setLoading(false));
    });

    const interval = setInterval(() => {
      fetchMailbox();
    }, 35000);

    return () => clearInterval(interval);
  }, [fetchProfile, fetchMailbox]);

  // Open letter action
  const handleOpenLetter = async (letterId: string) => {
    try {
      const res = await fetch(`/api/letters/${letterId}`);
      if (!res.ok) return;
      const data = await res.json();

      setActiveLetter(data.letter);
      setActiveObjects(data.objects || []);
      setIsReRead(Boolean(data.letter.first_opened_at) || Boolean(data.isSender));
      setViewMode('reading');
    } catch {}
  };

  // First open: record first_opened_at (once) when the seal is actually broken.
  const handleBreakSeal = (letterId: string) => {
    fetch(`/api/letters/${letterId}?open=1`)
      .then(() => fetchMailbox())
      .catch(() => {});
  };

  // Reply button clicked from within a letter
  const handleInitiateReply = () => {
    if (!activeLetter) return;
    setReplyTargetLetter(activeLetter);
    setViewMode('writing');
  };

  // Write new fresh letter
  const handleStartCompose = () => {
    setReplyTargetLetter(null);
    setViewMode('writing');
  };

  // Letter sent successfully callback
  const handleLetterSent = (_letterId: string, isScheduled: boolean, deliverAt?: string) => {
    setViewMode('mailbox');
    setSendAnimationData({
      active: true,
      isScheduled,
      deliverAt,
    });
    fetchMailbox();
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/');
  };

  // Dismiss reset banner
  const handleDismissBanner = async () => {
    try {
      await fetch('/api/resets/dismiss', { method: 'POST' });
    } catch {}
    setResetBanner(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3 font-serif">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-stone-500 font-sans tracking-wide">
            Opening your desk…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4 sm:px-6 relative">
      {/* Reset request banner if other person requested a password reset */}
      {resetBanner && (
        <div className="max-w-3xl mx-auto">
          <ResetBanner
            targetName={resetBanner.targetName}
            token={resetBanner.token}
            onDismiss={handleDismissBanner}
          />
        </div>
      )}

      {/* Main View Switching */}
      {viewMode === 'mailbox' && profile && (
        <MailboxTabs
          forYou={forYou}
          read={read}
          sent={sent}
          onOpenLetter={handleOpenLetter}
          onWriteClick={handleStartCompose}
          onSettingsClick={() => setShowSettings(true)}
          onLogoutClick={handleLogout}
          currentPersonName={profile.name}
        />
      )}

      {viewMode === 'reading' && activeLetter && profile && (
        <EnvelopeView
          key={activeLetter.id}
          letter={activeLetter}
          objects={activeObjects}
          isReRead={isReRead}
          isSender={activeLetter.sender_id === profile.id}
          onBack={() => {
            setViewMode('mailbox');
            setActiveLetter(null);
          }}
          onReplyClick={handleInitiateReply}
          onOpenReplyReference={(id) => setReplyReferenceId(id)}
          onBreakSeal={() => handleBreakSeal(activeLetter.id)}
        />
      )}

      {viewMode === 'writing' && profile && (
        <LetterComposer
          defaultSignature={profile.signature || profile.name}
          senderSealSvg={profile.seal_svg}
          senderSealColor={profile.seal_color}
          replyToLetter={replyTargetLetter}
          onOpenOriginal={(id) => setReplyReferenceId(id)}
          onLetterSent={handleLetterSent}
          onCancel={() => {
            setViewMode('mailbox');
            setReplyTargetLetter(null);
          }}
        />
      )}

      {/* Send Animation Overlay */}
      {sendAnimationData?.active && profile && (
        <SendAnimation
          sealSvg={profile.seal_svg}
          sealColor={profile.seal_color}
          isScheduled={sendAnimationData.isScheduled}
          deliverAt={sendAnimationData.deliverAt}
          onFinished={() => setSendAnimationData(null)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && profile && (
        <SettingsModal
          person={profile}
          onClose={() => setShowSettings(false)}
          onSettingsSaved={(updated) => {
            setProfile((prev) => (prev ? { ...prev, ...updated } : null));
          }}
        />
      )}

      {/* First login prompt for Donna or post-reset */}
      {showFirstLoginPopup && profile && (
        <FirstLoginPopup
          personName={profile.name}
          onDismiss={() => setShowFirstLoginPopup(false)}
          onPasswordChanged={() => {
            setShowFirstLoginPopup(false);
            fetchProfile();
          }}
        />
      )}

      {/* Reply Reference Letter Modal */}
      {replyReferenceId && (
        <ReplyEnvelopeModal
          letterId={replyReferenceId}
          onClose={() => setReplyReferenceId(null)}
        />
      )}
    </main>
  );
}
