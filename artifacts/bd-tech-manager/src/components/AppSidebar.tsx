import { Home, Target, CalendarDays, Settings, LogOut, DollarSign, Landmark, TrendingUp } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { isPureSystemAdmin } from "@/lib/roles";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  comingSoon?: boolean;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Financeiro", url: "/financeiro", icon: Landmark },
  { title: "Prospecção", url: "/prospeccao", icon: Target, comingSoon: true },
  { title: "Agenda", url: "/agenda", icon: CalendarDays, comingSoon: true },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const positionLabels: Record<string, { label: string; color: string }> = {
  "Diretor":              { label: "Diretor",        color: "bg-primary/20 text-primary border-primary/30" },
  "Executivo de Negócios":{ label: "Executivo",      color: "bg-success/20 text-success border-success/30" },
  "SDR":                  { label: "SDR",            color: "bg-warning/20 text-warning border-warning/30" },
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, role, position } = useAuth();

  const visibleItems = navItems.filter((item) => {
    if (isPureSystemAdmin(role, position)) return item.url === "/settings";
    return !item.roles || item.roles.includes(role);
  });
  const posInfo = positionLabels[position] || { label: position || "User", color: "bg-muted text-muted-foreground border-border" };

  return (
    <Sidebar collapsible="icon">
      {/* Brand header */}
      <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
        <div className="flex items-center gap-2.5 px-1 pt-1">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm tracking-tight text-foreground leading-tight">BD Tech</p>
              <p className="text-[10px] text-muted-foreground/60 tracking-wider uppercase">Manager</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    {item.comingSoon ? (
                      <div className="flex items-center gap-2.5 cursor-default opacity-40 px-2 py-2 rounded-md">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="text-sm">{item.title}</span>
                            <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0 h-4">
                              Em Breve
                            </Badge>
                          </>
                        )}
                      </div>
                    ) : (
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-all duration-150"
                        activeClassName="text-primary bg-primary/10 hover:bg-primary/10 hover:text-primary font-medium border-l-2 border-primary pl-[6px]"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 pt-2">
        {/* Position badge */}
        {!collapsed && (
          <div className="px-2 pb-2">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md border ${posInfo.color}`}>
              <DollarSign className="h-3 w-3" />
              {isPureSystemAdmin(role, position) ? "Admin" : posInfo.label}
            </span>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="flex items-center gap-2.5 px-2 py-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 cursor-pointer"
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
