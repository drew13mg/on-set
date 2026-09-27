import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import * as ExpoCrypto from "expo-crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Remote, RemoteRow } from "./sync/engine";

// Give the JS runtime a secure random source (used for ids and sign-in).
const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = ExpoCrypto.getRandomValues;

// Public values: the publishable key only allows what the database access rules allow.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://upjtapmgidpmtudjhtpv.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_e-3K9g9Pxa9tts4t9GDgCw_EbDTn4iC";

const isSSR = Platform.OS === "web" && typeof window === "undefined";

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isSSR
      ? { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} }
      : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

// Keep the session fresh only while the app is in the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

const PAGE = 1000;

async function paged(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>) {
  const out: RemoteRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as RemoteRow[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** The sync engine's view of the database. Access rules decide what each user can see. */
export function supabaseRemote(client: SupabaseClient = supabase): Remote {
  return {
    upsert: async (table, rows) => {
      const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
    },
    pullSince: (table, cursor) =>
      paged((from, to) => {
        let q = client.from(table).select("*").order("server_updated_at").order("id").range(from, to);
        if (cursor) q = q.gte("server_updated_at", cursor);
        return q;
      }),
    pullProject: (table, projectId) =>
      paged((from, to) => client.from(table).select("*").eq("project_id", projectId).order("id").range(from, to)),
    accessibleProjectIds: async () => {
      const rows = await paged((from, to) =>
        client.from("projects").select("id").eq("deleted", false).order("id").range(from, to),
      );
      return rows.map((r) => String(r.id));
    },
  };
}
