import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { OnboardingModal } from "@/components/OnboardingModal";
import { NotificationBell } from "@/components/NotificationBell";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/financeiro": "Financeiro",
  "/settings": "Configurações",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const pageTitle = PAGE_TITLES[pathname] ?? "BD Tech";

  return (
    <SidebarProvider>
      <div className="dark min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/50 bg-card/95 backdrop-blur-md sticky top-0 z-30 px-3 gap-3">
            <SidebarTrigger className="ml-1 text-muted-foreground hover:text-foreground transition-colors" />
            <div className="h-4 w-px bg-border/60" />
            <span className="text-sm font-semibold text-foreground/90 tracking-tight">
              {pageTitle}
            </span>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <OnboardingModal />
    </SidebarProvider>
  );
}
