export const STUDIO_EASE = [0.16, 1, 0.3, 1] as const;

export const studioTween = {
  type: 'tween' as const,
  duration: 0.15,
  ease: STUDIO_EASE,
};

export const studioSnap = {
  type: 'spring' as const,
  stiffness: 620,
  damping: 38,
  mass: 0.64,
};

export const studioEnter = {
  type: 'tween' as const,
  duration: 0.2,
  ease: STUDIO_EASE,
};

export const studioChipSpring = {
  type: 'spring' as const,
  stiffness: 720,
  damping: 40,
  mass: 0.55,
};

export const studioStagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.028, delayChildren: 0 },
  },
};

export const studioItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: studioEnter },
};
