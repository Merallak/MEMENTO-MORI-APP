import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function getMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data ?? null;
}

export async function updateMyProfile(params: {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
}): Promise<ProfileRow> {
  const { userId, fullName, avatarUrl } = params;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("PROFILE_UPDATE_FAILED");
  }

  return data;
}