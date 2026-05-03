import { Home, Target, CalendarDays, Settings, LogOut, DollarSign, Landmark, TrendingUp } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { isPureSystemAdmin } from "@/lib/roles";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  roles?: UserRole[];
}

interface ComingSoonItem {
  title: string;
  icon: any;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Financeiro", url: "/financeiro", icon: Landmark },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const comingSoonItems: ComingSoonItem[] = [
  { title: "Prospecção", icon: Target },
  { title: "Agenda", icon: CalendarDays },
];

const positionLabels: Record<string, { label: string; color: string }> = {
  "Diretor":               { label: "Diretor",   color: "bg-primary/15 text-primary border-primary/25" },
  "Executivo de Negócios": { label: "Executivo", color: "bg-success/15 text-success border-success/25" },
  "SDR":                   { label: "SDR",       color: "bg-warning/15 text-warning border-warning/25" },
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, role, position } = useAuth();

  const visibleItems = navItems.filter((item) => {
    if (isPureSystemAdmin(role, position)) return item.url === "/settings";
    return !item.roles || item.roles.includes(role);
  });

  const posInfo = positionLabels[position] || {
    label: position || "User",
    color: "bg-muted/60 text-muted-foreground border-border/40",
  };

  return (
    <Sidebar collapsible="icon">
      {/* Brand */}
      <SidebarHeader className="border-b border-sidebar-border/50 pb-3">
        <div className="flex items-center gap-2.5 px-1 pt-1">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm tracking-tight text-foreground leading-tight">BD Tech</p>
              <p className="text-[9px] text-muted-foreground/50 tracking-widest uppercase">Manager</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {/* Main Nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-all duration-150"
                      activeClassName="text-primary bg-primary/10 hover:bg-primary/10 hover:text-primary font-semibold"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Em Breve */}
        {!isPureSystemAdmin(role, position) && (
          <SidebarGroup className="mt-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-[9px] tracking-widest uppercase text-muted-foreground/40 px-2 mb-1">
                Em breve
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {comingSoonItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild disabled>
                      <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg opacity-30 cursor-default select-none">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 pt-2 space-y-1">
        {/* Position badge */}
        {!collapsed && (
          <div className="px-2 pb-1">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border ${posInfo.color}`}>
              <DollarSign className="h-3 w-3" />
              {isPureSystemAdmin(role, position) ? "Admin" : posInfo.label}
            </span>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 cursor-pointer"
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
