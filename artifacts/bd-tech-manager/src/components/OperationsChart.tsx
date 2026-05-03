import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Deal } from "@/lib/types";
import { formatCurrency } from "@/lib/commission";

interface OperationsChartProps {
  deals: Deal[];
}

const COLORS = {
  BluePex:     "hsl(218 90% 65%)",
  "Opus Tech": "hsl(150 55% 45%)",
};

export function OperationsChart({ deals }: OperationsChartProps) {
  const data = [
    {
      name: "BluePex",
      value: deals
        .filter((d) => d.operation === "BluePex")
        .reduce((s, d) => s + d.monthlyValue + d.implantationValue, 0),
    },
    {
      name: "Opus Tech",
      value: deals
        .filter((d) => d.operation === "Opus Tech")
        .reduce((s, d) => s + d.monthlyValue + d.implantationValue, 0),
    },
  ];

  return (
    <div className="bg-card rounded-xl border border-border/70 p-5">
      <span className="section-label">Volume por Operação</span>
      <div className="mt-4" style={{ height: 200, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <BarChart data={data} barSize={36} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
            <XAxis
              dataKey="name"
              axisLine={false} tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
            />
            <YAxis
              axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
              width={52}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              formatter={(value: number) => [formatCurrency(value), "Volume"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "10px",
                fontSize: "13px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[entry.name as keyof typeof COLORS] ?? "hsl(var(--primary))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
