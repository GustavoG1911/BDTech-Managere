import { RefreshCw } from "lucide-react";

type AppLoadingScreenProps = {
  message?: string;
  detail?: string;
  fullScreen?: boolean;
};

export function AppLoadingScreen({
  message = "Carregando",
  detail = "Sincronizando perfil, permissões e dados.",
  fullScreen = true,
}: AppLoadingScreenProps) {
  return (
    <div className={`relative overflow-hidden bg-background ${fullScreen ? "min-h-screen" : "min-h-[calc(100vh-52px)]"}`}>
      <div className="absolute inset-0 scale-[1.03] opacity-60 blur-sm">
        <div className="flex h-full">
          <div className="hidden w-64 shrink-0 border-r border-border/50 bg-card/70 p-4 md:block">
            <div className="mb-6 h-9 w-32 rounded-lg bg-muted/70" />
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="h-9 rounded-lg bg-muted/50" />
              ))}
            </div>
          </div>

          <div className="flex-1 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="mb-2 h-5 w-44 rounded bg-muted/70" />
                <div className="h-3 w-64 rounded bg-muted/40" />
              </div>
              <div className="h-9 w-28 rounded-lg bg-muted/60" />
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 rounded-xl border border-border/50 bg-card/70" />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="h-80 rounded-xl border border-border/50 bg-card/70" />
              <div className="h-80 rounded-xl border border-border/50 bg-card/70" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-background/55 backdrop-blur-md" />

      <div className="relative z-10 flex items-center justify-center p-4" style={{ minHeight: "inherit" }}>
        <div className="w-full max-w-xs rounded-2xl border border-border/70 bg-card/95 p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">{message}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}
