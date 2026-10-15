'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { springPresets } from '@/lib/motion';

interface FirstLoginPopupProps {
  personName: string;
  onDismiss: () => void;
  onPasswordChanged: () => void;
}

export const FirstLoginPopup: React.FC<FirstLoginPopupProps> = ({
  personName,
  onDismiss,
  onPasswordChanged,
}) => {
  const [mode, setMode] = useState<'prompt' | 'changing'>('prompt');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleKeepIt = async () => {
    try {
      await fetch('/api/auth/dismiss-prompt', { method: 'POST' });
    } catch {}
    onDismiss();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update password');
      } else {
        onPasswordChanged();
      }
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={springPresets.gentle}
        className="w-full max-w-md bg-[#FCFBF9] border border-stone-300 rounded-lg p-6 sm:p-8 shadow-2xl relative"
      >
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3 font-serif font-bold text-lg">
            ✦
          </div>
          <h3 className="font-serif text-xl text-stone-900">
            Welcome, {personName}
          </h3>
          <p className="text-xs text-stone-600 font-sans mt-1">
            Do you want to change your password?
          </p>
        </div>

        {mode === 'prompt' ? (
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => setMode('changing')}
              className="w-full py-2.5 px-4 rounded-md bg-stone-900 text-stone-100 hover:bg-stone-800 text-sm font-sans font-medium transition-colors cursor-pointer"
            >
              Change it
            </button>
            <button
              onClick={handleKeepIt}
              className="w-full py-2.5 px-4 rounded-md bg-stone-100 text-stone-700 hover:bg-stone-200 text-sm font-sans font-medium transition-colors cursor-pointer"
            >
              Keep it
            </button>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4 pt-1">
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-sans text-stone-600 mb-1">
                New password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-800"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="block text-xs font-sans text-stone-600 mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-800"
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('prompt')}
                className="flex-1 py-2 px-3 rounded border border-stone-300 text-stone-600 text-xs font-sans hover:bg-stone-100"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-3 rounded bg-stone-900 text-stone-100 text-xs font-sans font-medium hover:bg-stone-800 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Save new password'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
