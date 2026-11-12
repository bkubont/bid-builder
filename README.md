# Bid Builder

Tablet-first contractor estimate app for **Square This Up / F&G** — pricebook + optional AI draft, customers, estimates, convert-to-invoice, and a drag-and-drop **timeblock schedule**. Works on phones and desktop too, and installs as a Progressive Web App.

Live target: `https://estimate.fandg-llc.com`

## Features

- **Estimates** with materials/labor lines, markup, tax, PDF export
- **Pricebook** for reusable rates (powers manual adds and drafts)
- **AI / quick draft** from a job description (`OPENAI_API_KEY` optional; local keyword draft otherwise)
- **Schedule** — week timeblocks; drag whole jobs or individual lines; duration matches labor hours
- **Customers** and **invoices** (convert from an estimate)
- **PWA** manifest + service worker for home-screen install
- Branding from Square This Up (blue `#0504AA` + gold `#E3AD36`)

Data is stored in the browser (`localStorage`) for this first slice.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).
