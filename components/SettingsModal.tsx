'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WaxSeal } from './WaxSeal';
import { Person } from '@/lib/types';
import { springPresets } from '@/lib/motion';

interface SettingsModalProps {
  person: Person;
  onClose: () => void;
  onSettingsSaved: (updatedPerson: Partial<Person>) => void;
}

const WAX_PALETTE = [
  { name: 'Imperial Crimson', value: '#8B1E2D' },
  { name: 'Mulberry Wine', value: '#5C2434' },
  { name: 'Forest Emerald', value: '#1F4A38' },
  { name: 'Midnight Navy', value: '#1E2A38' },
  { name: 'Royal Plum', value: '#4A2040' },
  { name: 'Warm Terracotta', value: '#8A4228' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  person,
  onClose,
  onSettingsSaved,
}) => {
  const [signature, setSignature] = useState(person.signature || person.name);
  const [sealColor, setSealColor] = useState(person.seal_color || '#8B1E2D');
  const [sealSvg, setSealSvg] = useState<string | null>(person.seal_svg);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      setErrorMsg('SVG file exceeds maximum allowed size of 200 KB');
      return;
    }
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      setErrorMsg('Please select a valid .svg file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setSealSvg(content);
        setErrorMsg(null);
      }
    };
    reader.readAsText(file);
  };

  const saveSettings = async (extra: { resetSeal?: boolean } = {}) => {
    setSavingSettings(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, sealColor, sealSvg, ...extra }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not save settings.');
      } else {
        // Show exactly what the server stored (sanitized).
        setSealSvg(data.sealSvg ?? null);
        setSuccessMsg('Saved.');
        onSettingsSaved({ signature, seal_color: sealColor, seal_svg: data.sealSvg ?? null });
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch {
      setErrorMsg('Network error while saving.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    void saveSettings();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match');
      return;
    }

    setSavingPassword(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: oldPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to change password');
      } else {
        setSuccessMsg('Password changed successfully. Other sessions have been invalidated.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch {
      setErrorMsg('Network error occurred while changing password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={springPresets.gentle}
          className="relative w-full max-w-lg bg-[#FCFBF9] border border-stone-300 rounded-lg shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 text-lg p-1.5 rounded-full transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            ✕
          </button>

          <h3 className="font-serif text-2xl text-stone-900 mb-1">
            Settings &amp; Seal
          </h3>
          <p className="text-xs text-stone-500 font-sans mb-6">
            Configure your personalized wax seal, signature, and security.
          </p>

          {errorMsg && (
            <div className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded">
              {successMsg}
            </div>
          )}

          {/* Wax Seal Customizer Form */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label className="block text-xs uppercase tracking-wider font-sans font-semibold text-stone-700 mb-2">
                Wax Seal &amp; Color
              </label>

              <div className="flex items-center gap-6 p-4 rounded-lg bg-[#FAF8F3] border border-stone-200">
                <div className="flex flex-col items-center gap-2">
                  <WaxSeal svg={sealSvg} color={sealColor} size={64} label="Seal preview" />
                  <span className="text-[10px] text-stone-400 font-sans">Live preview</span>
                </div>

                <div className="space-y-3 flex-1">
                  <div>
                    <span className="text-xs text-stone-600 font-sans block mb-1.5">
                      Select wax color
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {WAX_PALETTE.map((pal) => (
                        <button
                          key={pal.value}
                          type="button"
                          onClick={() => setSealColor(pal.value)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                            sealColor === pal.value ? 'scale-115 border-stone-900 shadow-xs' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: pal.value }}
                          title={pal.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-stone-600 font-sans mb-1">
                      Upload custom SVG seal (max 200 KB)
                    </label>
                    <input
                      id="seal-upload"
                      type="file"
                      accept=".svg,image/svg+xml"
                      onChange={handleFileUpload}
                      className="block w-full text-xs text-stone-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-sans file:bg-stone-200 file:text-stone-800 hover:file:bg-stone-300 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => void saveSettings({ resetSeal: true })}
                      disabled={savingSettings}
                      className="mt-2 text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900 disabled:opacity-50"
                    >
                      Use my default seal
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Default Signature */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-sans font-semibold text-stone-700 mb-1">
                Default Signature
              </label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded font-handwriting text-3xl text-stone-900 focus:outline-none focus:border-stone-800"
                placeholder="Your signature"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded bg-stone-900 text-stone-100 text-xs font-sans font-medium hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? 'Saving…' : 'Save profile & seal'}
              </button>
            </div>
          </form>

          {/* Change Password Section */}
          <div className="mt-8 pt-6 border-t border-stone-200">
            <h4 className="text-xs uppercase tracking-wider font-sans font-semibold text-stone-700 mb-3">
              Change Password
            </h4>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs text-stone-600 font-sans mb-1">
                  Current password
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded text-xs focus:outline-none"
                  placeholder="Enter current password"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-600 font-sans mb-1">
                    New password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded text-xs focus:outline-none"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 font-sans mb-1">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded text-xs focus:outline-none"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-2 rounded bg-stone-800 text-stone-100 text-xs font-sans font-medium hover:bg-stone-700 disabled:opacity-50 cursor-pointer"
                >
                  {savingPassword ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
