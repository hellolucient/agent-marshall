/**
 * Environment configuration for Agent Marshall.
 * All env vars are validated at runtime where used.
 */

export const env = {
  get openaiApiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is required');
    return key;
  },
  get supabaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
    return url;
  },
  get supabaseServiceKey(): string {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
    return key;
  },
  get supabaseAnonKey(): string {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
    return key;
  },
  /** Optional: X API keys for publishing. If missing, dashboard shows drafts only. */
  get xApiKey(): string | undefined {
    return process.env.X_API_KEY;
  },
  get xApiSecret(): string | undefined {
    return process.env.X_API_SECRET;
  },
  get xAccessToken(): string | undefined {
    return process.env.X_ACCESS_TOKEN;
  },
  get xAccessTokenSecret(): string | undefined {
    return process.env.X_ACCESS_TOKEN_SECRET;
  },
  /** Cron secret to protect Vercel cron endpoints */
  get cronSecret(): string | undefined {
    return process.env.CRON_SECRET;
  },
} as const;
