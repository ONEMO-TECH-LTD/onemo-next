const NEXT_PUBLIC_SUPABASE_URL = "NEXT_PUBLIC_SUPABASE_URL";
const NEXT_PUBLIC_SUPABASE_ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SUPABASE_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabasePublicConfig() {
  return {
    url: getRequiredEnv(NEXT_PUBLIC_SUPABASE_URL),
    anonKey: getRequiredEnv(NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function getSupabaseServiceRoleKey() {
  return getRequiredEnv(SUPABASE_SERVICE_ROLE_KEY);
}
