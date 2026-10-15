export type PersonSlug = 'harvey' | 'donna';

export interface Person {
  id: string;
  slug: PersonSlug;
  name: string;
  token_hash: string;
  password_hash: string;
  session_version: number;
  must_prompt_change: boolean;
  seal_svg: string | null;
  seal_color: string;
  signature: string | null;
  created_at: string;
}

export interface OrigamiObjectPlacement {
  id?: string;
  letter_id?: string;
  object_id: string;
  x_pct: number; // 0 - 100
  y_pct: number; // 0 - 100
  rotation_deg: number; // -180 to 180
  z_index: number;
}

export type LetterObjectPlacement = OrigamiObjectPlacement;

export interface Letter {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  signature: string;
  reply_to: string | null;
  deliver_at: string;
  created_at: string;
  first_opened_at: string | null;
  seal_svg: string | null;
  seal_color: string;
  sender_name?: string;
  sender_slug?: PersonSlug;
  recipient_name?: string;
  objects?: OrigamiObjectPlacement[];
  reply_preview?: {
    id: string;
    sender_name: string;
    created_at: string;
    body_snippet: string;
    seal_svg: string | null;
    seal_color: string;
  } | null;
}

export interface PasswordResetRequest {
  id: string;
  person_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
}

export interface SessionPayload {
  personId: string;
  slug: PersonSlug;
  name: string;
  sessionVersion: number;
  exp?: number;
}

export interface OrigamiManifestItem {
  id: string;
  name: string;
  file: string;
  width: number;
}
