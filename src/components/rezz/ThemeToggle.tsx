"use client";

import { Moon, Sun } from "lucide-react";
import { box, offset } from "./skin";

/**
 * Light or dark. Two states, no "follow my system".
 *
 * The component holds no React state, which is the whole trick: the theme lives
 * in one place — `data-theme` on <html> — and everything here reacts to it in
 * CSS through the `dark:` variant. Nothing to hydrate means nothing to mismatch,
 * so the right icon is painted on the very first frame, including for someone
 * arriving in dark from a previous visit.
 *
 * The icon names the state you are going TO, not the one you are in: a moon
 * while the screen is light, a sun while it is dark. That is the convention
 * every other product uses, and a toggle is not the place to be original.
 *
 * The brand book asks that an icon support a label rather than replace one.
 * This one is icon-only at the owner's request (29 Sep 2026), so the label is
 * carried in the accessibility tree instead: the two `sr-only` spans swap on the
 * same variant as the icons, so the button's accessible name is always the
 * action it will actually perform.
 */

const THEME_KEY = "rezz.theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const root = document.documentElement;
        const next = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        // localStorage, not the sessionStorage `session` uses: a tailoring
        // should die with the tab, but how someone likes to look at a screen
        // should not. Guarded because it throws in a private window.
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch {
          /* the choice still applies to this page; it just will not be remembered */
        }
      }}
      className={`inline-flex h-11 w-11 flex-none cursor-pointer items-center justify-center
                  rounded-md ${box} ${offset} bg-paper-raised text-ink
                  transition-[box-shadow,transform] duration-150
                  hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--ink)]
                  ${className}`}
    >
      <Moon aria-hidden className="h-5 w-5 dark:hidden" strokeWidth={1.5} />
      <Sun aria-hidden className="hidden h-5 w-5 dark:block" strokeWidth={1.5} />
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="sr-only hidden dark:block">Switch to light theme</span>
    </button>
  );
}
