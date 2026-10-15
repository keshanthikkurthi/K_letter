import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Person,
  Letter,
  OrigamiObjectPlacement,
  PasswordResetRequest,
  PersonSlug,
} from './types';
import { decryptSecret, encryptSecret, hashPassword, hashToken, sanitizeSvg } from './security';
import { sanitizePlacements } from './origami';

/*
 * Data layer. Every function here runs server-side only (route handlers).
 *
 * Two backends with identical semantics:
 *  - Supabase Postgres via the service-role key (production).
 *  - An in-memory store for local development and the test suite. It mirrors
 *    the SQL constraints, including the letter immutability trigger.
 */

export const LIMITS = {
  bodyMaxChars: 20000,
  signatureMaxChars: 80,
  passwordMinChars: 8,
  passwordMaxChars: 200,
  resetTtlMs: 24 * 60 * 60 * 1000,
  resetsPerHour: 3,
  loginMaxFailures: 5,
  loginLockMs: 15 * 60 * 1000,
};

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_DB !== 'true') {
      // Serverless instances don't share memory: running without a database in
      // production would silently lose letters.
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production.');
    }
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseInstance;
}

// ============================================================================
// In-memory backend
// ============================================================================

type MemReset = PasswordResetRequest & { token_encrypted: string; banner_dismissed: boolean };

interface MemoryStore {
  isConfigured: boolean;
  people: Map<string, Person>;
  loginAttempts: Array<{ person_id: string; ip_address: string; attempted_at: string; success: boolean }>;
  passwordResets: Map<string, MemReset>; // token_hash -> row
  letters: Map<string, Letter>;
  letterObjects: Map<string, OrigamiObjectPlacement[]>;
}

// Kept on globalThis so dev hot-reloads don't wipe it.
const g = globalThis as unknown as { __plMemoryStore?: MemoryStore };
const mem: MemoryStore =
  g.__plMemoryStore ??
  (g.__plMemoryStore = {
    isConfigured: false,
    people: new Map(),
    loginAttempts: [],
    passwordResets: new Map(),
    letters: new Map(),
    letterObjects: new Map(),
  });

const IMMUTABLE_LETTER_FIELDS: (keyof Letter)[] = [
  'id', 'sender_id', 'recipient_id', 'body', 'signature', 'reply_to',
  'deliver_at', 'created_at', 'seal_svg', 'seal_color',
];

/**
 * JS mirror of the SQL trigger fn_letters_immutable: the only allowed change
 * is setting first_opened_at once (NULL -> timestamp). Throws otherwise.
 */
export function assertLetterUpdateAllowed(oldRow: Letter, newRow: Letter): void {
  for (const f of IMMUTABLE_LETTER_FIELDS) {
    if ((oldRow[f] ?? null) !== (newRow[f] ?? null)) {
      throw new Error(`Letters are immutable: "${String(f)}" cannot be changed.`);
    }
  }
  if (oldRow.first_opened_at !== newRow.first_opened_at) {
    if (oldRow.first_opened_at !== null || newRow.first_opened_at === null) {
      throw new Error('Letters are immutable: first_opened_at can only be set once.');
    }
  }
}

function memUpdateLetter(id: string, patch: Partial<Letter>): void {
  const old = mem.letters.get(id);
  if (!old) throw new Error('Letter not found');
  const next = { ...old, ...patch };
  assertLetterUpdateAllowed(old, next);
  mem.letters.set(id, next);
}

/** Mirror of the DELETE half of the trigger. Exists so tests can prove it. */
export function memDeleteLetter(_id: string): never {
  throw new Error('Letters are permanent and immutable: letters cannot be deleted.');
}

// Test-only hooks (not reachable from any route).
export const __testing = {
  expireReset(rawToken: string) {
    const row = mem.passwordResets.get(hashToken(rawToken));
    if (row) row.expires_at = new Date(Date.now() - 1000).toISOString();
  },
  getStoredLetter(id: string) {
    const l = mem.letters.get(id);
    return l ? { ...l } : undefined;
  },
  getStoredObjects(id: string) {
    return (mem.letterObjects.get(id) ?? []).map((o) => ({ ...o }));
  },
};

// ============================================================================
// Default seal
// ============================================================================

export function getDefaultSealSvg(initial: string): string {
  const safe = initial.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() || '✦';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.55)" stroke-width="2" stroke-dasharray="2 4"/>
    <circle cx="50" cy="50" r="36" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>
    <text x="50" y="64" font-family="Georgia, 'Times New Roman', serif" font-size="42" font-weight="700" fill="rgba(255,255,255,0.92)" text-anchor="middle">${safe}</text>
  </svg>`.trim();
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// ============================================================================
// Setup
// ============================================================================

export async function isSystemConfigured(): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('setup_state').select('value').eq('key', 'is_configured').maybeSingle();
    if (data?.value === 'true') return true;
    const { count } = await sb.from('people').select('id', { count: 'exact', head: true });
    return (count ?? 0) > 0;
  }
  return mem.isConfigured;
}

export async function setupSystem(params: {
  harveyPassword: string;
  donnaDefaultPassword: string;
  harveyToken: string;
  donnaToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (await isSystemConfigured()) {
    return { ok: false, error: 'Setup has already been completed and is permanently disabled.' };
  }

  const base = (slug: PersonSlug, name: string, token: string, pwHash: string, color: string, mustPrompt: boolean) => ({
    slug,
    name,
    token_hash: hashToken(token),
    password_hash: pwHash,
    session_version: 1,
    must_prompt_change: mustPrompt,
    seal_svg: getDefaultSealSvg(name[0]),
    seal_color: color,
    signature: name,
  });

  const harvey = base('harvey', 'Harvey', params.harveyToken, await hashPassword(params.harveyPassword), '#8B1E2D', false);
  const donna = base('donna', 'Donna', params.donnaToken, await hashPassword(params.donnaDefaultPassword), '#5C2434', true);

  const sb = getSupabase();
  if (sb) {
    // Lock first: the primary key on setup_state makes a concurrent second setup fail here.
    const { error: lockErr } = await sb.from('setup_state').insert({ key: 'is_configured', value: 'true' });
    if (lockErr) return { ok: false, error: 'Setup has already been completed.' };

    const { error } = await sb.from('people').insert([harvey, donna]);
    if (error) {
      await sb.from('setup_state').delete().eq('key', 'is_configured');
      return { ok: false, error: 'Could not create people. Check that the migration ran.' };
    }
    return { ok: true };
  }

  const now = new Date().toISOString();
  mem.people.set('person-harvey-id', { id: 'person-harvey-id', created_at: now, ...harvey });
  mem.people.set('person-donna-id', { id: 'person-donna-id', created_at: now, ...donna });
  mem.isConfigured = true;
  return { ok: true };
}

// ============================================================================
// People & auth
// ============================================================================

export async function getPersonByToken(token: string): Promise<Person | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = hashToken(token);
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('people').select('*').eq('token_hash', tokenHash).maybeSingle();
    return (data as Person) ?? null;
  }
  for (const p of mem.people.values()) if (p.token_hash === tokenHash) return { ...p };
  return null;
}

export async function getPersonById(id: string): Promise<Person | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('people').select('*').eq('id', id).maybeSingle();
    return (data as Person) ?? null;
  }
  const p = mem.people.get(id);
  return p ? { ...p } : null;
}

export async function getOtherPerson(currentPersonId: string): Promise<Person | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('people').select('*').neq('id', currentPersonId).limit(1).maybeSingle();
    return (data as Person) ?? null;
  }
  for (const p of mem.people.values()) if (p.id !== currentPersonId) return { ...p };
  return null;
}

/** Fields that are safe to send to the browser (no hashes). */
export function publicProfile(p: Person) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    signature: p.signature,
    seal_svg: p.seal_svg,
    seal_color: p.seal_color,
    must_prompt_change: p.must_prompt_change,
  };
}

export async function checkBruteForceLock(personId: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LIMITS.loginLockMs).toISOString();
  const sb = getSupabase();
  if (sb) {
    const { count } = await sb
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)
      .eq('ip_address', ip)
      .eq('success', false)
      .gte('attempted_at', since);
    return (count ?? 0) >= LIMITS.loginMaxFailures;
  }
  const failures = mem.loginAttempts.filter(
    (a) => a.person_id === personId && a.ip_address === ip && !a.success && a.attempted_at >= since
  );
  return failures.length >= LIMITS.loginMaxFailures;
}

export async function recordLoginAttempt(personId: string, ip: string, success: boolean): Promise<void> {
  const row = { person_id: personId, ip_address: ip, attempted_at: new Date().toISOString(), success };
  const sb = getSupabase();
  if (sb) {
    await sb.from('login_attempts').insert(row);
    return;
  }
  mem.loginAttempts.push(row);
}

async function patchPerson(personId: string, patch: Partial<Person>): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('people').update(patch).eq('id', personId);
    return !error;
  }
  const p = mem.people.get(personId);
  if (!p) return false;
  Object.assign(p, patch);
  return true;
}

/** Changes one person's password and invalidates all their existing sessions. */
export async function changePassword(personId: string, newPlainPassword: string): Promise<number | null> {
  const person = await getPersonById(personId);
  if (!person) return null;
  const nextVersion = (person.session_version || 1) + 1;
  const ok = await patchPerson(personId, {
    password_hash: await hashPassword(newPlainPassword),
    session_version: nextVersion,
    must_prompt_change: false,
  });
  return ok ? nextVersion : null;
}

export async function dismissPromptChange(personId: string): Promise<boolean> {
  return patchPerson(personId, { must_prompt_change: false });
}

// ============================================================================
// Password reset (trust-based: the link is shown to the OTHER person)
// ============================================================================

export async function createPasswordResetRequest(
  personId: string,
  rawToken: string
): Promise<{ ok: boolean; error?: string }> {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const row = {
    person_id: personId,
    token_hash: hashToken(rawToken),
    token_encrypted: encryptSecret(rawToken),
    banner_dismissed: false,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + LIMITS.resetTtlMs).toISOString(),
    used: false,
    used_at: null as string | null,
  };

  const sb = getSupabase();
  if (sb) {
    const { count } = await sb
      .from('password_resets')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)
      .gte('created_at', oneHourAgo);
    if ((count ?? 0) >= LIMITS.resetsPerHour) return { ok: false, error: 'rate_limited' };

    // A new request invalidates any earlier unused one.
    await sb.from('password_resets').update({ used: true }).eq('person_id', personId).eq('used', false);
    const { error } = await sb.from('password_resets').insert(row);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const recent = [...mem.passwordResets.values()].filter((r) => r.person_id === personId && r.created_at >= oneHourAgo);
  if (recent.length >= LIMITS.resetsPerHour) return { ok: false, error: 'rate_limited' };
  for (const r of mem.passwordResets.values()) if (r.person_id === personId && !r.used) r.used = true;
  mem.passwordResets.set(row.token_hash, { id: `reset-${now}-${Math.random().toString(36).slice(2, 7)}`, ...row });
  return { ok: true };
}

/** Banner for the viewer: an active reset requested by the OTHER person. */
export async function getActiveResetBannerForViewer(
  viewerPersonId: string
): Promise<{ id: string; targetName: string; token: string; expiresAt: string } | null> {
  const other = await getOtherPerson(viewerPersonId);
  if (!other) return null;
  const nowIso = new Date().toISOString();

  let row: { id: string; token_encrypted: string; expires_at: string } | null = null;
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from('password_resets')
      .select('id, token_encrypted, expires_at')
      .eq('person_id', other.id)
      .eq('used', false)
      .eq('banner_dismissed', false)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data;
  } else {
    for (const r of mem.passwordResets.values()) {
      if (r.person_id === other.id && !r.used && !r.banner_dismissed && r.expires_at > nowIso) row = r;
    }
  }
  if (!row) return null;
  const token = decryptSecret(row.token_encrypted);
  if (!token) return null;
  return { id: row.id, targetName: other.name, token, expiresAt: row.expires_at };
}

export async function dismissResetBanner(viewerPersonId: string): Promise<void> {
  const other = await getOtherPerson(viewerPersonId);
  if (!other) return;
  const sb = getSupabase();
  if (sb) {
    await sb.from('password_resets').update({ banner_dismissed: true }).eq('person_id', other.id).eq('used', false);
    return;
  }
  for (const r of mem.passwordResets.values()) if (r.person_id === other.id && !r.used) r.banner_dismissed = true;
}

export async function getResetRequestByToken(
  token: string
): Promise<{ request: PasswordResetRequest; person: Person } | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from('password_resets')
      .select('id, person_id, token_hash, created_at, expires_at, used, used_at')
      .eq('token_hash', tokenHash)
      .eq('used', false)
      .gt('expires_at', nowIso)
      .maybeSingle();
    if (!data) return null;
    const person = await getPersonById(data.person_id);
    return person ? { request: data as PasswordResetRequest, person } : null;
  }
  const r = mem.passwordResets.get(tokenHash);
  if (!r || r.used || r.expires_at <= nowIso) return null;
  const person = mem.people.get(r.person_id);
  return person ? { request: { ...r }, person: { ...person } } : null;
}

export async function completePasswordReset(
  token: string,
  newPassword: string,
  setByOtherPerson: boolean
): Promise<{ ok: boolean; targetName?: string; error?: string }> {
  const found = await getResetRequestByToken(token);
  if (!found) return { ok: false, error: 'This reset link is invalid, expired or already used.' };
  const { request, person } = found;
  const nowIso = new Date().toISOString();

  const sb = getSupabase();
  if (sb) {
    // Claim the token atomically: only one request can flip used=false -> true.
    const { data: claimed } = await sb
      .from('password_resets')
      .update({ used: true, used_at: nowIso })
      .eq('id', request.id)
      .eq('used', false)
      .select('id');
    if (!claimed || claimed.length === 0) return { ok: false, error: 'This reset link was already used.' };
  } else {
    const r = mem.passwordResets.get(request.token_hash);
    if (!r || r.used) return { ok: false, error: 'This reset link was already used.' };
    r.used = true;
    r.used_at = nowIso;
  }

  const ok = await patchPerson(person.id, {
    password_hash: await hashPassword(newPassword),
    session_version: (person.session_version || 1) + 1,
    must_prompt_change: setByOtherPerson,
  });
  return ok ? { ok: true, targetName: person.name } : { ok: false, error: 'Could not update password.' };
}

// ============================================================================
// Letters
// ============================================================================

export async function createLetter(params: {
  senderId: string;
  recipientId: string;
  body: string;
  signature: string;
  replyTo?: string | null;
  deliverAt?: string;
  objects?: unknown;
}): Promise<{ ok: boolean; letterId?: string; deliverAt?: string; error?: string }> {
  const sender = await getPersonById(params.senderId);
  if (!sender) return { ok: false, error: 'Sender not found.' };

  const body = String(params.body ?? '').replace(/\r\n/g, '\n').trim();
  const signature = String(params.signature ?? '').trim();
  if (!body) return { ok: false, error: 'A letter needs some words.' };
  if (body.length > LIMITS.bodyMaxChars) return { ok: false, error: `Letters are limited to ${LIMITS.bodyMaxChars} characters.` };
  if (!signature) return { ok: false, error: 'Please sign your letter.' };
  if (signature.length > LIMITS.signatureMaxChars) return { ok: false, error: 'Signature is too long.' };

  const now = new Date();
  let deliverAt = now.toISOString();
  if (params.deliverAt) {
    const d = new Date(params.deliverAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid delivery date.' };
    if (d.getTime() <= now.getTime()) return { ok: false, error: 'A scheduled time must be in the future.' };
    deliverAt = d.toISOString();
  }

  if (params.replyTo) {
    const original = await getLetterRaw(params.replyTo);
    // Replies only to delivered letters that the other person sent to me.
    if (
      !original ||
      original.sender_id !== params.recipientId ||
      original.recipient_id !== params.senderId ||
      new Date(original.deliver_at) > now
    ) {
      return { ok: false, error: 'You can only reply to a delivered letter you received.' };
    }
  }

  const objects = sanitizePlacements(params.objects);
  const sealSvg = sender.seal_svg || getDefaultSealSvg(sender.name[0]);
  const sealColor = sender.seal_color || '#8B1E2D';

  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('letters')
      .insert({
        sender_id: params.senderId,
        recipient_id: params.recipientId,
        body,
        signature,
        reply_to: params.replyTo || null,
        deliver_at: deliverAt,
        seal_svg: sealSvg,
        seal_color: sealColor,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: 'Could not send the letter.' };

    if (objects.length) {
      const { error: objErr } = await sb.from('letter_objects').insert(objects.map((o) => ({ ...o, letter_id: data.id })));
      if (objErr) console.error('letter_objects insert failed', objErr.message);
    }
    return { ok: true, letterId: data.id, deliverAt };
  }

  const id = `letter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  mem.letters.set(id, {
    id,
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    body,
    signature,
    reply_to: params.replyTo || null,
    deliver_at: deliverAt,
    created_at: now.toISOString(),
    first_opened_at: null,
    seal_svg: sealSvg,
    seal_color: sealColor,
  });
  mem.letterObjects.set(id, objects.map((o, i) => ({ ...o, id: `obj-${id}-${i}`, letter_id: id })));
  return { ok: true, letterId: id, deliverAt };
}

async function getLetterRaw(letterId: string): Promise<Letter | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('letters').select('*').eq('id', letterId).maybeSingle();
    return (data as Letter) ?? null;
  }
  return mem.letters.get(letterId) ?? null;
}

async function nameMap(): Promise<Map<string, Person>> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('people').select('*');
    return new Map(((data as Person[]) ?? []).map((p) => [p.id, p]));
  }
  return new Map(mem.people);
}

/**
 * Mailbox listing. Recipient-side queries ALWAYS filter deliver_at <= now(),
 * so a scheduled letter is never returned to its recipient early.
 */
export async function getLettersForMailbox(personId: string): Promise<{ forYou: Letter[]; read: Letter[]; sent: Letter[] }> {
  const nowIso = new Date().toISOString();
  const people = await nameMap();
  let received: Letter[] = [];
  let sent: Letter[] = [];

  const sb = getSupabase();
  if (sb) {
    const [r, s] = await Promise.all([
      sb.from('letters').select('*').eq('recipient_id', personId).lte('deliver_at', nowIso).order('deliver_at', { ascending: false }),
      sb.from('letters').select('*').eq('sender_id', personId).order('created_at', { ascending: false }),
    ]);
    received = (r.data as Letter[]) ?? [];
    sent = (s.data as Letter[]) ?? [];
  } else {
    for (const l of mem.letters.values()) {
      if (l.recipient_id === personId && l.deliver_at <= nowIso) received.push(l);
      if (l.sender_id === personId) sent.push(l);
    }
    received.sort((a, b) => b.deliver_at.localeCompare(a.deliver_at));
    sent.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const decorate = (l: Letter): Letter => ({
    ...l,
    sender_name: people.get(l.sender_id)?.name,
    sender_slug: people.get(l.sender_id)?.slug,
    recipient_name: people.get(l.recipient_id)?.name,
  });

  return {
    forYou: received.filter((l) => !l.first_opened_at).map(decorate),
    read: received.filter((l) => l.first_opened_at).map(decorate),
    sent: sent.map(decorate),
  };
}

/**
 * Single letter for a viewer. Returns null (-> 404) for strangers and for
 * recipients when the letter isn't delivered yet. Marks first_opened_at once.
 */
export async function getLetterDetails(
  letterId: string,
  viewerPersonId: string,
  opts: { markOpened?: boolean } = {}
): Promise<{ letter: Letter; objects: OrigamiObjectPlacement[] } | null> {
  const letter = await getLetterRaw(letterId);
  if (!letter) return null;

  const isRecipient = letter.recipient_id === viewerPersonId;
  const isSender = letter.sender_id === viewerPersonId;
  if (!isRecipient && !isSender) return null;
  if (isRecipient && new Date(letter.deliver_at) > new Date()) return null;

  let firstOpenedAt = letter.first_opened_at;
  if (opts.markOpened && isRecipient && !firstOpenedAt) {
    const nowIso = new Date().toISOString();
    const sb = getSupabase();
    if (sb) {
      await sb.from('letters').update({ first_opened_at: nowIso }).eq('id', letterId).is('first_opened_at', null);
    } else {
      memUpdateLetter(letterId, { first_opened_at: nowIso });
    }
    firstOpenedAt = nowIso;
  }

  let objects: OrigamiObjectPlacement[];
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('letter_objects').select('*').eq('letter_id', letterId).order('z_index', { ascending: true });
    objects = (data as OrigamiObjectPlacement[]) ?? [];
  } else {
    objects = (mem.letterObjects.get(letterId) ?? []).map((o) => ({ ...o }));
  }

  const people = await nameMap();
  let replyPreview: Letter['reply_preview'] = null;
  if (letter.reply_to) {
    const orig = await getLetterRaw(letter.reply_to);
    if (orig) {
      replyPreview = {
        id: orig.id,
        sender_name: people.get(orig.sender_id)?.name ?? '',
        created_at: orig.deliver_at,
        body_snippet: orig.body.slice(0, 140) + (orig.body.length > 140 ? '…' : ''),
        seal_svg: orig.seal_svg,
        seal_color: orig.seal_color,
      };
    }
  }

  return {
    letter: {
      ...letter,
      first_opened_at: firstOpenedAt,
      sender_name: people.get(letter.sender_id)?.name,
      sender_slug: people.get(letter.sender_id)?.slug,
      recipient_name: people.get(letter.recipient_id)?.name,
      reply_preview: replyPreview,
    },
    objects,
  };
}

// ============================================================================
// Settings
// ============================================================================

export async function updatePersonSettings(
  personId: string,
  params: { sealSvg?: string | null; sealColor?: string; signature?: string }
): Promise<{ ok: boolean; sealSvg?: string | null; error?: string }> {
  const patch: Partial<Person> = {};

  if (params.sealColor !== undefined) {
    if (!HEX_COLOR.test(params.sealColor)) return { ok: false, error: 'Wax color must be a hex value like #8B1E2D.' };
    patch.seal_color = params.sealColor;
  }
  if (params.signature !== undefined) {
    const s = String(params.signature).trim();
    if (!s) return { ok: false, error: 'Signature cannot be empty.' };
    if (s.length > LIMITS.signatureMaxChars) return { ok: false, error: 'Signature is too long.' };
    patch.signature = s;
  }
  if (params.sealSvg) {
    const res = sanitizeSvg(params.sealSvg);
    if (!res.ok || !res.sanitized) return { ok: false, error: res.error || 'Invalid SVG.' };
    patch.seal_svg = res.sanitized;
  }

  const ok = await patchPerson(personId, patch);
  if (!ok) return { ok: false, error: 'Could not save settings.' };
  const updated = await getPersonById(personId);
  return { ok: true, sealSvg: updated?.seal_svg ?? null };
}

export async function resetSealToDefault(personId: string): Promise<string | null> {
  const p = await getPersonById(personId);
  if (!p) return null;
  const svg = getDefaultSealSvg(p.name[0]);
  await patchPerson(personId, { seal_svg: svg });
  return svg;
}
