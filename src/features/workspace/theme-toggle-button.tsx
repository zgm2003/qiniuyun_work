"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type ThemeName = "light" | "dark";

type ViewTransition = {
  ready?: Promise<void>;
  finished?: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

const THEME_STORAGE_KEY = "novel-to-script-ai:theme";
const TOGGLE_DURATION_MS = 420;

function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark";
}

function applyDocumentTheme(theme: ThemeName) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function readStoredTheme(): ThemeName {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeName(stored)) {
    return stored;
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function maxRevealRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

export function ThemeToggleButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<ThemeName>("light");
  const isDark = theme === "dark";
  const nextTheme: ThemeName = isDark ? "light" : "dark";

  useEffect(() => {
    const initialTheme = readStoredTheme();
    applyDocumentTheme(initialTheme);

    const frame = window.requestAnimationFrame(() => {
      setTheme(initialTheme);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const commitTheme = useCallback((value: ThemeName) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
    applyDocumentTheme(value);
    setTheme(value);
  }, []);

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }

    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const { left, top, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = maxRevealRadius(x, y, viewportWidth, viewportHeight);
    const root = document.documentElement;
    const transitionDocument = document as ViewTransitionDocument;

    function applyNextTheme() {
      commitTheme(nextTheme);
    }

    if (typeof transitionDocument.startViewTransition !== "function") {
      applyNextTheme();
      return;
    }

    root.dataset.themeTransition = "active";
    root.style.setProperty("--theme-toggle-duration", `${TOGGLE_DURATION_MS}ms`);
    root.style.setProperty("--theme-toggle-clip-from", `circle(0px at ${x}px ${y}px)`);

    const cleanup = () => {
      delete root.dataset.themeTransition;
      root.style.removeProperty("--theme-toggle-duration");
      root.style.removeProperty("--theme-toggle-clip-from");
    };

    const transition = transitionDocument.startViewTransition(() => {
      flushSync(applyNextTheme);
    });

    transition.finished?.finally(cleanup);
    transition.ready?.then(() => {
      root.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
        },
        {
          duration: TOGGLE_DURATION_MS,
          easing: "ease-in-out",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    });
  }, [commitTheme, nextTheme]);

  return (
    <button
      ref={buttonRef}
      className="theme-toggle-button"
      type="button"
      aria-label={isDark ? "切换浅色主题" : "切换深色主题"}
      title={isDark ? "切换浅色主题" : "切换深色主题"}
      data-theme={theme}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          {isDark ? <SunIcon /> : <MoonIcon />}
        </span>
      </span>
    </button>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 14.1A7.6 7.6 0 0 1 9.9 4 8.1 8.1 0 1 0 20 14.1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}
