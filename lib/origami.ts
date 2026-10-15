import manifestJson from '@/public/origami/manifest.json';
import type { OrigamiManifestItem, OrigamiObjectPlacement } from './types';

export const ORIGAMI_MANIFEST: OrigamiManifestItem[] = manifestJson as OrigamiManifestItem[];
export const MAX_OBJECTS_PER_LETTER = 3;

// When false, reader drags are view-only and reset each time the letter opens.
export const PERSIST_READER_POSITIONS = false;

export function getOrigami(id: string): OrigamiManifestItem | undefined {
  return ORIGAMI_MANIFEST.find((m) => m.id === id);
}

/** Server-side validation of sender placements. Drops unknown ids, clamps values. */
export function sanitizePlacements(input: unknown): OrigamiObjectPlacement[] {
  if (!Array.isArray(input)) return [];
  const clamp = (n: unknown, lo: number, hi: number) => {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
    return Math.max(lo, Math.min(hi, v));
  };
  return input
    .filter((o) => o && typeof o.object_id === 'string' && getOrigami(o.object_id))
    .slice(0, MAX_OBJECTS_PER_LETTER)
    .map((o, i) => ({
      object_id: o.object_id,
      x_pct: clamp(o.x_pct, 0, 100),
      y_pct: clamp(o.y_pct, 0, 100),
      rotation_deg: clamp(o.rotation_deg, -180, 180),
      z_index: i + 1,
    }));
}

/**
 * Reader drag: returns a NEW array with one object moved. Pure, never touches
 * the stored letter (there is no endpoint that could persist it anyway).
 */
export function applyReaderDrag(
  objects: readonly OrigamiObjectPlacement[],
  index: number,
  xPct: number,
  yPct: number
): OrigamiObjectPlacement[] {
  return objects.map((o, i) =>
    i === index
      ? { ...o, x_pct: Math.max(0, Math.min(100, xPct)), y_pct: Math.max(0, Math.min(100, yPct)) }
      : o
  );
}

export type CornerId = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Pin strength per corner from the nearest object. Distances are measured in
 * units of paper WIDTH (so tall paper isn't miscounted). Full pin <= 15%,
 * smoothstep falloff to 0 at >= 45%.
 */
export function computeCornerPins(
  objects: readonly OrigamiObjectPlacement[],
  aspect: number // height / width
): Record<CornerId, number> {
  const corners: Record<CornerId, [number, number]> = {
    'top-left': [0, 0],
    'top-right': [100, 0],
    'bottom-left': [0, 100],
    'bottom-right': [100, 100],
  };
  const out = { 'top-left': 0, 'top-right': 0, 'bottom-left': 0, 'bottom-right': 0 } as Record<CornerId, number>;
  for (const id of Object.keys(corners) as CornerId[]) {
    const [cx, cy] = corners[id];
    let min = Infinity;
    for (const o of objects) {
      const dx = o.x_pct - cx;
      const dy = (o.y_pct - cy) * aspect;
      min = Math.min(min, Math.hypot(dx, dy));
    }
    if (min <= 15) out[id] = 1;
    else if (min >= 45) out[id] = 0;
    else {
      const t = (45 - min) / 30;
      out[id] = t * t * (3 - 2 * t);
    }
  }
  return out;
}
