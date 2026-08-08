import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return { url, anon };
}

/**
 * True when public Supabase env vars are present.
 * Login is NOT required — anon key is enough for public storage + tables.
 */
export const isSupabaseConfigured = (() => {
  const { url, anon } = readEnv();
  return Boolean(url && anon);
})();

let client: SupabaseClient | null = null;
/** Session-less client for public storage uploads (anon key only). */
let storageClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client whenever URL + anon key exist.
 * Does NOT require a logged-in user session.
 */
export function getSupabase(): SupabaseClient | null {
  const { url, anon } = readEnv();
  if (!url || !anon) return null;
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/**
 * Anon-only client for Storage. Never attaches a user JWT, so public-bucket
 * uploads work for anonymous device users and email/password users alike.
 */
export function getSupabaseStorage(): SupabaseClient | null {
  const { url, anon } = readEnv();
  if (!url || !anon) return null;
  if (!storageClient) {
    storageClient = createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return storageClient;
}
