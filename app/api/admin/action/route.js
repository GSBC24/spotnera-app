import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPlatformAdmin } from "@/lib/server/platform-admin";
import { validateAdminAction } from "@/lib/server/admin-action-validation.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  const access = await getPlatformAdmin();
  if (access.status !== 200) {
    return NextResponse.json({ error: "Admin access required." }, { status: access.status });
  }
  const action = validateAdminAction(await request.json().catch(() => null));
  if (!action) {
    return NextResponse.json({ error: "Check the action, reason, and note." }, { status: 400 });
  }
  const { data, error } = await access.supabase.rpc("perform_admin_action", {
    p_action: action.action,
    p_target_id: action.targetId,
    p_reason: action.reason,
    p_admin_note: action.note,
  });
  if (error) {
    console.error("Admin action failed", error.code);
    return NextResponse.json({ error: "The action could not be saved. Please try again." }, { status: 500 });
  }
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/owner");
  revalidatePath("/business/[id]", "page");
  return NextResponse.json({ changed: data === true });
}
