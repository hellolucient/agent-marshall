/**
 * Bootstrap — Ensure env and optional DB state.
 * Run: npx tsx scripts/bootstrap.ts
 */
import 'dotenv/config';

async function main() {
  const required = ['OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('Missing env:', missing.join(', '));
    console.error('Copy .env.example to .env and set values.');
    process.exit(1);
  }
  console.log('Env check passed.');
  console.log('Next: Run the Supabase schema in your project SQL editor: memory/schemas.sql');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
