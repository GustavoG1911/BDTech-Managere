import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { OnboardingModal } from "@/components/OnboardingModal";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { AvatarUpload } from "@/components/AvatarUpload";

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/":           { title: "Dashboard",      description: "Visão geral de performance e fechamentos" },
  "/financeiro": { title: "Financeiro",     description: "Gestão de recebíveis e pagamentos" },
  "/settings":   { title: "Configurações",  description: "Perfil, equipe, metas e parâmetros" },
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const meta = PAGE_META[pathname] ?? { title: "BD Tech", description: "" };
  const avatarUrl = user?.user_metadata?.avatar_url ?? null;
  const fullName: string = user?.user_metadata?.full_name ?? user?.email ?? "";
  const initials = fullName
    ? fullName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? "BD");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ── Sticky Header ── */}
          <header className="h-[52px] shrink-0 flex items-center gap-3 px-4
                             border-b border-border/60
                             bg-card/80 backdrop-blur-md
                             sticky top-0 z-30">
            <SidebarTrigger className="h-7 w-7 rounded-lg text-muted-foreground
                                       hover:bg-accent hover:text-foreground
                                       transition-colors" />

            <div className="h-4 w-px bg-border/70" />

            <div className="flex flex-col justify-center leading-none">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                {meta.title}
              </span>
              {meta.description && (
                <span className="text-[10px] text-muted-foreground/60 mt-0.5 hidden sm:block">
                  {meta.description}
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <NotificationBell />
              {user && (
                <AvatarUpload
                  userId={user.id}
                  currentUrl={avatarUrl}
                  initials={initials}
                  size="sm"
                  readOnly
                />
              )}
            </div>
          </header>

          {/* ── Main content ── */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      <OnboardingModal />
    </SidebarProvider>
  );
}
