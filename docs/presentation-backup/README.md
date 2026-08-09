# Presentation backup screenshots

Captured 2026-08-09 from `http://127.0.0.1:3000`.

Use these static images if the live demonstration encounters a local-machine problem. They are synthetic UI only.

| File | Route | Viewport |
| --- | --- | --- |
| `home-desktop.png` | `/` | 1280×800 |
| `home-mobile.png` | `/` | 390×844 |
| `join-desktop.png` | `/join` | 1280×800 |
| `topic-cedar-desktop.png` | `/topics/cedar-river-drought-surcharge` | 1280×800 |
| `consult-cedar-mobile.png` | `/topics/cedar-river-drought-surcharge/consult` | 390×844 |
| `agenda-cedar-desktop.png` | `/agenda/cedar-river-drought-surcharge` | 1280×800 |
| `deliberation-cedar-desktop.png` | `/deliberation/cedar-river-drought-surcharge` | 1280×800 |
| `decision-cedar-desktop.png` | `/decisions/cedar-river-drought-surcharge` | 1280×800 |
| `decision-cedar-mobile.png` | `/decisions/cedar-river-drought-surcharge` | 390×844 |
| `transparency-desktop.png` | `/transparency` | 1280×800 |
| `demo-desktop.png` | `/demo` | 1280×800 |
| `demo-mobile.png` | `/demo` | 390×844 |

Regenerate with a running production server:

```bash
npm run build
npm run start
npm run capture:screenshots
```
