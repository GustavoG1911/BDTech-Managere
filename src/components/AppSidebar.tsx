import { Home, Settings, LogOut, TrendingUp, Landmark, Target, CalendarDays, Zap } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { isPureSystemAdmin } from "@/lib/roles";
import { useAppLogo } from "@/hooks/useAppLogo";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { title: "Dashboard",     url: "/",           icon: Home },
  { title: "Prospecção",    url: "/prospeccao", icon: Target },
  { title: "Agenda",        url: "/agenda",     icon: CalendarDays },
  { title: "Financeiro",    url: "/financeiro",  icon: Landmark },
  { title: "Configurações", url: "/settings",    icon: Settings },
];

const positionColors: Record<string, string> = {
  "Diretor":               "text-primary   bg-primary/12   border-primary/25",
  "Executivo de Negócios": "text-success   bg-success/12   border-success/25",
  "SDR":                   "text-warning   bg-warning/12   border-warning/25",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, role, position } = useAuth();
  const isAdmin = isPureSystemAdmin(role, position);
  const { logoUrl } = useAppLogo();

  const visible = navItems.filter((item) => {
    if (isAdmin) return item.url === "/settings";
    return true;
  });

  const posColor = positionColors[position] ?? "text-muted-foreground bg-muted/50 border-border/40";
  const posLabel = isAdmin ? "Admin" : (position ?? "—");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* ── Brand ── */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          {/* Logo: custom image or default icon */}
          <div className="h-8 w-8 rounded-xl overflow-hidden shrink-0
                          bg-gradient-to-br from-primary to-primary/60
                          flex items-center justify-center
                          shadow-md shadow-primary/30">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <TrendingUp className="h-4 w-4 text-white" />
            )}
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold tracking-tight text-foreground leading-none">
                BD Tech
              </p>
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground/50 mt-0.5">
                Manager
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {/* ── Main nav ── */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {visible.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                                 text-muted-foreground hover:text-foreground
                                 hover:bg-sidebar-accent/80 transition-all duration-150 w-full"
                      activeClassName="text-primary bg-primary/10 hover:bg-primary/10 hover:text-primary font-semibold"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="text-sm truncate">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="border-t border-sidebar-border px-2 py-2 space-y-1">
        {/* Position badge */}
        {!collapsed && (
          <div className="px-1 pb-1">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold
                              px-2.5 py-1 rounded-lg border ${posColor}`}>
              <Zap className="h-3 w-3" />
              {posLabel}
            </span>
          </div>
        )}

        {/* Logout */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip={collapsed ? "Sair" : undefined}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg w-full
                         text-muted-foreground hover:text-destructive
                         hover:bg-destructive/10 transition-all duration-150 cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm">Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
