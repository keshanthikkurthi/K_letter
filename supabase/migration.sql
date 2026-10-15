-- ==============================================================================
-- Private Letters (Harvey & Donna) - Supabase Database Migration
-- ==============================================================================

-- 1. Enable pgcrypto for UUIDs if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Run ONCE on a fresh project. This script intentionally contains no DROP
-- statements: re-running it fails on "already exists" instead of deleting letters.

-- 3. People Table
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL CHECK (slug IN ('harvey', 'donna')),
    name TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    session_version INTEGER NOT NULL DEFAULT 1,
    must_prompt_change BOOLEAN NOT NULL DEFAULT FALSE,
    seal_svg TEXT,
    seal_color TEXT NOT NULL DEFAULT '#8B1E2D',
    signature TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Setup State (Ensures /setup can only run once)
CREATE TABLE setup_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Login Attempts Table (Brute-force protection: 5 attempts / 15 minutes)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_login_attempts_person_ip ON login_attempts(person_id, ip_address, attempted_at DESC);

-- 6. Password Resets Table (Trust-based single-use link for other person)
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,          -- SHA-256 of the token; used for lookup
    token_encrypted TEXT NOT NULL,            -- AES-256-GCM (key derived from SESSION_SECRET); only decrypted to show the link to the OTHER person
    banner_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_password_resets_target ON password_resets(person_id, used, expires_at);

-- 7. Letters Table
CREATE TABLE letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES people(id),
    recipient_id UUID NOT NULL REFERENCES people(id),
    body TEXT NOT NULL,
    signature TEXT NOT NULL,
    reply_to UUID REFERENCES letters(id),
    deliver_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_opened_at TIMESTAMPTZ,
    seal_svg TEXT,
    seal_color TEXT NOT NULL,
    CONSTRAINT chk_different_people CHECK (sender_id <> recipient_id)
);

CREATE INDEX idx_letters_recipient_deliver ON letters(recipient_id, deliver_at DESC);
CREATE INDEX idx_letters_sender ON letters(sender_id, created_at DESC);

-- 8. Letter Origami Objects Table
CREATE TABLE letter_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
    object_id TEXT NOT NULL,
    x_pct DOUBLE PRECISION NOT NULL CHECK (x_pct >= 0 AND x_pct <= 100),
    y_pct DOUBLE PRECISION NOT NULL CHECK (y_pct >= 0 AND y_pct <= 100),
    rotation_deg DOUBLE PRECISION NOT NULL DEFAULT 0,
    z_index INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_letter_objects_letter ON letter_objects(letter_id);

-- 9. Immutability Triggers
-- Spec: "Immutable: there are no edit or delete endpoints. Add a database trigger that rejects
-- any UPDATE to a letter other than setting first_opened_at once, and rejects every DELETE."

CREATE OR REPLACE FUNCTION fn_letters_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Letters are permanent and immutable: letters cannot be deleted.';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Allow ONLY setting first_opened_at once from NULL to a timestamp
        IF OLD.first_opened_at IS NULL AND NEW.first_opened_at IS NOT NULL
           AND OLD.id = NEW.id
           AND OLD.sender_id = NEW.sender_id
           AND OLD.recipient_id = NEW.recipient_id
           AND OLD.body = NEW.body
           AND OLD.signature = NEW.signature
           AND OLD.reply_to IS NOT DISTINCT FROM NEW.reply_to
           AND OLD.deliver_at = NEW.deliver_at
           AND OLD.created_at = NEW.created_at
           AND OLD.seal_svg IS NOT DISTINCT FROM NEW.seal_svg
           AND OLD.seal_color = NEW.seal_color THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Letters are permanent and immutable: content, sender, recipient, delivery time, or already-opened status cannot be altered.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_letters_immutable
BEFORE UPDATE OR DELETE ON letters
FOR EACH ROW
EXECUTE FUNCTION fn_letters_immutable();

-- Immutability for letter origami objects
CREATE OR REPLACE FUNCTION fn_letter_objects_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Letter objects are immutable: object placements cannot be modified.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Letter objects are immutable: objects cannot be removed from letters.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_letter_objects_immutable
BEFORE UPDATE OR DELETE ON letter_objects
FOR EACH ROW
EXECUTE FUNCTION fn_letter_objects_immutable();

-- 10. Enable Row Level Security (RLS) on all tables with NO public policies
-- All database queries must run server-side using the SUPABASE_SERVICE_ROLE_KEY.
-- Direct client access via anon key is strictly prohibited.
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_objects ENABLE ROW LEVEL SECURITY;
