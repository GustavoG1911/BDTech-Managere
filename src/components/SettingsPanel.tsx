import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AppSettings } from "@/lib/types";
import { formatCurrency } from "@/lib/commission";
import { Settings2, Save, Zap, Info } from "lucide-react";
import { toast } from "sonner";

interface SettingsPanelProps {
  settings: AppSettings;
  onSave?: (s: AppSettings) => void;
  onUpdate?: (s: AppSettings) => void;
  onRefreshDeals?: () => void;
  readOnly?: boolean;
}

export function SettingsPanel({ settings, onSave, onUpdate, onRefreshDeals, readOnly = false }: SettingsPanelProps) {
  const [salary, setSalary] = useState(settings.fixedSalary.toString());
  const [commissionRate, setCommissionRate] = useState(((settings.commissionRate || 0.20) * 100).toString());
  const [superMetaThreshold, setSuperMetaThreshold] = useState((settings.superMetaThreshold || 30).toString());
  const [superMetaMultiplier, setSuperMetaMultiplier] = useState(((settings.superMetaMultiplier || 2) * 100).toString());
  const [salaryDueDay, setSalaryDueDay] = useState((settings.salaryDueDay || 1).toString());
  const [commissionDueDay, setCommissionDueDay] = useState((settings.commissionDueDay || 20).toString());

  useEffect(() => {
    setSalary(settings.fixedSalary.toString());
    setCommissionRate(((settings.commissionRate || 0.20) * 100).toString());
    setSuperMetaThreshold((settings.superMetaThreshold || 30).toString());
    setSuperMetaMultiplier(((settings.superMetaMultiplier || 2) * 100).toString());
    setSalaryDueDay((settings.salaryDueDay || 1).toString());
    setCommissionDueDay((settings.commissionDueDay || 20).toString());
  }, [settings]);

  const handleSave = () => {
    const newSettings = {
      fixedSalary:         parseFloat(salary) || 0,
      commissionRate:      (parseFloat(commissionRate) || 20) / 100,
      superMetaThreshold:  parseInt(superMetaThreshold) || 30,
      superMetaMultiplier: (parseFloat(superMetaMultiplier) || 200) / 100,
      salaryDueDay:        Math.min(31, Math.max(1, parseInt(salaryDueDay) || 1)),
      commissionDueDay:    Math.min(31, Math.max(1, parseInt(commissionDueDay) || 20)),
    };
    onSave?.(newSettings);
    onUpdate?.(newSettings);
    toast.success("Parâmetros salvos com sucesso!");
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-card rounded-xl border border-border/70 p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2 pb-4 border-b border-border/40">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Settings2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="section-label">{readOnly ? "Minha Remuneração" : "Parâmetros de Comissão"}</span>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {readOnly
                ? "Valores definidos pelo Diretor e regras usadas nos cálculos."
                : "Defina os valores padrão usados no comissionamento."}
            </p>
          </div>
        </div>

        {/* Salário */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Salário Fixo Mensal (R$)
          </Label>
          <Input
            type="number" min="0" step="0.01"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className="font-mono text-lg bg-muted/30 border-border/50"
            disabled={readOnly}
          />
          <p className="text-[11px] text-muted-foreground/50">
            Atual: {formatCurrency(settings.fixedSalary)}
          </p>
        </div>

        {/* Taxa de comissão */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Taxa de Comissão (%)
          </Label>
          <Input
            type="number" min="0" max="100" step="1"
            value={commissionRate}
            onChange={(e) => setCommissionRate(e.target.value)}
            className="font-mono text-lg bg-muted/30 border-border/50"
            disabled={readOnly}
          />
          <p className="text-[11px] text-muted-foreground/50">
            Atual: {((settings.commissionRate || 0.20) * 100).toFixed(0)}%
          </p>
        </div>

        {/* Vencimentos */}
        <div className="rounded-xl border border-border/40 p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Vencimentos padrão</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Salários</Label>
              <Input
                type="number" min="1" max="31" step="1"
                value={salaryDueDay}
                onChange={(e) => setSalaryDueDay(e.target.value)}
                className="font-mono bg-muted/30 border-border/50"
                disabled={readOnly}
              />
              <p className="text-[11px] text-muted-foreground/50">Dia {settings.salaryDueDay || 1}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Comissões</Label>
              <Input
                type="number" min="1" max="31" step="1"
                value={commissionDueDay}
                onChange={(e) => setCommissionDueDay(e.target.value)}
                className="font-mono bg-muted/30 border-border/50"
                disabled={readOnly}
              />
              <p className="text-[11px] text-muted-foreground/50">Dia {settings.commissionDueDay || 20}</p>
            </div>
          </div>
        </div>

        {/* Regras */}
        <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Como o cálculo funciona</span>
          </div>
          <ul className="text-xs text-muted-foreground/70 space-y-1">
            <li>• Taxa do usuário: <strong className="text-foreground">{((settings.commissionRate || 0.20) * 100).toFixed(0)}%</strong></li>
            <li>• 15 apresentações ou mais: comissão sobre <strong className="text-foreground">100%</strong> da mensalidade.</li>
            <li>• Abaixo de 15 apresentações: comissão sobre <strong className="text-foreground">70%</strong> da mensalidade.</li>
            <li>• Implantação: comissão sobre <strong className="text-foreground">40%</strong> do valor.</li>
            <li>• Regra do dia 07: primeiro pagamento após o dia 07 entra financeiramente no mês seguinte.</li>
            <li>• Super meta: com 30 apresentações, a comissão de mensalidade dobra.</li>
          </ul>
        </div>

        {/* Super Meta */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-warning" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Super Meta</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Apresentações necessárias</Label>
              <Input
                type="number" min="1"
                value={superMetaThreshold}
                onChange={(e) => setSuperMetaThreshold(e.target.value)}
                className="font-mono bg-muted/30 border-border/50"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Multiplicador (%)</Label>
              <Input
                type="number" min="100" step="10"
                value={superMetaMultiplier}
                onChange={(e) => setSuperMetaMultiplier(e.target.value)}
                className="font-mono bg-muted/30 border-border/50"
                disabled={readOnly}
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/60">
            200% = a comissão sobre mensalidade dobra. Ativação manual por mês no dashboard.
          </p>
        </div>

        {readOnly ? (
          <p className="text-xs text-muted-foreground/50 text-center pt-1">
            Parâmetros definidos pelo gestor. Solicite alterações ao responsável.
          </p>
        ) : (
          <Button onClick={handleSave} className="w-full gap-2">
            <Save className="h-4 w-4" />
            Salvar Parâmetros
          </Button>
        )}
      </div>
    </div>
  );
}
