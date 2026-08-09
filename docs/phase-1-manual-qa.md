# Phase 1 manual QA record

**Date:** 2026-08-09  
**Build:** production (`npm run build` / `npm run start`) via Playwright  
**Operator:** automated suite in `e2e/manual-qa.spec.ts`, `e2e/demo.spec.ts`, `e2e/responsive.spec.ts`, plus Desktop Chrome axe in `e2e/a11y.spec.ts`

This record closes the Phase 1 QA items that are **not** conditional on owning a physical phone. Real-device Safari/Chrome on hardware remains conditional (see below).

## Required checks (not conditional)

| Check | Method | Result |
| --- | --- | --- |
| Keyboard: focus visible on primary demo control; Enter advances; step heading receives focus | `e2e/manual-qa.spec.ts` | Pass |
| Sticky presentation controls remain visible after scroll on a stage page | `e2e/manual-qa.spec.ts` (390×720) | Pass |
| Phone landscape / orientation: decision + presentation bar usable | `e2e/manual-qa.spec.ts` (844×390); also `e2e/responsive.spec.ts` landscape | Pass |
| Browser zoom ~200%: guided demo controls remain reachable | `e2e/manual-qa.spec.ts` (`documentElement.style.zoom = 2`) | Pass |
| Text resize ~200%: consultation Agree/Disagree remain usable | `e2e/manual-qa.spec.ts` (`fontSize = 200%`) | Pass |
| `prefers-reduced-motion: reduce`: transitions shortened; demo and topic still usable | `e2e/manual-qa.spec.ts` (`emulateMedia({ reducedMotion: "reduce" })`) | Pass |
| Phone widths 320 / 375 / 390 / 430 smoke | `e2e/responsive.spec.ts` | Pass |
| Full guided demo on iPhone Safari/WebKit emulation | Playwright project `Mobile Safari` (`devices["iPhone 13"]`) × `e2e/demo.spec.ts` | Pass |
| Full guided demo on Android Chrome emulation | Playwright project `Mobile Chrome` (`devices["Pixel 5"]`) × `e2e/demo.spec.ts` | Pass |
| Principal-route axe (serious/critical) | `e2e/a11y.spec.ts` including `/about` | Pass |

## Conditional: physical devices

| Check | Status |
| --- | --- |
| Complete guided demo on a real iPhone in Safari | Not run — no physical iPhone available in this environment |
| Complete guided demo on a real Android phone in Chrome | Not run — no physical Android device available in this environment |

Emulated Mobile Safari (WebKit) and Mobile Chrome (Pixel 5) cover the required phone-browser walkthrough for Phase 1 release. Hardware confirmation is recommended before any public pilot but is not a blocker for the synthetic demonstration tag.

## Notes

- Sticky chrome includes the prototype banner, site header, and `DemoPresentationBar` when `?demoStep=` is present.
- Reduced-motion assertion checks computed `transition-duration` under the global CSS rule in `src/app/globals.css`.
- Zoom uses CSS `zoom` as a Playwright-stable stand-in for browser page zoom; text resizing uses root `font-size`.
