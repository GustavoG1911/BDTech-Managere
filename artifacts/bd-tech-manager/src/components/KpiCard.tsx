import { LucideIcon, HelpCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

const styles = {
  default: {
    card:      "border-border/70",
    icon:      "bg-muted/60 text-muted-foreground ring-1 ring-border/50",
    value:     "text-foreground",
    bar:       "",
    glow:      "",
  },
  primary: {
    card:      "border-primary/20",
    icon:      "bg-primary/15 text-primary ring-1 ring-primary/20",
    value:     "text-primary",
    bar:       "bg-primary",
    glow:      "glow-blue",
  },
  success: {
    card:      "border-success/20",
    icon:      "bg-success/15 text-success ring-1 ring-success/20",
    value:     "text-success",
    bar:       "bg-success",
    glow:      "glow-green",
  },
  warning: {
    card:      "border-warning/20",
    icon:      "bg-warning/15 text-warning ring-1 ring-warning/20",
    value:     "text-warning",
    bar:       "bg-warning",
    glow:      "glow-yellow",
  },
} as const;

export function KpiCard({
  title, value, icon: Icon, trend, subtitle, variant = "default", tooltip, onClick,
}: KpiCardProps) {
  const s = styles[variant];

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "relative bg-card rounded-xl border p-5 flex flex-col gap-4 overflow-hidden select-none",
        s.card, s.glow,
        onClick && "cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.99]",
        !onClick && "cursor-default",
      )}
    >
      {/* Left accent stripe */}
      {s.bar && (
        <div className={cn(
          "absolute inset-y-0 left-0 w-[3px] rounded-r-full opacity-70",
          s.bar,
        )} />
      )}

      {/* Top: label + icon */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-start gap-x-1.5 gap-y-0.5 min-w-0 flex-1">
          <p className="section-label leading-tight">{title}</p>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="cursor-help shrink-0 mt-px"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <HelpCircle className="h-3 w-3 text-muted-foreground/35 hover:text-muted-foreground transition-colors" />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[240px] text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className={cn(
          "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
          s.icon,
        )}>
          <Icon style={{ width: 15, height: 15 }} />
        </div>
      </div>

      {/* Bottom: value + trend */}
      <div className="space-y-1">
        <p className={cn("text-2xl font-bold tracking-tight tabular-nums", s.value)}>
          {value}
        </p>
        {trend && (
          <p className="text-xs text-muted-foreground leading-snug">{trend}</p>
        )}
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/50 leading-snug">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
