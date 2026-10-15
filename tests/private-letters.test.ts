import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  setupSystem,
  createLetter,
  getLettersForMailbox,
  getLetterDetails,
  createPasswordResetRequest,
  getResetRequestByToken,
  completePasswordReset,
  changePassword,
  getPersonById,
  assertLetterUpdateAllowed,
  memDeleteLetter,
  getActiveResetBannerForViewer,
  __testing,
} from '../lib/db';
import * as db from '../lib/db';
import {
  sanitizeSvg,
  generateSecureToken,
  createSessionToken,
  verifySessionToken,
  isSessionCurrent,
} from '../lib/security';
import { applyReaderDrag, computeCornerPins, PERSIST_READER_POSITIONS } from '../lib/origami';
import type { Letter, OrigamiObjectPlacement } from '../lib/types';

const HARVEY = 'person-harvey-id';
const DONNA = 'person-donna-id';
const ROOT = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

before(async () => {
  const res = await setupSystem({
    harveyPassword: 'harvey-password-1',
    donnaDefaultPassword: 'donna-default-1',
    harveyToken: generateSecureToken(),
    donnaToken: generateSecureToken(),
  });
  assert.equal(res.ok, true);
});

describe('1. Letter immutability', () => {
  it('SQL migration installs a trigger that rejects DELETE and any UPDATE except first_opened_at once', () => {
    const sql = readFileSync(path.join(ROOT, 'supabase/migration.sql'), 'utf8');
    assert.match(sql, /CREATE TRIGGER trg_letters_immutable\s+BEFORE UPDATE OR DELETE ON letters/);
    assert.match(sql, /IF TG_OP = 'DELETE' THEN\s+RAISE EXCEPTION/);
    assert.match(sql, /OLD\.first_opened_at IS NULL AND NEW\.first_opened_at IS NOT NULL/);
    assert.match(sql, /ALTER TABLE letters ENABLE ROW LEVEL SECURITY/);
    assert.doesNotMatch(sql, /DROP TABLE/i, 'migration must never drop tables (would delete letters)');
  });

  it('trigger logic: edits to body/signature/deliver_at/seal are rejected; first_opened_at only once', () => {
    const base: Letter = {
      id: 'x', sender_id: HARVEY, recipient_id: DONNA, body: 'hi', signature: 'H', reply_to: null,
      deliver_at: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z', first_opened_at: null,
      seal_svg: '<svg></svg>', seal_color: '#8B1E2D',
    };
    assert.throws(() => assertLetterUpdateAllowed(base, { ...base, body: 'edited' }), /immutable/);
    assert.throws(() => assertLetterUpdateAllowed(base, { ...base, signature: 'X' }), /immutable/);
    assert.throws(() => assertLetterUpdateAllowed(base, { ...base, deliver_at: '2027-01-01T00:00:00.000Z' }), /immutable/);
    assert.throws(() => assertLetterUpdateAllowed(base, { ...base, seal_color: '#000000' }), /immutable/);
    const opened = { ...base, first_opened_at: '2026-01-02T00:00:00.000Z' };
    assert.doesNotThrow(() => assertLetterUpdateAllowed(base, opened));
    assert.throws(() => assertLetterUpdateAllowed(opened, { ...opened, first_opened_at: '2026-02-02T00:00:00.000Z' }), /once/);
    assert.throws(() => assertLetterUpdateAllowed(opened, { ...opened, first_opened_at: null }), /once/);
    assert.throws(() => memDeleteLetter('x'), /cannot be deleted/);
  });

  it('no edit/delete exists: data layer exports none, and letter routes export only GET/POST', () => {
    const names = Object.keys(db);
    assert.ok(!names.some((n) => /^(update|edit|delete|remove)Letter/i.test(n)), `unexpected export in db: ${names.join(', ')}`);
    const routes = walk(path.join(ROOT, 'app/api/letters')).filter((f) => f.endsWith('route.ts'));
    for (const file of routes) {
      const src = readFileSync(file, 'utf8');
      assert.doesNotMatch(src, /export async function (PUT|PATCH|DELETE)/, `${file} must not expose PUT/PATCH/DELETE`);
    }
  });

  it('opening a letter sets first_opened_at once and leaves content untouched', async () => {
    const { letterId } = await createLetter({ senderId: HARVEY, recipientId: DONNA, body: 'Original words.', signature: 'Harvey' });
    const before = __testing.getStoredLetter(letterId!)!;
    await getLetterDetails(letterId!, DONNA, { markOpened: true });
    const first = __testing.getStoredLetter(letterId!)!;
    assert.ok(first.first_opened_at);
    await getLetterDetails(letterId!, DONNA, { markOpened: true });
    const second = __testing.getStoredLetter(letterId!)!;
    assert.equal(second.first_opened_at, first.first_opened_at);
    assert.equal(second.body, before.body);
    assert.equal(second.signature, before.signature);
  });
});

describe('2. Undelivered letters are never returned to the recipient', () => {
  it('scheduled letter is absent from recipient mailbox and detail, present in sender Sent', async () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const res = await createLetter({ senderId: HARVEY, recipientId: DONNA, body: 'Tomorrow.', signature: 'Harvey', deliverAt: future });
    assert.equal(res.ok, true);
    const id = res.letterId!;

    const donna = await getLettersForMailbox(DONNA);
    const all = [...donna.forYou, ...donna.read, ...donna.sent];
    assert.equal(all.find((l) => l.id === id), undefined);
    assert.ok(!JSON.stringify(donna).includes('Tomorrow.'), 'body must not leak in any field');

    assert.equal(await getLetterDetails(id, DONNA), null);
    assert.equal(await getLetterDetails(id, DONNA, { markOpened: true }), null);
    assert.equal(__testing.getStoredLetter(id)!.first_opened_at, null, 'cannot be marked opened early');

    const harvey = await getLettersForMailbox(HARVEY);
    assert.ok(harvey.sent.find((l) => l.id === id));
    assert.ok(await getLetterDetails(id, HARVEY));
  });

  it('rejects scheduling in the past and replies to undelivered letters', async () => {
    const past = await createLetter({ senderId: HARVEY, recipientId: DONNA, body: 'x', signature: 'H', deliverAt: new Date(Date.now() - 60000).toISOString() });
    assert.equal(past.ok, false);

    const future = await createLetter({ senderId: HARVEY, recipientId: DONNA, body: 'later', signature: 'H', deliverAt: new Date(Date.now() + 3600000).toISOString() });
    const reply = await createLetter({ senderId: DONNA, recipientId: HARVEY, body: 'peek', signature: 'D', replyTo: future.letterId });
    assert.equal(reply.ok, false, 'cannot reply to a letter that has not arrived');

    const own = await createLetter({ senderId: HARVEY, recipientId: DONNA, body: 'mine', signature: 'H' });
    const selfReply = await createLetter({ senderId: HARVEY, recipientId: DONNA, body: 'r', signature: 'H', replyTo: own.letterId });
    assert.equal(selfReply.ok, false, 'cannot reply to your own letter');
  });
});

describe('3. Reset links are single-use and expire', () => {
  it('works once, then fails forever', async () => {
    const token = generateSecureToken();
    assert.equal((await createPasswordResetRequest(DONNA, token)).ok, true);
    assert.ok(await getResetRequestByToken(token));
    assert.equal((await completePasswordReset(token, 'donna-new-pass-1', true)).ok, true);
    assert.equal(await getResetRequestByToken(token), null);
    assert.equal((await completePasswordReset(token, 'donna-other-pass', true)).ok, false);
  });

  it('setting it on the other person’s behalf turns on must_prompt_change and bumps session_version', async () => {
    const before = (await getPersonById(DONNA))!;
    const token = generateSecureToken();
    await createPasswordResetRequest(DONNA, token);
    await completePasswordReset(token, 'donna-pass-2xx', true);
    const after = (await getPersonById(DONNA))!;
    assert.equal(after.must_prompt_change, true);
    assert.equal(after.session_version, before.session_version + 1);
  });

  it('expired links are rejected', async () => {
    const token = generateSecureToken();
    await createPasswordResetRequest(HARVEY, token);
    __testing.expireReset(token);
    assert.equal(await getResetRequestByToken(token), null);
    assert.equal((await completePasswordReset(token, 'harvey-new-pass', false)).ok, false);
  });

  it('a new request invalidates the earlier one; banner shows only to the other person', async () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    // Fresh person window: Harvey has used 1 of 3 this hour above.
    await createPasswordResetRequest(HARVEY, a);
    await createPasswordResetRequest(HARVEY, b);
    assert.equal(await getResetRequestByToken(a), null, 'older request invalidated');
    assert.ok(await getResetRequestByToken(b));

    const forDonna = await getActiveResetBannerForViewer(DONNA);
    assert.equal(forDonna?.token, b);
    assert.equal(forDonna?.targetName, 'Harvey');
    const forHarvey = await getActiveResetBannerForViewer(HARVEY);
    assert.notEqual(forHarvey?.token, b, 'requester never sees their own link');
  });

  it('rate-limited to 3 requests per hour per person', async () => {
    const r = await createPasswordResetRequest(HARVEY, generateSecureToken());
    assert.equal(r.ok, false);
  });
});

describe('4. Sessions are invalidated after a password change', () => {
  it('old JWT no longer matches session_version', async () => {
    const harvey = (await getPersonById(HARVEY))!;
    const oldToken = await createSessionToken({ personId: HARVEY, slug: 'harvey', name: 'Harvey', sessionVersion: harvey.session_version });
    const payload = await verifySessionToken(oldToken);
    assert.ok(isSessionCurrent(payload, harvey.session_version));

    const newVersion = await changePassword(HARVEY, 'harvey-brand-new');
    assert.equal(newVersion, harvey.session_version + 1);
    const updated = (await getPersonById(HARVEY))!;
    assert.equal(isSessionCurrent(payload, updated.session_version), false);

    const donna = (await getPersonById(DONNA))!;
    assert.notEqual(donna.password_hash, updated.password_hash, 'other person unaffected');
  });

  it('tampered tokens are rejected', async () => {
    const t = await createSessionToken({ personId: HARVEY, slug: 'harvey', name: 'Harvey', sessionVersion: 1 });
    const tampered = t.slice(0, -2) + (t.endsWith('a') ? 'bb' : 'aa');
    assert.equal(await verifySessionToken(tampered), null);
  });
});

describe('5. SVG sanitization', () => {
  it('strips scripts, handlers, foreignObject, external refs and javascript: URLs', () => {
    const dirty = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" onload="alert(1)">
        <circle cx="50" cy="50" r="40" fill="red" onclick='steal()' />
        <script>alert('xss')</script><script src="https://evil.example/x.js"/>
        <foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>
        <a href="javascript:steal()"><text>x</text></a>
        <image href="https://evil.example/track.png" />
        <use xlink:href="https://evil.example/sprite.svg#a" />
        <use href="#local" />
        <rect style="fill:url(https://evil.example/p)" />
        <set attributeName="href" to="javascript:alert(1)" />
        <scr<script>x</script>ipt>alert(2)</script>
      </svg>`;
    const r = sanitizeSvg(dirty);
    assert.equal(r.ok, true);
    const s = r.sanitized!;
    for (const bad of ['<script', 'onload', 'onclick', 'foreignObject', 'javascript:', 'evil.example', '<set', 'ENTITY', 'iframe']) {
      assert.ok(!s.toLowerCase().includes(bad.toLowerCase()), `should strip ${bad}: ${s}`);
    }
    assert.ok(s.includes('<circle'), 'keeps safe shapes');
    assert.ok(s.includes('href="#local"'), 'keeps internal fragment refs');
  });

  it('rejects files over 200 KB and non-SVG input', () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg">${'<!-- pad -->'.repeat(20000)}</svg>`;
    const r = sanitizeSvg(big);
    assert.equal(r.ok, false);
    assert.match(r.error!, /200 KB/);
    assert.equal(sanitizeSvg('<html><body>hi</body></html>').ok, false);
  });

  it('seal is rendered via <img src="data:image/svg+xml">, never injected as markup', () => {
    const src = readFileSync(path.join(ROOT, 'components/WaxSeal.tsx'), 'utf8');
    assert.match(src, /data:image\/svg\+xml/);
    assert.match(src, /<img/);
    const all = walk(path.join(ROOT, 'components')).concat(walk(path.join(ROOT, 'app')));
    for (const f of all.filter((x) => /\.tsx?$/.test(x))) {
      assert.doesNotMatch(readFileSync(f, 'utf8'), /dangerouslySetInnerHTML/, `${f} must not render raw HTML`);
    }
  });
});

describe('6. Dragging origami never modifies the stored letter', () => {
  const placements: OrigamiObjectPlacement[] = [
    { object_id: 'crane', x_pct: 20, y_pct: 20, rotation_deg: 10, z_index: 1 },
    { object_id: 'boat', x_pct: 80, y_pct: 80, rotation_deg: -15, z_index: 2 },
  ];

  it('reader drag is a pure view-state transform and storage is unchanged', async () => {
    assert.equal(PERSIST_READER_POSITIONS, false);
    const { letterId } = await createLetter({ senderId: HARVEY, recipientId: DONNA, body: 'Weights', signature: 'H', objects: placements });
    const opened = (await getLetterDetails(letterId!, DONNA, { markOpened: true }))!;
    const viewState = opened.objects;
    const snapshot = JSON.stringify(viewState);

    const moved = applyReaderDrag(viewState, 0, 55, 60);
    assert.equal(moved[0].x_pct, 55);
    assert.equal(JSON.stringify(viewState), snapshot, 'input array not mutated');

    const stored = __testing.getStoredObjects(letterId!);
    assert.deepEqual(stored.map((o) => [o.object_id, o.x_pct, o.y_pct]), [['crane', 20, 20], ['boat', 80, 80]]);

    // Reopening returns the sender's placement again.
    const again = (await getLetterDetails(letterId!, DONNA))!;
    assert.equal(again.objects[0].x_pct, 20);
  });

  it('server ignores unknown origami ids and keeps at most 3', async () => {
    const many = [
      ...placements,
      { object_id: 'fox', x_pct: 50, y_pct: 50, rotation_deg: 0, z_index: 3 },
      { object_id: 'flower', x_pct: 10, y_pct: 90, rotation_deg: 0, z_index: 4 },
      { object_id: '../../etc', x_pct: 10, y_pct: 10, rotation_deg: 0, z_index: 5 },
    ];
    const { letterId } = await createLetter({ senderId: HARVEY, recipientId: DONNA, body: 'Many', signature: 'H', objects: many });
    const stored = __testing.getStoredObjects(letterId!);
    assert.equal(stored.length, 3);
    assert.ok(stored.every((o) => o.object_id !== '../../etc'));
  });

  it('breeze pins: a weight near a corner holds it; far corners are free', () => {
    const pins = computeCornerPins([{ object_id: 'crane', x_pct: 8, y_pct: 6, rotation_deg: 0, z_index: 1 }], 1.3);
    assert.equal(pins['top-left'], 1);
    assert.equal(pins['bottom-right'], 0);
    assert.ok(computeCornerPins([], 1.3)['top-right'] === 0);
  });
});
