import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "app-assets";
const LOGO_PATH = "system-logo";

function getPublicUrl(): string {
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(LOGO_PATH);
  return publicUrl;
}

export function useAppLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const probe = useCallback(async () => {
    setLoading(true);
    try {
      const base = getPublicUrl();
      const res = await fetch(`${base}?t=${Date.now()}`, { method: "HEAD" });
      if (res.ok) {
        setLogoUrl(`${base}?t=${Date.now()}`);
      } else {
        setLogoUrl(null);
      }
    } catch {
      setLogoUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  const uploadLogo = async (file: File): Promise<string> => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(LOGO_PATH, file, { upsert: true, contentType: file.type });

    if (error) throw error;

    const busted = `${getPublicUrl()}?t=${Date.now()}`;
    setLogoUrl(busted);
    return busted;
  };

  const removeLogo = async () => {
    await supabase.storage.from(BUCKET).remove([LOGO_PATH]);
    setLogoUrl(null);
  };

  return { logoUrl, loading, uploadLogo, removeLogo, refresh: probe };
}
