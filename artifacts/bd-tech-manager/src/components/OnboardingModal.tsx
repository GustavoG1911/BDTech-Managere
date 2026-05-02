import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Save, User } from "lucide-react";
import { InfoHint } from "@/components/InfoHint";
import { isOperationalPosition, isPureSystemAdmin } from "@/lib/roles";

const CARGO_OPTIONS = [
  { value: "Diretor", label: "Diretor" },
  { value: "Executivo de Negócios", label: "Executivo de Negócios" },
  { value: "SDR", label: "SDR" },
] as const;

interface ProfileFormData {
  fullName: string;
  cargo: string;
  fixedSalary: number;
  commissionPercent: number;
}

interface OnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

interface ApiProfile {
  role?: string;
  position?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  fixedSalary?: string | number | null;
  commissionPercent?: string | number | null;
}

function isProfileComplete(profile: ApiProfile | null, role: string) {
  if (isPureSystemAdmin(role, profile?.position)) return true;
  if (!profile?.fullName?.trim()) return false;
  return isOperationalPosition(profile?.position);
}

export function OnboardingModal({ forceOpen, onClose }: OnboardingModalProps) {
  const { user, role, position, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [isForced, setIsForced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileRole, setProfileRole] = useState(role);
  const [form, setForm] = useState<ProfileFormData>({
    fullName: "",
    cargo: "",
    fixedSalary: 0,
    commissionPercent: 20,
  });

  const pureAdmin = isPureSystemAdmin(profileRole || role, form.cargo || position);
  const canChooseDirector = role === "admin" || role === "gestor" || position === "Diretor";
  const lockedOperationalCargo = isOperationalPosition(position) || isOperationalPosition(form.cargo);
  const availableCargoOptions = useMemo(
    () => lockedOperationalCargo && form.cargo
      ? CARGO_OPTIONS.filter((cargo) => cargo.value === form.cargo)
      : CARGO_OPTIONS.filter((cargo) => canChooseDirector || cargo.value !== "Diretor"),
    [canChooseDirector, lockedOperationalCargo, form.cargo]
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

  const hydrateForm = (profile: ApiProfile) => {
    setProfileRole((profile?.role as UserRole) || role);
    setForm({
      fullName: profile?.fullName || profile?.displayName || "",
      cargo: profile?.position || "",
      fixedSalary: Number(profile?.fixedSalary || 0),
      commissionPercent: Number(profile?.commissionPercent ?? 20),
    });
  };

  const checkProfile = async () => {
    try {
      const res = await fetch("/api/profiles/me");
      if (res.ok) {
        const data: ApiProfile = await res.json();
        hydrateForm(data);
        if (!isProfileComplete(data, data.role || role)) {
          setIsForced(true);
          setOpen(true);
        }
      } else {
        setIsForced(true);
        setOpen(true);
      }
    } catch {
      setIsForced(true);
      setOpen(true);
    }
  };

  const loadProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/profiles/me");
      if (res.ok) {
        const data: ApiProfile = await res.json();
        hydrateForm(data);
      }
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    if (!user) return;

    const selectedCargo = availableCargoOptions.find((cargo) => cargo.value === form.cargo);
    if (!form.fullName.trim() || (!pureAdmin && !selectedCargo)) {
      toast.error(pureAdmin ? "Preencha seu nome completo para continuar." : "Preencha nome completo e cargo para continuar.");
      return;
    }

    if (form.fixedSalary < 0) {
      toast.error("O salário fixo não pode ser negativo.");
      return;
    }

    if (form.commissionPercent < 0 || form.commissionPercent > 100) {
      toast.error("A comissão deve ficar entre 0% e 100%.");
      return;
    }

    const displayName = form.fullName.trim().split(/\s+/).slice(0, 2).join(" ");

    setSaving(true);
    try {
      const res = await fetch("/api/profiles/me/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          displayName,
          position: selectedCargo?.value ?? null,
          jobTitle: selectedCargo?.label ?? "Administrador do Sistema",
          fixedSalary: String(form.fixedSalary),
          commissionPercent: String(Math.round(form.commissionPercent)),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error("Erro ao salvar perfil: " + (err.error || ""));
        return;
      }

      await refreshProfile();
      toast.success("Perfil atualizado com sucesso!");
      setIsForced(false);
      setOpen(false);
      onClose?.();
    } catch {
      toast.error("Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
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
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
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
              <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v })} disabled={lockedOperationalCargo}>
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
                  value={form.fixedSalary}
                  onChange={(e) => setForm({ ...form, fixedSalary: Number(e.target.value) })}
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
                  value={form.commissionPercent}
                  onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })}
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
