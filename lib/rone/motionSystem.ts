"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Tactile Spatial Motion System (Monochrome Alabaster & Obsidian)
 * Tuned for silky spring physics, zero layout thrash, and prefers-reduced-motion compliance.
 */

export const TAIMO_EASE = [0.22, 1, 0.36, 1] as const;

export const PILL_SPRING = {
  type: "spring" as const,
  stiffness: 460,
  damping: 34,
  mass: 0.85,
};

export const CARD_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.88,
};

export const SHEET_SPRING = {
  type: "spring" as const,
  stiffness: 360,
  damping: 36,
  mass: 0.9,
};

export const TOAST_SPRING = {
  type: "spring" as const,
  stiffness: 440,
  damping: 32,
  mass: 0.78,
};

export const PAGE_BLUR_VARIANTS = {
  initial: {
    opacity: 0,
    y: 12,
    filter: "blur(8px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.34,
      ease: TAIMO_EASE,
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(6px)",
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1] as const,
    },
  },
};

export const CARD_REVEAL_VARIANTS = {
  initial: {
    opacity: 0,
    y: 14,
    scale: 0.985,
    filter: "blur(5px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.38,
      ease: TAIMO_EASE,
    },
  },
};

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export type UiSoundKind = "click" | "tab" | "pop" | "theme" | "slide";

/**
 * Subtle tactile Web Audio micro-sounds matching high-craft spatial UI motion.
 * Very low gain (0.02–0.045) and ultra-short decay so interactions feel crisp, never noisy.
 */
export function playUiSound(kind: UiSoundKind = "click") {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (kind === "tab") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.032);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.026, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (kind === "pop") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.04);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.03, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.065);
    } else if (kind === "theme") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (kind === "slide") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(310, now + 0.055);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.022, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc.start(now);
      osc.stop(now + 0.07);
    } else {
      // Crisp micro-click
      osc.type = "triangle";
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(460, now + 0.024);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.022, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.035);
    }
  } catch {
    // Gracefully ignore blocked autoplay contexts
  }
}

/**
 * Circular Expanding Clip-Path Theme Ripple (View Transitions API with instant fallback).
 * Expands radially from the exact pointer/button coordinates across the entire viewport.
 */
export function toggleThemeWithRipple(
  originEvent: React.MouseEvent | null,
  applyTheme: () => void
) {
  playUiSound("theme");

  if (typeof document === "undefined" || typeof window === "undefined") {
    applyTheme();
    return;
  }

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const docWithTransition = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  };

  if (prefersReduced || typeof docWithTransition.startViewTransition !== "function") {
    applyTheme();
    return;
  }

  let x = window.innerWidth - 40;
  let y = 36;
  if (originEvent) {
    const rect = (originEvent.currentTarget as HTMLElement | null)?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else if (originEvent.clientX || originEvent.clientY) {
      x = originEvent.clientX;
      y = originEvent.clientY;
    }
  }

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  try {
    const transition = docWithTransition.startViewTransition(() => {
      applyTheme();
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${Math.ceil(endRadius)}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 540,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {
        // Fallback already applied inside callback
      });
  } catch {
    applyTheme();
  }
}

/**
 * Smooth rolling/odometer number animator.
 * Hydrates cleanly with exact SSR value, then interpolates smoothly on changes.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 520,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState<number>(value);
  const fromRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const startVal = fromRef.current;
    const delta = value - startVal;

    if (prefersReduced || !Number.isFinite(value) || Math.abs(delta) < 1e-6) {
      fromRef.current = value;
      rafRef.current = requestAnimationFrame(() => {
        setDisplay(value);
      });
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }

    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startVal + delta * eased;
      fromRef.current = next;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        setDisplay(value);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = Number.isFinite(display)
    ? display.toLocaleString("id-ID", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : "–";

  return React.createElement(
    "span",
    { className, style: { fontVariantNumeric: "tabular-nums" } },
    `${prefix}${formatted}${suffix}`
  );
}
