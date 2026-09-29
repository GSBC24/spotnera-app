import "server-only";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkPlatformAdminAccess } from "./platform-admin-access.mjs";

export async function getPlatformAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: 401 };

  const admin = createAdminClient();
  const status = await checkPlatformAdminAccess(user, (userId) => admin
    .from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle());
  if (status !== 200) return { status };
  return { status: 200, supabase, admin, user };
}
