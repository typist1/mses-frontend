# Frontend — CLAUDE.md

## Stack
React 18 · Vite · MUI v9 (Material UI) · shadcn/ui · React Router v7 · axios · Firebase auth

## Routes
| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `src/pages/home/Home.jsx` | Main UI: upload resume + JD, run analysis, view results |
| `/resumes` | `src/pages/home/Resumes.jsx` | Resume management: upload, version, set active, preview |
| `/editor` | `src/pages/editor/ResumeEditor.jsx` | Accept/reject suggestions, edit resume, export DOCX/PDF |
| `/login` `/signup` | `src/pages/account/` | Auth pages |

## Key Files
| File | Purpose |
|------|---------|
| `src/common/contexts/UserContext.jsx` | Firebase auth state; `getToken()` for API calls |
| `src/firebase-config.js` | Firebase app init |
| `src/utils/buildDocx.js` | Export parsed resume JSON → DOCX via `docx` lib |
| `src/utils/buildPdf.js` | Export → PDF via `pdfmake` |
| `src/assets/MSESCoursesFull.js` | Full MSES course list (displayed in gap analysis results) |
| `src/assets/MSESCourses.js` | Minified course list (also in backend — keep in sync if editing) |
| `src/common/components/ui/` | shadcn/ui components (prefer these for new UI over raw MUI) |
| `src/utils/constants.js` | Global constants |

## API Calls
All authenticated requests: `Authorization: Bearer <firebase_token>` via `getToken()` from UserContext.
Base URL from `VITE_BACKEND_URL` env var.

## Component Style
- MUI for most functional UI (tables, buttons, dialogs, chips)
- shadcn/ui components in `src/common/components/ui/` — prefer for new UI
- JSX throughout; `.tsx` only in `src/common/components/ui/` and figma folder
- `@/` path alias maps to `src/`

## Env Vars
```
VITE_BACKEND_URL   # backend API base URL (http://localhost:5050 for dev)
VITE_FIREBASE_*    # Firebase project config
```

## Dev
```bash
npm run dev    # Vite dev server, port 5173
npm run build  # production build to dist/
```
Deployed to Firebase Hosting.
