import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Save, User } from "lucide-react";
import { InfoHint } from "@/components/InfoHint";
import { isOperationalPosition, isPureSystemAdmin } from "@/lib/roles";

const CARGO_OPTIONS = [
  { value: "Diretor", label: "Diretor" },
  { value: "Executivo de Negócios", label: "Executivo de Negócios" },
  { value: "SDR", label: "SDR" },
] as const;

interface ProfileData {
  full_name: string;
  cargo: string;
  fixed_salary: number;
  commission_percent: number;
}

interface OnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

function isProfileComplete(profile: any, role: string) {
  if (isPureSystemAdmin(role, profile?.position)) return true;
  if (!profile?.full_name?.trim()) return false;
  return isOperationalPosition(profile?.position);
}

export function OnboardingModal({ forceOpen, onClose }: OnboardingModalProps) {
  const { user, role, position, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [isForced, setIsForced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileRole, setProfileRole] = useState(role);
  const [form, setForm] = useState<ProfileData>({
    full_name: "",
    cargo: "",
    fixed_salary: 0,
    commission_percent: 20,
  });

  const pureAdmin = isPureSystemAdmin(profileRole || role, form.cargo || position);
  const canChooseDirector = role === "admin" || role === "gestor" || position === "Diretor";
  const availableCargoOptions = useMemo(
    () => CARGO_OPTIONS.filter((cargo) => canChooseDirector || cargo.value !== "Diretor"),
    [canChooseDirector]
  );

  useEffect(() => {
    if (!user) return;
    checkProfile();
  }, [user, role]);

  useEffect(() => {
    if (forceOpen) {
      loadProfile();
      setOpen(true);
      setIsForced(false);
    }
  }, [forceOpen]);

  const hydrateForm = (profile: any) => {
    setProfileRole(profile?.role || role);
    setForm({
      full_name: profile?.full_name || profile?.display_name || "",
      cargo: profile?.position || "",
      fixed_salary: Number(profile?.fixed_salary || 0),
      commission_percent: Number(profile?.commission_percent ?? 20),
    });
  };

  const checkProfile = async () => {
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("full_name, display_name, role, position, job_title, fixed_salary, commission_percent")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error) {
      console.error("[Onboarding] Erro ao verificar perfil:", error.message);
      return;
    }

    if (data) {
      hydrateForm(data);
      if (!isProfileComplete(data, data.role || role)) {
        setIsForced(true);
        setOpen(true);
      }
    } else {
      setIsForced(true);
      setOpen(true);
    }
  };

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("profiles")
      .select("full_name, display_name, role, position, job_title, fixed_salary, commission_percent")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) hydrateForm(data);
  };

  const handleSave = async () => {
    if (!user) return;

    const selectedCargo = availableCargoOptions.find((cargo) => cargo.value === form.cargo);
    if (!form.full_name.trim() || (!pureAdmin && !selectedCargo)) {
      toast.error(pureAdmin ? "Preencha seu nome completo para continuar." : "Preencha nome completo e cargo para continuar.");
      return;
    }

    if (form.fixed_salary < 0) {
      toast.error("O salário fixo não pode ser negativo.");
      return;
    }

    if (form.commission_percent < 0 || form.commission_percent > 100) {
      toast.error("A comissão deve ficar entre 0% e 100%.");
      return;
    }

    const isTestData = user.email?.endsWith("@teste.com") || false;
    const displayName = form.full_name.trim().split(/\s+/).slice(0, 2).join(" ");

    setSaving(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: form.full_name.trim(),
          display_name: displayName,
          position: selectedCargo?.value ?? null,
          job_title: selectedCargo?.label ?? "Administrador do Sistema",
          fixed_salary: form.fixed_salary,
          commission_percent: Math.round(form.commission_percent),
          is_test_data: isTestData,
        },
        { onConflict: "user_id" }
      );

    setSaving(false);
    if (error) {
      console.error("[Onboarding] Erro ao salvar:", error);
      toast.error("Erro ao salvar perfil: " + error.message);
      return;
    }

    await refreshProfile();
    toast.success("Perfil atualizado com sucesso!");
    setIsForced(false);
    setOpen(false);
    onClose?.();
  };

  const handleOpenChange = (value: boolean) => {
    if (isForced && !value) return;
    setOpen(value);
    if (!value) onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => { if (isForced) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isForced) e.preventDefault(); }}
        {...(isForced ? { "data-forced": true } : {})}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {isForced ? "Complete seu perfil" : "Meu perfil"}
          </DialogTitle>
          <DialogDescription>
            {isForced
              ? pureAdmin
                ? "Confirme seu nome para liberar o painel administrativo."
                : "Nome completo e cargo são obrigatórios para liberar o acesso correto ao sistema."
              : "Atualize suas informações pessoais."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Nome completo *</Label>
              <InfoHint text="Esse nome aparece em filtros, pagamentos, notificações e relatórios." />
            </div>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Seu nome completo"
              autoComplete="name"
            />
          </div>

          {!pureAdmin && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Cargo no sistema *</Label>
                <InfoHint text="O cargo controla a visão do sistema: Diretor vê a operação completa, Executivo vê seus fechamentos e SDR acompanha os executivos." />
              </div>
              <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione seu cargo" />
                </SelectTrigger>
                <SelectContent>
                  {availableCargoOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {canChooseDirector && !pureAdmin && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Salário fixo (R$)</Label>
                  <InfoHint text="Valor mensal usado no Financeiro. Pode ser ajustado depois em Configurações." />
                </div>
                <Input
                  type="number"
                  min="0"
                  value={form.fixed_salary}
                  onChange={(e) => setForm({ ...form, fixed_salary: Number(e.target.value) })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Comissão (%)</Label>
                  <InfoHint text="Percentual individual aplicado ao cálculo de comissão deste funcionário." />
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.commission_percent}
                  onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })}
                  className="font-mono"
                />
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar perfil"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
