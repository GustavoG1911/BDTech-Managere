import { supabase } from "@/integrations/supabase/client";

export async function getCurrentUserContext() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  const isTestEnv = user?.email?.endsWith("@teste.com") || false;

  return { user, isTestEnv };
}
