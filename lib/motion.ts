// Shared physics springs and animation presets for Private Letters
// Rule: animate only `transform` and `opacity`, prioritize springs over fixed-duration easing

export const springPresets = {
  // Gentle fluid interactions (page changes, dialogs)
  gentle: {
    type: 'spring' as const,
    stiffness: 140,
    damping: 18,
    mass: 0.9,
  },
  // Bouncy micro-interactions (buttons, badges)
  bouncy: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 14,
    mass: 0.7,
  },
  // Envelope opening and flap fold mechanics
  envelope: {
    type: 'spring' as const,
    stiffness: 150,
    damping: 18,
    mass: 1.1,
  },
  // Unfolding letter sheet with realistic paper weight
  paperUnfold: {
    type: 'spring' as const,
    stiffness: 120,
    damping: 20,
    mass: 1.2,
  },
  // Paperweight pickup (smooth lift, responsive)
  origamiLift: {
    type: 'spring' as const,
    stiffness: 320,
    damping: 22,
    mass: 0.5,
  },
  // Paperweight release (organic settle bounce)
  origamiDrop: {
    type: 'spring' as const,
    stiffness: 220,
    damping: 15,
    mass: 0.8,
  },
  // Breeze corner lift & flutter recovery
  breezeCorner: {
    type: 'spring' as const,
    stiffness: 85,
    damping: 12,
    mass: 1.0,
  },
  // Snappy layout transitions
  snappy: {
    type: 'spring' as const,
    stiffness: 220,
    damping: 24,
    mass: 0.8,
  },
  // Auto-rise when the reader doesn't scroll: drives window scroll, overdamped (no overshoot)
  letterRise: {
    type: 'spring' as const,
    stiffness: 22,
    damping: 14,
    mass: 1.4,
  },
  // Shorter replay for re-reads
  letterRiseReRead: {
    type: 'spring' as const,
    stiffness: 60,
    damping: 20,
    mass: 1,
  },
};

/** Smoothing applied to raw scroll progress so the letter moves with weight (useSpring options). */
export const scrollRiseSpring = { stiffness: 90, damping: 24, mass: 0.6 };

// Layered soft shadow tokens for realistic paper & envelopes
export const paperShadows = {
  flat: '0 1px 3px rgba(35, 30, 24, 0.05), 0 4px 12px rgba(35, 30, 24, 0.04)',
  elevated: '0 4px 12px rgba(35, 30, 24, 0.06), 0 16px 36px rgba(35, 30, 24, 0.08), 0 1px 2px rgba(0,0,0,0.03)',
  floating: '0 8px 24px rgba(35, 30, 24, 0.08), 0 28px 56px rgba(35, 30, 24, 0.12)',
  envelopeFlap: '0 8px 18px rgba(25, 20, 15, 0.14)',
  origamiRest: 'drop-shadow(0 2px 4px rgba(35, 25, 20, 0.22))',
  origamiHeld: 'drop-shadow(0 14px 22px rgba(35, 25, 20, 0.28)) drop-shadow(0 4px 8px rgba(35, 25, 20, 0.16))',
};
