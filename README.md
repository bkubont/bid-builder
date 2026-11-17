# Bid Builder

Tablet-first contractor estimate app for **Square This Up / F&G** — pricebook + optional AI draft, customers, estimates, convert-to-invoice, and a drag-and-drop **timeblock schedule**. Works on phones and desktop too, and installs as a Progressive Web App.

Live target: `https://estimate.fandg-llc.com`

## Features

- **Estimates** with materials/labor lines, markup, tax, PDF export
- **Pricebook** for reusable rates (powers manual adds and drafts)
- **AI / quick draft** from a job description (`OPENAI_API_KEY` optional; local pricebook matching otherwise). Asks before replacing lines you've entered. Limited per company per day.
- **Schedule** — week timeblocks; drag whole jobs or individual lines; duration matches labor hours
- **Customers** and **invoices** (convert from an estimate; one invoice per estimate)
- **Logins and team** — email + password; Owners manage company settings and invite people
- **PWA** manifest + service worker for home-screen install; pages you've opened stay viewable offline
- Branding from Square This Up (blue `#0504AA` + gold `#E3AD36`)

Data lives in a MySQL/MariaDB database, and each company's data is kept separate. Owners manage the team and company settings; team members work on customers, estimates, invoices and the schedule. Saving needs a connection.

Customer documents (PDFs, invoices) show a price per unit with markup already included. Your cost and markup only appear on the estimate editing screen.

## Run locally

You need Node.js 20.9+ and a MySQL or MariaDB database.

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL; BETTER_AUTH_SECRET can stay empty locally
npm run db:migrate           # create the tables
npm run db:seed              # test company + logins (see below)
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847). The seed creates `owner@example.com` (Owner) and `field@example.com` (team member), both with password `change-me-please`.

## Deploy (Hostinger Git deploy)

1. **Database:** hPanel → Databases → MySQL Databases → create a database and a user.
2. **Environment variables** (Node.js app settings), described in `.env.example`:
   `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OWNER_EMAIL`, `SETUP_CODE`, and optionally `OPENAI_API_KEY`.
3. **Node.js 20.9 or newer.** Build command `npm run build`, start command `npm start`.
   `npm start` applies any new database migrations, then serves the app on the `PORT` Hostinger provides.
4. **First visit:** the site opens `/setup`. Enter the setup code, your name, company name and a password. That creates the Owner account, and `/setup` locks itself.
5. **Invite your team** from Settings → Team. Each invite link works once and expires after 7 days.
6. **Test data:** Settings → Test data fills the account with fictional customers, estimates and so on.

## Checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # money math, dates, draft logic
npm run test:db     # + database tests (needs a test database; it gets wiped)
npm run build       # production build (needs no database)
```

`npm run test:db` uses `TEST_DATABASE_URL`, defaulting to `mysql://bid:localdev@127.0.0.1:3306/bidbuilder_test`.

## Changing the database

Edit `src/db/schema.ts`, run `npm run db:generate` to write a migration into `drizzle/`, and commit it. Migrations run automatically on `npm start`.
