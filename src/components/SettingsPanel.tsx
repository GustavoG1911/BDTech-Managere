import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AppSettings } from "@/lib/types";
import { formatCurrency } from "@/lib/commission";
import { Settings2, Save } from "lucide-react";
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

  const handleSave = () => {
    const newSettings = {
      fixedSalary: parseFloat(salary) || 0,
      commissionRate: (parseFloat(commissionRate) || 20) / 100,
      superMetaThreshold: parseInt(superMetaThreshold) || 30,
      superMetaMultiplier: (parseFloat(superMetaMultiplier) || 200) / 100,
    };
    onSave?.(newSettings);
    onUpdate?.(newSettings);
    toast.success("Parâmetros salvos com sucesso!");
  };



  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="section-title flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Parâmetros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Salário Fixo Mensal (R$)</Label>
            <Input type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} className="font-mono text-lg" disabled={readOnly} />
            <p className="text-xs text-muted-foreground">Atual: {formatCurrency(settings.fixedSalary)}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Taxa de Comissão (%)</Label>
            <Input type="number" min="0" max="100" step="1" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} className="font-mono text-lg" disabled={readOnly} />
            <p className="text-xs text-muted-foreground">Atual: {((settings.commissionRate || 0.20) * 100).toFixed(0)}%</p>
          </div>

          <div className="pt-2 space-y-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">Regras de Comissionamento</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Taxa de comissão: <strong>{((settings.commissionRate || 0.20) * 100).toFixed(0)}%</strong></li>
                <li>• ≥ 15 apresentações → base = 100% da mensalidade</li>
                <li>• {"<"} 15 apresentações → base = 70% da mensalidade</li>
                <li>• Implantação: base = 40% do valor (independente)</li>
                <li>• Comissões pagas até o <strong>dia 20 do mês subsequente</strong></li>
              </ul>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium mb-2 text-primary">⚡ Super Meta</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Apresentações necessárias</Label>
                  <Input type="number" min="1" value={superMetaThreshold} onChange={(e) => setSuperMetaThreshold(e.target.value)} className="font-mono" disabled={readOnly} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Multiplicador da comissão mensal (%)</Label>
                  <Input type="number" min="100" step="10" value={superMetaMultiplier} onChange={(e) => setSuperMetaMultiplier(e.target.value)} className="font-mono" disabled={readOnly} />
                  <p className="text-xs text-muted-foreground">200% = comissão dobra sobre a mensalidade</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A super meta deve ser ativada manualmente no dashboard para cada mês.
              </p>
            </div>
          </div>

          {readOnly ? (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Estes parâmetros são definidos pelo gestor. Entre em contato para solicitar alterações.
            </p>
          ) : (
            <Button onClick={handleSave} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Salvar Parâmetros
            </Button>
          )}
        </CardContent>
      </Card>


    </div>
  );
}
