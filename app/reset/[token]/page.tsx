'use client';

import React, { useState, useEffect, use } from 'react';
import { motion } from 'motion/react';
import { springPresets } from '@/lib/motion';

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [invalidMsg, setInvalidMsg] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error || !data.valid) {
          setInvalidMsg(data.error || 'This reset link is invalid or has expired.');
        } else {
          setTargetName(data.targetName);
        }
      })
      .catch(() => {
        setInvalidMsg('Failed to check reset link status.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
      } else {
        setCompleted(true);
      }
    } catch {
      setError('Network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springPresets.gentle}
        className="w-full max-w-sm bg-[#FCFBF9] border border-stone-300 rounded-lg shadow-xl p-8 space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 mx-auto flex items-center justify-center font-serif text-xl">
            🔑
          </div>
          <h1 className="font-serif text-2xl text-stone-900 font-medium">
            {targetName ? `Set a new password for ${targetName}` : 'Reset password'}
          </h1>
          {targetName && (
            <p className="text-xs text-stone-500 font-sans">
              This link works once. Nobody is signed in by it.
            </p>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 font-sans">
            Verifying single-use link…
          </div>
        ) : invalidMsg ? (
          <div className="p-4 bg-stone-100 border border-stone-200 rounded text-center space-y-2">
            <p className="text-xs text-red-700 font-sans font-medium">
              Link unavailable
            </p>
            <p className="text-[11px] text-stone-500 font-sans leading-relaxed">
              {invalidMsg}
            </p>
          </div>
        ) : completed ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-center space-y-3">
            <p className="text-xs text-emerald-900 font-sans font-medium">
              Password has been successfully reset.
            </p>
            <p className="text-[11px] text-emerald-700 font-sans">
              The recipient can now use their secret link with this new password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-2.5 text-xs bg-red-50 border border-red-200 text-red-800 rounded">
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
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-xs font-sans text-stone-600 mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                placeholder="Confirm password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-full bg-stone-900 text-stone-100 hover:bg-stone-800 text-xs font-sans font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Updating…' : 'Set new password'}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  );
}
