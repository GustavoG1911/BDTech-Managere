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
    border: "border-border/60",
    iconBg: "bg-muted/60",
    iconColor: "text-muted-foreground",
    valueColor: "text-foreground",
    glow: "",
    accent: "bg-muted/40",
  },
  primary: {
    border: "border-primary/30",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    valueColor: "text-primary",
    glow: "glow-blue",
    accent: "bg-primary/8",
  },
  success: {
    border: "border-success/30",
    iconBg: "bg-success/15",
    iconColor: "text-success",
    valueColor: "text-success",
    glow: "glow-green",
    accent: "bg-success/8",
  },
  warning: {
    border: "border-warning/30",
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    valueColor: "text-warning",
    glow: "glow-yellow",
    accent: "bg-warning/8",
  },
} as const;

export function KpiCard({ title, value, icon: Icon, trend, subtitle, variant = "default", tooltip, onClick }: KpiCardProps) {
  const cfg = variantConfig[variant];

  return (
    <div
      className={`relative bg-card rounded-xl border ${cfg.border} ${cfg.glow} p-5 flex flex-col gap-3 transition-all duration-200 ${onClick ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg" : ""}`}
      onClick={onClick}
    >
      {/* Top row: title + icon */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">{title}</span>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span onClick={(e) => e.stopPropagation()} className="cursor-help">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs" onClick={(e) => e.stopPropagation()}>
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className={`h-9 w-9 rounded-lg ${cfg.iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-4.5 w-4.5 ${cfg.iconColor}`} style={{ width: 18, height: 18 }} />
        </div>
      </div>

      {/* Value */}
      <div>
        <p className={`text-2xl font-bold tracking-tight ${cfg.valueColor}`}>{value}</p>
        {trend && <p className="text-xs text-muted-foreground mt-1 leading-snug">{trend}</p>}
        {subtitle && <p className="text-[10px] text-muted-foreground/55 mt-0.5 leading-snug">{subtitle}</p>}
      </div>

      {/* Bottom accent bar */}
      {variant !== "default" && (
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl ${cfg.iconBg}`} />
      )}
    </div>
  );
}
