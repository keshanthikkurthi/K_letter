'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { springPresets } from '@/lib/motion';

export default function SecretLoginPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid login link or password.');
      } else {
        router.push('/mailbox');
      }
    } catch {
      setError('An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      await res.json();
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
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
          {/* Elegant Sealed Stamp Icon */}
          <div className="w-12 h-12 rounded-full bg-[#8B1E2D] text-white mx-auto flex items-center justify-center font-serif text-xl shadow-md">
            ✦
          </div>
          <h1 className="font-serif text-2xl text-stone-900 font-medium">
            Private Letters
          </h1>
          <p className="text-xs text-stone-500 font-sans">
            Enter your secret password to unlock your desk.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded font-sans leading-relaxed">
            {error}
          </div>
        )}

        {forgotSent ? (
          <div className="p-4 bg-stone-100 border border-stone-200 rounded text-center space-y-2">
            <p className="text-xs text-stone-800 font-sans font-medium">
              Your request was sent.
            </p>
            <p className="text-[11px] text-stone-500 font-sans leading-relaxed">
              A private reset link will appear inside the other person&apos;s unlocked mailbox. They can reset your password or share the link with you.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-sans text-stone-600 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-full bg-stone-900 text-stone-100 hover:bg-stone-800 text-xs font-sans font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Unlocking…' : 'Unlock desk →'}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="text-xs text-stone-500 hover:text-stone-800 font-sans hover:underline cursor-pointer"
              >
                {forgotLoading ? 'Sending request…' : 'Forgot password?'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </main>
  );
}
