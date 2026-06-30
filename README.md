# Roast My Profile

AI-powered comedy roast of developer profiles — GitHub, LinkedIn, or resume.
Built with Next.js 15 (App Router) + TypeScript. Neo-brutalist UI, zero
dependencies on the visitor's side. **Visitors never need their own API
key** — your Claude key lives only on the server.

## How it's structured

```
app/
  page.tsx              the whole UI (client component)
  layout.tsx             fonts + page metadata
  globals.css             neo-brutalist design system
  api/roast/route.ts     server route — calls GitHub + LLM, never exposed to the browser
lib/
  github.ts               fetches public GitHub profile + repo data
  llm.ts                  calls Groq, Gemini, or Claude (your choice via env vars)
  prompts.ts                the roast comedy-writer system prompt
  ratelimit.ts              simple per-IP daily cap (see "Rate limiting" below)
  types.ts / errors.ts      shared types
```

Nothing here needs a database, Stripe, or Supabase. It's the smallest
version of the product brief's roadmap that actually works for a stranger
clicking a link with zero setup on their end.

## 1. Get a free API key (no credit card)

The app defaults to **Groq** — a free LLM API with generous rate limits, good enough for roasts.

1. Go to [console.groq.com](https://console.groq.com) and sign up (Google or email).
2. Open **API Keys → Create API Key**. Copy it — it starts with `gsk_`.
3. Paste it into `GROQ_API_KEY` in `.env.local` (local) or Vercel environment variables (deployed).

**Alternative — Google Gemini (also free):** get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), then set `LLM_PROVIDER=gemini` and `GEMINI_API_KEY=your_key`.

**Anthropic Claude** still works if you set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`, but that API costs money after the one-time trial credit — skip it if you don't want to pay.

## 2. Run it locally (optional, but good for testing before you deploy)

```bash
npm install
# create .env.local with GROQ_API_KEY (see step 1 above)
npm run dev
```

Open `http://localhost:3000`. Try a roast. If it works locally, it'll work on Vercel.

## 3. Deploy to Vercel (free hosting)

**Recommended path — GitHub + Vercel, so future edits auto-deploy:**

1. Create a free GitHub account if you don't have one, then make a new repository and push this folder to it (GitHub's web UI has an "Add file → Upload files" button if you don't want to use git from a terminal).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New → Project**, and import the repository.
3. Vercel auto-detects Next.js — leave the build settings as default.
4. **Before clicking Deploy**, expand **Environment Variables** and add:
   - `GROQ_API_KEY` = your key from step 1
   - (optional) `FREE_ROASTS_PER_DAY` = `3` (caps usage per visitor per day)
5. Click **Deploy**. You'll get a live `*.vercel.app` URL in about a minute.

From now on, any change you push to the GitHub repo redeploys automatically.

**Faster path — Vercel Drop, no GitHub needed:** zip this whole folder, go to [vercel.com/drop](https://vercel.com/drop), drag the zip in, name the project, and deploy. You'll still need to add the same environment variables afterward in the project's **Settings → Environment Variables**, then redeploy once for them to take effect. The tradeoff: each drop is a one-off project, so future edits mean dropping again rather than auto-deploying.

## 4. Custom domain (optional)

In your Vercel project: **Settings → Domains** → add your domain → update the DNS records Vercel shows you at your registrar. Free SSL included. The domain name itself isn't free unless you already own one.

---

## Cost: $0 if you use Groq or Gemini

Hosting on Vercel's free tier is $0. **Groq and Google Gemini both offer free API tiers** — no credit card required for normal personal/small-launch usage. You may hit rate limits if traffic spikes, but you won't get a surprise bill.

The `FREE_ROASTS_PER_DAY` cap still limits each visitor (by IP) so one person can't hammer your endpoint all day.

**Groq free tier limits** (check [console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits) for current numbers): enough for dozens of roasts per minute on a hobby project. If you outgrow it, Gemini's free tier is a good backup — set `LLM_PROVIDER=gemini`.

If you switch to Anthropic Claude instead, that's metered per token and costs real money after trial credits — see Anthropic's pricing page if you go that route.

### One honest limitation: the rate limiter is "best effort," not airtight

`lib/ratelimit.ts` tracks usage in memory, inside the server process. On
Vercel's serverless platform, a traffic burst can spin up multiple
instances in parallel (each with its own counter), and any instance can
be recycled, resetting its counter to zero. In practice this means the
cap behaves like "roughly N per IP per day" rather than a mathematically
exact guarantee. It's enough to stop accidental or casual abuse — it
won't survive someone deliberately trying to defeat it.

If you want a hard guarantee later (worth doing once you have real
traffic), swap the inside of `checkRateLimit()` for a call to [Upstash
Redis](https://upstash.com) — it also has a genuinely free tier, persists
across serverless instances, and the function signature in that file was
written so the swap is small. Not required to launch; just the natural
next step.

## What's still not built (from the original product roadmap)

This covers roadmap Phase 1 and 2 — the roast engine and the shareable
card. Not included, and each would be a real follow-up project: payments
(Stripe, for the $1.99 watermark removal / $4.99 Pro tier), persistent
storage and a leaderboard (Supabase, Phase 3), roast battles (Phase 4),
and the Chrome extension (Phase 5). Happy to help build any of those next
when you're ready.
