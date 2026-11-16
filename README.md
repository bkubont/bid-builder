# Bid Builder

Tablet-first contractor estimate app for **Square This Up / F&G** — pricebook + optional AI draft, customers, estimates, convert-to-invoice, and a drag-and-drop **timeblock schedule**. Works on phones and desktop too, and installs as a Progressive Web App.

Live target: `https://estimate.fandg-llc.com`

## Features

- **Estimates** with materials/labor lines, markup, tax, PDF export
- **Pricebook** for reusable rates (powers manual adds and drafts)
- **AI / quick draft** from a job description (`OPENAI_API_KEY` optional; local pricebook matching otherwise). Asks before replacing lines you've entered.
- **Schedule** — week timeblocks; drag whole jobs or individual lines; duration matches labor hours
- **Customers** and **invoices** (convert from an estimate)
- **PWA** manifest + service worker for home-screen install
- Branding from Square This Up (blue `#0504AA` + gold `#E3AD36`)

Data is stored in the browser (`localStorage`) for now, and open tabs stay in sync. A hosted database with logins is the next phase. The app ships with fictional test data. **Settings → Reset test data** restores it.

Customer documents (PDFs, invoices) show a price per unit with markup already included. Your cost and markup only appear on the estimate editing screen.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

Copy `.env.example` to `.env.local` to set your OpenAI key.

## Deploy (Hostinger Git deploy)

- Node.js **20.9 or newer** (Next.js 16 requirement). Pick it in hPanel.
- Build command: `npm run build`. Start command: `npm start`.
- `npm start` listens on the `PORT` Hostinger provides (3000 if none is set). Local development (`npm run dev`) still uses port 3847.
- Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) under the app's environment variables in hPanel.

## Checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # money math, dates, draft logic
npm run build       # production build
```
