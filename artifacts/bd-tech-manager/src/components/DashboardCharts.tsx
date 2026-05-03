import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ComposedChart, Line, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/commission";
import { TrendingUp, Target, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── palette ── */
const C = {
  bg:    "#0D1320",
  bdr:   "#192035",
  fg:    "#E4EAF5",
  muted: "#728BAE",
  blue:  "#4F8EF7",
  green: "#10b981",
  warn:  "#f59e0b",
} as const;

const tip = {
  contentStyle: {
    backgroundColor: C.bg, border: `1px solid ${C.bdr}`,
    borderRadius: "10px", color: C.fg, fontSize: "12px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.5)", padding: "8px 14px",
  },
  labelStyle:  { color: C.fg, fontWeight: 600, marginBottom: 4 },
  cursor:      { fill: "rgba(255,255,255,0.03)" },
  itemStyle:   { color: C.muted },
};

/* ── types ── */
export interface ChartDataPoint {
  name: string;
  monthKey: string;
  bluepexVolume: number;
  opusVolume: number;
  bluepexPres: number;
  opusPres: number;
  totalVolume: number;
  totalPres: number;
}

interface DashboardChartsProps {
  chartTimeline: ChartDataPoint[];
  isSingleMonth: boolean;
  superMetaThreshold?: number;
}

/* ════════════════════════════════════════════════════════════
   SINGLE-MONTH VIEW
   Left  — Donut: operation volume split
   Right — Goal bars: presentations vs commission targets
════════════════════════════════════════════════════════════ */

function OperationDonut({ data }: { data: ChartDataPoint }) {
  const slices = [
    { name: "BluePex",   value: data.bluepexVolume, color: C.blue  },
    { name: "Opus Tech", value: data.opusVolume,    color: C.green },
  ];
  const total = data.bluepexVolume + data.opusVolume;

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5 flex flex-col h-[280px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
          <Activity className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="section-label">Split por Operação</span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {total === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground/40 text-sm">
            Sem volume no período
          </div>
        ) : (
          <>
            {/* chart + center-label overlay */}
            <div className="relative flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <PieChart>
                  <Pie
                    data={slices}
                    cx="50%" cy="50%"
                    innerRadius="50%" outerRadius="72%"
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                    labelLine={false}
                    isAnimationActive={true}
                  >
                    {slices.map((s) => (
                      <Cell key={s.name} fill={s.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v: number, n: string) => [formatCurrency(v), n]}
                    contentStyle={tip.contentStyle}
                    labelStyle={tip.labelStyle}
                    itemStyle={tip.itemStyle}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Absolutely-positioned center label — no SVG coord issues */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center leading-tight">
                  <p className="text-[10px] text-muted-foreground/55 font-medium uppercase tracking-wide">
                    Volume Total
                  </p>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    {formatCurrency(total)}
                  </p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-2">
              {slices.map((s) => {
                const pct = total > 0 ? ((s.value / total) * 100).toFixed(0) : "0";
                return (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-muted-foreground">{s.name}</span>
                    <span className="text-xs font-semibold" style={{ color: s.color }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PresentationsGoal({
  data,
  superMetaThreshold,
}: {
  data: ChartDataPoint;
  superMetaThreshold: number;
}) {
  const FULL_GOAL = 15;
  const SUPER_GOAL = superMetaThreshold;

  const rows = [
    { label: "BluePex",   value: data.bluepexPres, color: C.blue  },
    { label: "Opus Tech", value: data.opusPres,    color: C.green },
  ];
  const totalPres = data.bluepexPres + data.opusPres;

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5 flex flex-col h-[280px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-md bg-success/15 flex items-center justify-center shrink-0">
          <Target className="h-3.5 w-3.5 text-success" />
        </div>
        <span className="section-label">Progresso de Apresentações</span>
      </div>

      <div className="flex-1 flex flex-col justify-evenly gap-3">
        {rows.map((row) => {
          const pctFull  = Math.min((row.value / FULL_GOAL)  * 100, 100);
          const pctSuper = Math.min((row.value / SUPER_GOAL) * 100, 100);
          const hitFull  = row.value >= FULL_GOAL;
          const hitSuper = row.value >= SUPER_GOAL;

          return (
            <div key={row.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold tabular-nums" style={{ color: row.color }}>
                    {row.value}
                  </span>
                  <span className="text-xs text-muted-foreground/50">APs</span>
                  {hitSuper && <Zap className="h-3.5 w-3.5 text-warning" />}
                </div>
              </div>

              {/* Track */}
              <div className="relative h-4 bg-muted/30 rounded-full overflow-hidden">
                {/* Fill */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{
                    width: `${pctFull}%`,
                    backgroundColor: row.color,
                    opacity: hitFull ? 1 : 0.6,
                  }}
                />
                {/* Pulsing glow when active */}
                {hitFull && !hitSuper && (
                  <div className="absolute inset-y-0 left-0 rounded-full animate-pulse"
                    style={{ width: `${pctFull}%`, backgroundColor: row.color, opacity: 0.25 }} />
                )}
                {/* Super meta marker */}
                <div
                  className="absolute inset-y-0 w-px bg-warning/70"
                  style={{ left: `${(FULL_GOAL / SUPER_GOAL) * 100}%` }}
                />
              </div>

              {/* Labels */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                <span>{hitFull ? "✓ Meta 100%" : `Meta: ${FULL_GOAL} APs`}</span>
                <span className={cn(hitSuper && "text-warning font-semibold")}>
                  {hitSuper ? "⚡ Super Meta!" : `Super: ${SUPER_GOAL} APs`}
                </span>
              </div>
            </div>
          );
        })}

        {/* Total pill */}
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <span className="text-xs text-muted-foreground/60">Total apresentações</span>
          <span className="text-sm font-bold text-foreground tabular-nums">{totalPres} APs</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MULTI-MONTH VIEW
   Top  — Stacked AreaChart with gradient: volume evolution
   Bot  — ComposedChart: deal count bars + conversion line
════════════════════════════════════════════════════════════ */

function VolumeAreaChart({ data }: { data: ChartDataPoint[] }) {
  const hasData = data.some(d => d.totalVolume > 0);

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5 flex flex-col h-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="section-label">Evolução de Volume</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">BluePex</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-[10px] text-muted-foreground">Opus Tech</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!hasData ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
            Sem dados no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={80}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-bluepex" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue}  stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.blue}  stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="grad-opus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="name" axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: C.muted }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: C.muted }}
                tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                width={48}
              />
              <RechartsTooltip
                formatter={(v: number, n: string) => [formatCurrency(v), n]}
                contentStyle={tip.contentStyle}
                labelStyle={tip.labelStyle}
                itemStyle={tip.itemStyle}
              />
              <Area
                type="monotone" dataKey="bluepexVolume" name="BluePex"
                stroke={C.blue} strokeWidth={2}
                fill="url(#grad-bluepex)"
                dot={false} activeDot={{ r: 5, fill: C.blue, stroke: C.bg, strokeWidth: 2 }}
                stackId="volume"
              />
              <Area
                type="monotone" dataKey="opusVolume" name="Opus Tech"
                stroke={C.green} strokeWidth={2}
                fill="url(#grad-opus)"
                dot={false} activeDot={{ r: 5, fill: C.green, stroke: C.bg, strokeWidth: 2 }}
                stackId="volume"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ConversionComboChart({ data }: { data: ChartDataPoint[] }) {
  const enriched = useMemo(() =>
    data.map(d => {
      const deals = (d.bluepexVolume > 0 ? 1 : 0) + (d.opusVolume > 0 ? 1 : 0);
      const totalPres = d.bluepexPres + d.opusPres;
      const rate = totalPres > 0 ? Math.round((deals / totalPres) * 100 * 10) / 10 : 0;
      return { ...d, deals, rate };
    }),
  [data]);

  const hasData = enriched.some(d => d.totalPres > 0 || d.totalVolume > 0);

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5 flex flex-col h-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-success/15 flex items-center justify-center shrink-0">
            <Activity className="h-3.5 w-3.5 text-success" />
          </div>
          <span className="section-label">Apresentações &amp; Conversão</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-[10px] text-muted-foreground">APs</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-px w-4 bg-warning" />
            <span className="text-[10px] text-muted-foreground">Conversão %</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!hasData ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
            Sem dados no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={80}>
            <ComposedChart data={enriched} margin={{ top: 8, right: 32, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-pres" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="name" axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: C.muted }}
                interval="preserveStartEnd"
              />
              {/* Left Y — presentations */}
              <YAxis
                yAxisId="pres"
                axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: C.muted }}
                width={28}
              />
              {/* Right Y — conversion % */}
              <YAxis
                yAxisId="rate" orientation="right"
                axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: C.muted }}
                tickFormatter={(v) => `${v}%`}
                width={36}
              />
              <RechartsTooltip
                formatter={(v: number | string, n: string) =>
                  n === "Conversão" ? [`${v}%`, n] : [`${v} APs`, n]
                }
                contentStyle={tip.contentStyle}
                labelStyle={tip.labelStyle}
                itemStyle={tip.itemStyle}
              />
              <Bar
                yAxisId="pres" dataKey="totalPres" name="Apresentações"
                fill={C.green} fillOpacity={0.65}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Line
                yAxisId="rate" type="monotone" dataKey="rate" name="Conversão"
                stroke={C.warn} strokeWidth={2.5}
                dot={{ r: 3.5, fill: C.warn, stroke: C.bg, strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: C.warn, stroke: C.bg, strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════════════════════ */
export function DashboardCharts({
  chartTimeline,
  isSingleMonth,
  superMetaThreshold = 30,
}: DashboardChartsProps) {
  if (isSingleMonth) {
    const point = chartTimeline[0] ?? {
      name: "", monthKey: "",
      bluepexVolume: 0, opusVolume: 0,
      bluepexPres: 0,  opusPres: 0,
      totalVolume: 0,  totalPres: 0,
    };
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OperationDonut data={point} />
        <PresentationsGoal data={point} superMetaThreshold={superMetaThreshold} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <VolumeAreaChart data={chartTimeline} />
      <ConversionComboChart data={chartTimeline} />
    </div>
  );
}
