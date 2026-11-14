# Deploying MoonBase Colony: GitHub + Supabase + Vercel

The game is a static Vite app. **Vercel** hosts it from **GitHub**, and **Supabase** stores cloud saves.
Without Supabase settings the game still works: it saves in the browser only.

---

## 1. Supabase (cloud saves)

1. Create a free project at <https://supabase.com/dashboard> (pick a region close to your players).
2. **Create the table:** Dashboard → **SQL Editor** → *New query* → paste the whole of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   This creates the `saves` table, turns on **Row Level Security**, and adds policies so each player can only read and write their own row.
3. **Sign-in by email link:** Dashboard → **Authentication → Sign In / Providers** → make sure **Email** is enabled. Magic links are on by default.
4. **Allowed redirect URLs:** Dashboard → **Authentication → URL Configuration**:
   - **Site URL:** your Vercel address, e.g. `https://moodbase-calony.vercel.app`
   - **Redirect URLs:** add `http://localhost:5173/**` (for local testing) and `https://*.vercel.app/**` (or your exact Vercel URLs)
5. **Copy the keys:** Dashboard → **Project Settings → API Keys** (or *Connect*):
   - Project URL → `VITE_SUPABASE_URL`
   - **Publishable** key (`sb_publishable_…`) → `VITE_SUPABASE_PUBLISHABLE_KEY`
     (older projects: the legacy **anon** key works too → `VITE_SUPABASE_ANON_KEY`)
   - ⚠️ Never use the **secret / service_role** key in the game. It bypasses Row Level Security.

> The free plan's built-in email service is rate-limited (only a few sign-in emails per hour) and meant for testing.
> For a class or a jury demo, add your own SMTP provider in **Authentication → Emails → SMTP Settings**.

### Run locally with cloud saves

```bash
cp .env.example .env.local   # then paste your two values into .env.local
npm install
npm run dev
```

`.env.local` is git-ignored, so your values are never committed.

---

## 2. GitHub

The code lives at <https://github.com/H1tro/MoodBase-Calony>. Each push to `main` triggers a new Vercel deployment.

```bash
git add -A
git commit -m "Describe your change"
git push
```

---

## 3. Vercel (hosting)

1. Go to <https://vercel.com/new>, then **Import Git Repository** and pick **H1tro/MoodBase-Calony**.
2. Vercel detects **Vite** automatically (settings are also in [`vercel.json`](vercel.json)): build `npm run build`, output `dist`.
3. Under **Environment Variables**, add for *Production* and *Preview*:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Click **Deploy**. When it's done, copy the URL into Supabase's **Site URL** (step 1.4).
5. After changing environment variables, use **Redeploy**: Vite bakes them into the build.

---

## How cloud saving works

- The browser save (`localStorage`) stays the main save while you play, so the game also works offline.
- When a player is signed in, the colony, the sunrise checkpoint and the career profile (achievements, stats, options) are uploaded to their row in `public.saves` **a few seconds after each local save**.
- On sign-in, the game compares this device with the cloud:
  - only one side has a colony → it is copied to the other side;
  - only one side changed since the last sync → that side wins;
  - both changed → the player chooses **Keep this device's save** or **Use the cloud save**.
- **Cloud save** is on the title screen and in the in-game ☰ menu: sign in, see the sync status, *Save to cloud now*, *Load cloud save*, *Sign out*.
