import { LucideIcon, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  subtitle?: string;
  variant?: "default" | "primary" | "success" | "warning";
  tooltip?: string;
  onClick?: () => void;
}

const variantConfig = {
  default: {
    border:     "border-border/60",
    iconBg:     "bg-muted/60",
    iconColor:  "text-muted-foreground",
    valueColor: "text-foreground",
    accentBar:  "",
    glow:       "",
  },
  primary: {
    border:     "border-primary/25",
    iconBg:     "bg-primary/15",
    iconColor:  "text-primary",
    valueColor: "text-primary",
    accentBar:  "bg-primary",
    glow:       "glow-blue",
  },
  success: {
    border:     "border-success/25",
    iconBg:     "bg-success/15",
    iconColor:  "text-success",
    valueColor: "text-success",
    accentBar:  "bg-success",
    glow:       "glow-green",
  },
  warning: {
    border:     "border-warning/25",
    iconBg:     "bg-warning/15",
    iconColor:  "text-warning",
    valueColor: "text-warning",
    accentBar:  "bg-warning",
    glow:       "glow-yellow",
  },
} as const;

export function KpiCard({ title, value, icon: Icon, trend, subtitle, variant = "default", tooltip, onClick }: KpiCardProps) {
  const cfg = variantConfig[variant];

  return (
    <div
      className={`relative bg-card rounded-xl border ${cfg.border} ${cfg.glow} p-5 flex flex-col gap-3 overflow-hidden transition-all duration-200 ${onClick ? "cursor-pointer hover:scale-[1.015] hover:shadow-lg active:scale-[0.99]" : ""}`}
      onClick={onClick}
    >
      {/* Left accent stripe */}
      {cfg.accentBar && (
        <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full ${cfg.accentBar} opacity-60`} />
      )}

      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="section-label">{title}</span>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span onClick={(e) => e.stopPropagation()} className="cursor-help">
                    <HelpCircle className="h-3 w-3 text-muted-foreground/35" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs" onClick={(e) => e.stopPropagation()}>
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className={`h-9 w-9 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0 ring-1 ring-inset ring-white/5`}>
          <Icon className={cfg.iconColor} style={{ width: 17, height: 17 }} />
        </div>
      </div>

      {/* Value */}
      <div>
        <p className={`text-2xl font-bold tracking-tight ${cfg.valueColor} tabular-nums`}>{value}</p>
        {trend && <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{trend}</p>}
        {subtitle && <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">{subtitle}</p>}
      </div>
    </div>
  );
}
