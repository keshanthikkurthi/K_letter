# Private Letters (Harvey & Donna)

A private, intentional web application designed for exactly two people (**Harvey** and **Donna**) to exchange permanent letters. No chat bubbles, no read receipts, no distractions—only fluid paper physics, custom wax seals, draggable origami paperweights, and gentle corner breeze curls.

---

## Features

- **Private Secret Links:** Each person accesses the desk via their own secret link (`/l/<token>`) generated with 32 cryptographically secure random bytes. Only SHA-256 hashes are stored.
- **Independent Passwords:** Individual passwords hashed with `bcrypt` (12 rounds). Donna receives a first-login popup (`must_prompt_change`) to personalize her password.
- **Brute-Force Shield:** Link locks for 15 minutes upon 5 failed attempts within that window (tracked by person and IP in `login_attempts`).
- **Trust-Based Password Reset:** Clicking "Forgot password?" creates a single-use 24-hour reset link that appears inside the *other person's* unlocked mailbox as a banner. The partner can set a new password on their behalf or share the link securely.
- **Permanent, Immutable Letters:** Database trigger rejects any `UPDATE` (except setting `first_opened_at` once) and rejects any `DELETE`. Once sent, letters cannot be altered or deleted.
- **Scheduled Delivery & Privacy:** Choose *Send now* or *Schedule*. Undelivered letters are strictly isolated and never returned to the recipient until `deliver_at <= now()`.
- **Taped Replies:** Replying attaches a washi-taped note to the top of the letter linking directly to the referenced letter in a focus modal.
- **Customizable Wax Seals:** Monogram or custom SVG wax seal inside an organic 3D wax-blob shape with selectable wax colors. SVGs are sanitized server-side (blocking scripts, event handlers, and external URLs) and rendered via data URIs.
- **Tactile 3D Envelope Animation:** Unopened letters appear as sealed envelopes. Tapping breaks the wax seal with a crack, unfolds the flap in 3D perspective (`preserve-3d`, `rotateX`), slides out the paper, and unfolds it to reading view.
- **Send Animation:** Folding in thirds, flap seal stamp, and glide away with spring inertia.
- **Draggable Origami Paperweights:** Transparent origami items (crane, boat, fox, flower, butterfly, clover). Readers can lift and drag objects across the paper; lifting casts deep soft shadows. Moving objects only affects reader view state and never mutates the stored letter.
- **The Breeze & Corner Page-Curl:** A gust loop every 6–14 seconds calculates pin strengths at all 4 corners from nearby origami pieces (full pin within 15% of width, falloff to 45%). Unpinned corners lift and flutter with CSS 3D page curls and lighter underside gradients, and the sheet tilts up to 3 degrees. Fully pinned sheets stay motionless.
- **Strict Privacy & Security:** `noindex, nofollow`, `robots.txt` disallowing all crawlers, CSP, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and httpOnly secure SameSite=Lax JWT sessions via `jose`.

> **Privacy Notice (v1):** Letters are stored in Supabase Postgres. While secured against public and unauthorized access with Row Level Security (RLS) and server-only service role execution, they are not end-to-end encrypted in v1. The owner of the Supabase project database has technical access to inspect records.

---

## 1. Supabase Project Setup & Database Migration

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Open `supabase/migration.sql` from this repository, paste the entire contents into the SQL Editor, and click **Run**.
4. The migration will:
   - Create tables: `people`, `letters`, `letter_objects`, `login_attempts`, `password_resets`, and `setup_state`.
   - Install the immutability trigger `fn_letters_immutable` rejecting updates and deletions.
   - Enable Row Level Security (RLS) on every table with no public policies, locking out direct client-side database queries.

---

## 2. Environment Variables

Create a `.env.local` file (for local development) or set these in your Vercel Project Settings:

```env
# Supabase credentials (Settings -> API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# 32+ character random string for signing JWT session cookies
SESSION_SECRET=your-random-32-char-session-secret-here

# Secret password required to access and run the one-time /setup page
SETUP_SECRET=your-one-time-setup-master-key-here
```

For local setup, replace the example values with your own values and restart `npm run dev` after saving `.env.local`. On Vercel, set `SETUP_SECRET` for the environment you are using and redeploy. The value entered on `/setup` must exactly match the server's `SETUP_SECRET`; if it is not configured, the page will report that setup is unavailable.

*(Note: During local offline development without Supabase, the app features an automatic in-memory fallback repository that mimics all database constraints and immutability rules).*

---

## 3. Deploying to Vercel

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **Add New... -> Project**.
3. Import your GitHub repository.
4. Under **Environment Variables**, add the four variables listed above (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `SETUP_SECRET`).
5. Click **Deploy**.

---

## 4. Running Setup for the First Time

1. Once deployed, open `https://your-app.vercel.app/setup` in your browser.
2. Enter your `SETUP_SECRET`.
3. Enter Harvey's password and Donna's default password.
4. Click **Initialize & Generate Links**.
5. The page will display both secret links once:
   - `Harvey's Secret Link:` `https://your-app.vercel.app/l/<32-byte-token>`
   - `Donna's Secret Link:` `https://your-app.vercel.app/l/<32-byte-token>`
6. **Save both links securely immediately.** The setup endpoint is permanently disabled after execution and these links can never be shown again.
7. Send Donna her secret link and default password. Upon her first login, she will be prompted with "Do you want to change your password?" with *Change it* and *Keep it*.

---

## 5. Running Locally & Testing

```bash
# Install dependencies
npm install

# Run automated test suite
npm test

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the desk.

### Automated Test Coverage

The test suite verifies:
1. **Letter Immutability:** Letters cannot be updated or deleted once written.
2. **Undelivered Letters Isolation:** Scheduled future letters are strictly excluded from recipient inbox and API access until delivery time.
3. **Password Resets:** Reset links are strictly single-use and expire after use or 24 hours.
4. **Session Invalidation:** Changing passwords bumps `session_version` and invalidates any active sessions.
5. **Server-side SVG Sanitization:** Strips `<script>`, `onload`, `onclick`, `foreignObject`, `javascript:` URLs, and rejects oversized uploads.
6. **Origami Drag Safety:** Dragging origami pieces in the reader only alters client view state and never mutates the database.
