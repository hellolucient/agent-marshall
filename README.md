# Agent Marshall

Editorial intelligence system for **Marshall S Martineau**, pseudonymous author of *Beyond Hallucinations*. Marshall writes about AI and truth, hallucinations and confidence, epistemology, cognition, and what AI reveals about human thinking.

Agent Marshall is a **lean autonomous publishing system** that:

- Researches ideas from RSS and notes
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
- `RESEARCH_RSS_FEEDS` — optional; comma-separated RSS URLs for research
- X API keys — optional; if unset, publishing is simulated and drafts are stored

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

At **/dashboard** the operator can:

- **Sign in** — Set `DASHBOARD_PASSWORD` in env; open `/login` once per browser. **Sign out** clears the session.
- **Run heartbeat (manual)** — **Daily** = main pipeline (RSS → ideas → swarm → tweets → follow recs). **Weekly** = thread + Substack outline + reflection. No cron secret in the UI—your login cookie authorizes the request. Vercel Cron still uses `CRON_SECRET` only. Long runs: keep the tab open; or `npm run cron:heartbeat daily` locally.
- **Drafts** — View tweets, threads, replies, Substack outlines. Filter by type and status.
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
4. **Writing** — Top ideas → draft tweets (2/day), thread (1/week), Substack outline (1/week)
5. **Engager** — Reply drafts from discussion context (8–12/day cap). POST to `/api/engager` with `{ "discussions": [ { "post_id", "author_handle", "content", "thread_context?" } ] }`.
6. **Networker** — 3–5 follow recommendations per day
7. **Approval** — All content stays in `draft` until operator approves
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
