'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { springPresets } from '@/lib/motion';

export default function SetupPage() {
  const [setupSecret, setSetupSecret] = useState('');
  const [harveyPassword, setHarveyPassword] = useState('');
  const [donnaDefaultPassword, setDonnaDefaultPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    harveyLink: string;
    donnaLink: string;
    message: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    fetch('/api/setup')
      .then((r) => r.json())
      .then((d) => setClosed(Boolean(d.configured)))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setupSecret,
          harveyPassword,
          donnaDefaultPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Setup failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error occurred during setup');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      const fullUrl = `${window.location.origin}${text}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springPresets.gentle}
        className="w-full max-w-lg bg-[#FCFBF9] border border-stone-300 rounded-lg shadow-xl p-8 space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 mx-auto flex items-center justify-center font-serif text-2xl font-bold">
            ✦
          </div>
          <h1 className="font-serif text-2xl text-stone-900 font-medium">
            Private Letters Setup
          </h1>
          <p className="text-xs text-stone-500 font-sans max-w-sm mx-auto">
            One-time initialization for Harvey and Donna. Secret links will be generated and shown exactly once.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded">
            {error}
          </div>
        )}

        {closed && !result ? (
          <div className="p-4 bg-stone-100 border border-stone-200 rounded text-center text-sm text-stone-700">
            Setup is complete and permanently closed.
          </div>
        ) : result ? (
          <div className="space-y-6 pt-2">
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-md space-y-2 text-stone-800">
              <span className="font-sans font-semibold text-xs text-amber-900 block uppercase tracking-wider">
                Setup Complete &amp; Locked
              </span>
              <p className="text-xs leading-relaxed">
                Save both secret links now. This setup page is now permanently disabled and these links cannot be retrieved again from the server.
              </p>
            </div>

            {/* Harvey's Secret Link */}
            <div className="space-y-2 bg-white p-4 rounded border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-900 font-sans">
                  Harvey&apos;s Secret Link:
                </span>
                <button
                  onClick={() => copyToClipboard(result.harveyLink, 'harvey')}
                  className="text-xs text-amber-800 font-sans font-medium hover:underline cursor-pointer"
                >
                  {copiedKey === 'harvey' ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
              <div className="text-xs font-mono bg-stone-50 p-2 rounded text-stone-700 break-all select-all">
                {typeof window !== 'undefined' ? `${window.location.origin}${result.harveyLink}` : result.harveyLink}
              </div>
            </div>

            {/* Donna's Secret Link */}
            <div className="space-y-2 bg-white p-4 rounded border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-900 font-sans">
                  Donna&apos;s Secret Link:
                </span>
                <button
                  onClick={() => copyToClipboard(result.donnaLink, 'donna')}
                  className="text-xs text-amber-800 font-sans font-medium hover:underline cursor-pointer"
                >
                  {copiedKey === 'donna' ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
              <div className="text-xs font-mono bg-stone-50 p-2 rounded text-stone-700 break-all select-all">
                {typeof window !== 'undefined' ? `${window.location.origin}${result.donnaLink}` : result.donnaLink}
              </div>
            </div>

            <div className="pt-2">
              <a
                href={result.harveyLink}
                className="w-full block text-center py-2.5 px-4 rounded-full bg-stone-900 text-stone-100 hover:bg-stone-800 text-xs font-sans font-medium transition-colors"
              >
                Go to Harvey&apos;s Login →
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-sans text-stone-700 mb-1">
                Setup Secret (SETUP_SECRET)
              </label>
              <input
                type="password"
                required
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded text-sm focus:outline-none focus:border-stone-800"
                placeholder="Enter secret from environment"
              />
            </div>

            <div>
              <label className="block text-xs font-sans text-stone-700 mb-1">
                Harvey&apos;s Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={harveyPassword}
                onChange={(e) => setHarveyPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded text-sm focus:outline-none focus:border-stone-800"
                placeholder="Harvey’s personal password"
              />
            </div>

            <div>
              <label className="block text-xs font-sans text-stone-700 mb-1">
                Donna&apos;s Default Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={donnaDefaultPassword}
                onChange={(e) => setDonnaDefaultPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded text-sm focus:outline-none focus:border-stone-800"
                placeholder="Donna will be prompted to change this"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-full bg-stone-900 text-stone-100 hover:bg-stone-800 text-sm font-sans font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Generating secret links…' : 'Initialize & Generate Links'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </main>
  );
}
