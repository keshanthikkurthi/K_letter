import Link from 'next/link';
import { isSystemConfigured } from '@/lib/db';

export default async function HomePage() {
  const isConfigured = await isSystemConfigured();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-8 p-8">
        {/* Wax Seal Symbol */}
        <div className="w-16 h-16 rounded-full bg-[#8B1E2D] text-amber-100 mx-auto flex items-center justify-center font-serif text-2xl shadow-xl border border-white/20 select-none">
          ✦
        </div>

        <div className="space-y-3">
          <h1 className="font-serif text-3xl sm:text-4xl text-stone-900 font-normal tracking-tight">
            Private Letters
          </h1>
          <p className="text-xs uppercase tracking-widest text-stone-500 font-sans">
            Harvey &amp; Donna
          </p>
          <p className="text-sm font-serif text-stone-600 leading-relaxed max-w-xs mx-auto pt-2">
            A quiet sanctuary for written correspondence. Letters are permanent, personal, and delivered with intention.
          </p>
        </div>

        <div className="pt-4 border-t border-stone-200/80">
          {!isConfigured ? (
            <div className="space-y-3">
              <p className="text-xs text-amber-900 font-sans bg-amber-50 border border-amber-200/70 p-3 rounded-md">
                System requires initial one-time configuration.
              </p>
              <Link
                href="/setup"
                className="inline-block py-2.5 px-6 rounded-full bg-stone-900 text-stone-100 hover:bg-stone-800 text-xs font-sans font-medium transition-colors shadow-sm"
              >
                Begin Setup →
              </Link>
            </div>
          ) : (
            <p className="text-xs text-stone-400 font-sans">
              Protected desk. Please open your secret link to read or write.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
