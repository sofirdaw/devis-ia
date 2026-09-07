import { createClient } from "@/lib/supabase/server";

export async function isCurrentUserAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const adminIds = (process.env.ADMIN_USER_ID || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const adminEmails = [process.env.ADMIN_EMAIL, ...(process.env.ADMIN_EMAILS || "").split(",")]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return (
    adminIds.includes(user.id) ||
    (user.email ? adminEmails.includes(user.email.toLowerCase()) : false)
  );
}
