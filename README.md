# Agent Marshall

Editorial intelligence system for **Marshall S Martineau**, pseudonymous author of *Beyond Hallucinations*. Marshall is a practical AI translator for professionals — pragmatic, conversational, and grounded in real-world use (judgment, workflows, hallucinations in context), not academic epistemology.

Agent Marshall is a **lean autonomous publishing system** that:

- Researches ideas from **RSS** and optional **X/Twitter recent search** (same pipeline as articles → ideas → drafts)
- Generates candidate ideas and runs them through an internal **swarm** (Philosopher, Skeptic, Futurist, Editor, Signal Analyst)
- Produces drafts: tweets, threads, replies, Substack outlines
- Surfaces follow recommendations
- Requires **manual approval** before any X publish; Substack remains draft-only

Quality and credibility are prioritized over volume.

---

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **OpenAI API** (GPT-4o-mini default)
- **Supabase** (PostgreSQL)
- **Vercel** (deploy + cron)

---

## Setup

### 1. Clone and install

```bash
cd agent-marshall
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and set:

- `OPENAI_API_KEY` — required for all agents
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key
- `SUPABASE_SERVICE_ROLE_KEY` — service role (server-only; never expose)
- `CRON_SECRET` — optional; set in Vercel for cron auth (Bearer token)
- `RESEARCH_RSS_FEEDS` — optional; comma-separated RSS feed URLs
- `RESEARCH_TWITTER_QUERIES` + `RESEARCH_TWITTER_MAX_QUERIES_PER_RUN` + `RESEARCH_TWITTER_MAX_PER_QUERY` — optional X search; **default lean: 1 query × 10 tweets per manual refresh**, **no Twitter on daily cron** unless `RESEARCH_TWITTER_ON_HEARTBEAT=true` (avoids surprise credit use).
- X API keys — required for **Publish**; if unset, Publish fails and the draft stays **approved** (nothing marked published until X returns a tweet id). **403 when publishing (even if app already says Read & write):** the **Access Token + Secret in `.env` were almost certainly created while the app was still Read-only**. Changing the dropdown does **not** retroactively upgrade tokens. **Regenerate Access Token & Secret** (Keys and tokens tab), paste into `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET`, restart. Sanity check: open **`/api/x/verify`** while logged into the app (or curl locally) — if publish still 403 after fresh tokens, check X’s exact error (reply target deleted, code 453 account restriction, etc.).

### 3. Database

In the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql), run the contents of `memory/schemas.sql` to create tables:

- `research_items`, `post_ideas`, `draft_posts`, `published_posts`
- `interactions`, `followed_accounts`, `performance_metrics`, `reflection_notes`

### 4. Bootstrap check

```bash
npm run bootstrap
```

### 5. Run locally

```bash
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Dashboard: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Reply targets:** [http://localhost:3000/dashboard/replies](http://localhost:3000/dashboard/replies) — Twitter search hits → **Draft reply** → **Drafts** (approve) → **Publish** (posts as real X reply)

### 6. Manual cron (optional)

Uses `.env` from the project root (same as `npm run dev`). Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set there.

```bash
npm run cron:heartbeat daily   # research, ideas, swarm, tweets, follow recs
npm run cron:heartbeat weekly  # thread, Substack outline, reflection
```

**Why it looks “stuck”:** the daily job prints progress to stderr. The **swarm** step runs up to **5 ideas × 5 LLM roles** in sequence (often **5–15+ minutes**). For a quicker local run, set in `.env`: `HEARTBEAT_SWARM_LIMIT=1` or `2`.

---

## Vercel deployment

1. Connect the repo to Vercel.
2. Add env vars in Project Settings → Environment Variables.
3. Set **CRON_SECRET** and use it in Vercel Cron (Authorization: Bearer \<CRON_SECRET\>).
4. Cron jobs (in `vercel.json`):
   - **Daily** at 14:00 UTC: `/api/cron/daily`
   - **Weekly** Sunday 15:00 UTC: `/api/cron/weekly`

---

## Dashboard

**Fresh start (messy drafts):** run `memory/reset-database.sql` in Supabase SQL Editor (truncates research, ideas, drafts, published log, follows, etc.). Then run **Daily** heartbeat once.

At **/dashboard** the operator can:

- **Sign in** — Set `DASHBOARD_PASSWORD` in env; open `/login` once per browser. **Sign out** clears the session.
- **Run heartbeat (manual)** — **Daily** = main pipeline (RSS → ideas → swarm → tweets → follow recs). **Weekly** = thread + Substack outline + reflection. No cron secret in the UI—your login cookie authorizes the request. Vercel Cron still uses `CRON_SECRET` only. Long runs: keep the tab open; or `npm run cron:heartbeat daily` locally.
- **Post drafts** — Tweets, threads, Substack outlines (same DB table `draft_posts`).
- **Reply drafts** — Separate table `reply_drafts`; created from Reply targets. Same approve → publish flow.
- **Edit** draft content.
- **Approve** or **Reject** drafts.
- **Publish** approved tweets/threads/replies (calls Publisher agent; Substack is never auto-published).

At **/dashboard/follows**:

- View follow suggestions from the Networker agent.
- Mark as **Followed** or **Dismissed**.

---

## Pipeline

1. **Research** — RSS (and later: saved articles, papers) → `research_items`
2. **Idea generation** — Research + themes → 10+ candidate `post_ideas`
3. **Swarm** — Each idea evaluated by Philosopher, Skeptic, Futurist, Editor, Signal Analyst; scores stored
4. **Writing** — Top swarm-scored ideas → **5 tweet drafts/day** by default (`DAILY_TWEET_DRAFT_LIMIT`; `HEARTBEAT_SWARM_LIMIT` ≥ that). Weekly: thread + Substack outline
5. **Engager** — Reply drafts (8–12/day cap). Publish: **reply** → **quote** → **standalone** (text + URL, when X blocks both reply and quote). POST `/api/engager` with `{ "discussions": [ … ] }`.
6. **Networker** — 3–5 follow recommendations per day
7. **Approval** — Post drafts in `draft_posts`; reply drafts in `reply_drafts` until approved
8. **Publisher** — Approved items only; X only (Substack manual)
9. **Reflection** — Weekly summary of engagement and performance

---

## Identity and voice

Marshall’s identity is defined in **brain/**:

- `identity.md` — Who Marshall is and stands for
- `soul.md` — Disposition and boundaries
- `worldview.md` — Themes and scope
- `voice.md` — Tone and style rules

These files are loaded before any content generation. Edit them to refine Marshall’s voice.

---

## Quality rules

- No mass-following
- No generic trend lists or empty praise replies
- Prefer fewer high-quality posts
- Default: 2 tweets/day, 8–12 reply drafts/day, 3–5 follow recs/day, 1 thread/week, 1 Substack outline/week

---

## License

Private / internal use. No warranty.
