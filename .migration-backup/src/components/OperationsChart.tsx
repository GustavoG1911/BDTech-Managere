import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Deal } from "@/lib/types";
import { formatCurrency } from "@/lib/commission";

interface OperationsChartProps {
  deals: Deal[];
}

export function OperationsChart({ deals }: OperationsChartProps) {
  const data = [
    {
      name: "BluePex",
      value: deals.filter((d) => d.operation === "BluePex").reduce((s, d) => s + d.monthlyValue + d.implantationValue, 0),
    },
    {
      name: "Opus Tech",
      value: deals.filter((d) => d.operation === "Opus Tech").reduce((s, d) => s + d.monthlyValue + d.implantationValue, 0),
    },
  ];

  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Volume por Operação</span>
        <div className="h-56 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={55} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Volume"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                <Cell fill="hsl(var(--chart-1))" />
                <Cell fill="hsl(var(--chart-2))" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
