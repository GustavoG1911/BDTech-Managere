import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  userId: string;
  currentUrl?: string | null;
  initials: string;
  onUpload?: (url: string) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
}

const sizeMap = {
  sm: { outer: "h-10 w-10", text: "text-xs", icon: "h-3.5 w-3.5" },
  md: { outer: "h-16 w-16", text: "text-base", icon: "h-4 w-4" },
  lg: { outer: "h-20 w-20", text: "text-lg", icon: "h-5 w-5" },
};

export function AvatarUpload({
  userId,
  currentUrl,
  initials,
  onUpload,
  size = "md",
  readOnly = false,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const s = sizeMap[size];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPG, PNG ou WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2 MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const bustedUrl = `${publicUrl}?t=${Date.now()}`;

      await supabase.auth.updateUser({ data: { avatar_url: bustedUrl } });

      setPreview(bustedUrl);
      onUpload?.(bustedUrl);
      toast.success("Foto de perfil atualizada!");
    } catch (err: any) {
      setPreview(currentUrl ?? null);
      const msg: string = err?.message ?? "";
      if (msg.toLowerCase().includes("bucket")) {
        toast.error("Bucket 'avatars' não existe. Crie-o em Supabase → Storage → Buckets (público).");
      } else {
        toast.error("Erro ao enviar foto: " + (msg || "Tente novamente."));
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn("relative group", !readOnly && !uploading && "cursor-pointer")}
      onClick={() => !readOnly && !uploading && inputRef.current?.click()}
    >
      <div
        className={cn(
          "rounded-full overflow-hidden border-2 border-border/50",
          "bg-primary/15 flex items-center justify-center select-none shrink-0",
          s.outer,
          !readOnly && !uploading && "group-hover:border-primary/60 transition-colors",
        )}
      >
        {uploading ? (
          <Loader2 className={cn("animate-spin text-primary/60", s.icon)} />
        ) : preview ? (
          <img
            src={preview}
            alt="Avatar"
            className="h-full w-full object-cover"
            onError={() => setPreview(null)}
          />
        ) : (
          <span className={cn("font-bold text-primary", s.text)}>{initials}</span>
        )}
      </div>

      {!readOnly && !uploading && (
        <div className={cn(
          "absolute inset-0 rounded-full bg-black/50",
          "flex items-center justify-center",
          "opacity-0 group-hover:opacity-100 transition-opacity",
        )}>
          <Camera className={cn("text-white", s.icon)} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
