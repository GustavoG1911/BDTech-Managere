import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Home,
  Landmark,
  Loader2,
  Save,
  Settings,
  ShieldCheck,
  Target,
  User,
} from "lucide-react";
import { InfoHint } from "@/components/InfoHint";
import { isOperationalPosition, isPureSystemAdmin } from "@/lib/roles";

const PRODUCT_AREAS = [
  { icon: Home, title: "Dashboard", text: "Acompanhe fechamentos, receita prevista, metas e comissoes do periodo." },
  { icon: Target, title: "Prospeccao", text: "Registre oportunidades, status e notas para manter o funil organizado." },
  { icon: CalendarDays, title: "Agenda", text: "Visualize reunioes e compromissos comerciais em um calendario compartilhado." },
  { icon: Landmark, title: "Financeiro", text: "Controle recebiveis, salarios, baixas, comissoes e regra do dia 07." },
  { icon: Settings, title: "Configuracoes", text: "Ajuste perfil, equipe, metas, comissoes, logo e dados de teste." },
];

const ROLE_GUIDES = [
  "Diretor ve a operacao consolidada, equipe, filtros avancados e controles financeiros.",
  "Executivo de Negócios acompanha os proprios fechamentos e comissoes.",
  "SDR acompanha os Executivos de Negócios, apresentacoes e pipeline compartilhado.",
  "Dados de teste usam ambiente separado quando o email termina com @teste.com.",
];

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
  if (isPureSystemAdmin(role, profile?.position)) return Boolean(profile?.full_name?.trim());
  if (!profile?.full_name?.trim()) return false;
  return isOperationalPosition(profile?.position);
}

function hasCompletedOnboarding(profile: any, role: string) {
  if (!("onboarding_completed_at" in (profile || {}))) return true;
  return isProfileComplete(profile, role) && Boolean(profile?.onboarding_completed_at);
}

export function OnboardingModal({ forceOpen, onClose }: OnboardingModalProps) {
  const { user, role, position, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [isForced, setIsForced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileRole, setProfileRole] = useState(role);
  const [step, setStep] = useState(0);
  const [profileExists, setProfileExists] = useState(false);
  const [onboardingCompletedAt, setOnboardingCompletedAt] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileData>({
    full_name: "",
    cargo: "",
    fixed_salary: 0,
    commission_percent: 20,
  });

  const pureAdmin = isPureSystemAdmin(profileRole || role, form.cargo || position);
  const hasOperationalCargo = isOperationalPosition(form.cargo);
  const hasRequiredProfileData = pureAdmin
    ? Boolean(form.full_name.trim())
    : Boolean(form.full_name.trim() && hasOperationalCargo);
  const totalSteps = 3;
  const isLastStep = step === totalSteps - 1;

  useEffect(() => {
    if (!user) return;
    checkProfile();
  }, [user, role]);

  useEffect(() => {
    if (forceOpen) {
      loadProfile();
      setStep(0);
      setOpen(true);
      setIsForced(false);
    }
  }, [forceOpen]);

  const hydrateForm = (profile: any) => {
    setProfileExists(Boolean(profile));
    setProfileRole(profile?.role || role);
    setOnboardingCompletedAt(profile?.onboarding_completed_at || null);
    setForm({
      full_name: profile?.full_name || profile?.display_name || "",
      cargo: profile?.position || "",
      fixed_salary: Number(profile?.fixed_salary || 0),
      commission_percent: Number(profile?.commission_percent ?? 20),
    });
  };

  const checkProfile = async () => {
    try {
      let { data, error } = await (supabase as any)
        .from("profiles")
        .select("full_name, display_name, role, position, job_title, fixed_salary, commission_percent, onboarding_completed_at")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error && error.message?.toLowerCase().includes("onboarding_completed_at")) {
        const fallback = await (supabase as any)
          .from("profiles")
          .select("full_name, display_name, role, position, job_title, fixed_salary, commission_percent")
          .eq("user_id", user!.id)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error("[Onboarding] Erro ao verificar perfil:", error.message);
        return;
      }

      if (data) {
        hydrateForm(data);
        if (!hasCompletedOnboarding(data, data.role || role)) {
          setStep(0);
          setIsForced(true);
          setOpen(true);
        }
      } else {
        hydrateForm(null);
        setStep(0);
        setIsForced(true);
        setOpen(true);
      }
    } catch (err) {
      console.error("[Onboarding] Falha inesperada ao verificar perfil:", err);
    }
  };

  const loadProfile = async () => {
    if (!user) return;
    try {
      const result = await (supabase as any)
        .from("profiles")
        .select("full_name, display_name, role, position, job_title, fixed_salary, commission_percent, onboarding_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      let data = result.data;

      if (result.error && result.error.message?.toLowerCase().includes("onboarding_completed_at")) {
        const fallback = await (supabase as any)
          .from("profiles")
          .select("full_name, display_name, role, position, job_title, fixed_salary, commission_percent")
          .eq("user_id", user.id)
          .maybeSingle();
        data = fallback.data;
      }

      hydrateForm(data);
    } catch (err) {
      console.error("[Onboarding] Falha inesperada ao carregar perfil:", err);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!form.full_name.trim()) {
      toast.error("Preencha seu nome completo para continuar.");
      setStep(totalSteps - 1);
      return;
    }

    const displayName = form.full_name.trim().split(/\s+/).slice(0, 2).join(" ");
    const completedAt = hasRequiredProfileData ? new Date().toISOString() : null;

    setSaving(true);
    let { error: profileError } = await (supabase as any)
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: form.full_name.trim(),
          display_name: displayName,
          ...(completedAt ? { onboarding_completed_at: completedAt } : {}),
        },
        { onConflict: "user_id" }
      );

    if (profileError && profileError.message?.toLowerCase().includes("onboarding_completed_at")) {
      const fallback = await (supabase as any)
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            full_name: form.full_name.trim(),
            display_name: displayName,
          },
          { onConflict: "user_id" }
        );
      profileError = fallback.error;
    }

    if (profileError) {
      setSaving(false);
      console.error("[Onboarding] Erro ao salvar perfil:", profileError);
      toast.error("Erro ao salvar perfil: " + profileError.message);
      return;
    }

    if (pureAdmin) {
      await (supabase as any)
        .from("profiles")
        .update({ job_title: "Administrador do Sistema" })
        .eq("user_id", user.id);
    }

    setSaving(false);
    setProfileExists(true);
    await refreshProfile();
    if (!hasRequiredProfileData) {
      toast.success("Nome salvo. Agora um Diretor precisa liberar seu cargo.");
      return;
    }

    setOnboardingCompletedAt(completedAt);
    toast.success(onboardingCompletedAt ? "Perfil atualizado com sucesso!" : "Onboarding concluido. Bem-vindo!");
    setIsForced(false);
    setOpen(false);
    onClose?.();
  };

  const handleOpenChange = (value: boolean) => {
    if (isForced && !value) return;
    setOpen(value);
    if (!value) onClose?.();
  };

  const goNext = () => {
    if (step < totalSteps - 1) setStep((current) => current + 1);
  };

  const goBack = () => {
    if (step > 0) setStep((current) => current - 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl p-0 overflow-hidden"
        onPointerDownOutside={(e) => { if (isForced) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isForced) e.preventDefault(); }}
        {...(isForced ? { "data-forced": true } : {})}
      >
        <div className="border-b border-border/60 bg-muted/20 px-5 py-4">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20">
                {step === 2 ? <User className="h-5 w-5 text-primary" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base leading-tight">
                  {onboardingCompletedAt && forceOpen ? "Meu perfil" : "Primeiros passos no BD Tech"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-relaxed">
                  {step === 0 && "Conheca as areas principais antes de comecar a usar o sistema."}
                  {step === 1 && "Entenda o fluxo de trabalho e como seu cargo muda a visao dos dados."}
                  {step === 2 && "Confirme os dados obrigatorios para liberar sua experiencia."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {["Visao geral", "Como usar", "Seu perfil"].map((label, index) => (
              <div
                key={label}
                className={`h-1.5 rounded-full transition-colors ${index <= step ? "bg-primary" : "bg-border"}`}
                aria-label={label}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[340px] px-5 py-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {PRODUCT_AREAS.map((area) => (
                  <div key={area.title} className="rounded-lg border border-border/60 bg-card p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <area.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{area.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{area.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-foreground">Fluxo recomendado</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {["Prospectar", "Agendar", "Fechar", "Baixar"].map((label, index) => (
                    <div key={label} className="rounded-md border border-border/60 bg-background p-3">
                      <p className="text-[11px] font-semibold text-primary">0{index + 1}</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {ROLE_GUIDES.map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <p className="text-xs leading-relaxed text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {!profileExists && (
                <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
                  Seu perfil sera criado agora. Permissoes sensiveis continuam protegidas pelo Diretor/Admin.
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Nome completo *</Label>
                  <InfoHint text="Esse nome aparece em filtros, pagamentos, notificacoes e relatorios." />
                </div>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  className="bg-muted/30 border-border/50"
                />
              </div>

              {!pureAdmin && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-muted-foreground">Cargo no sistema *</Label>
                    <InfoHint text="O cargo controla a visao do sistema. Diretor ve tudo, Executivo ve seus fechamentos, SDR acompanha executivos." />
                  </div>
                  <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
                    {hasOperationalCargo ? (
                      <span className="font-medium text-foreground">{form.cargo}</span>
                    ) : (
                      <span className="text-muted-foreground">Pendente de liberacao por Diretor/Admin</span>
                    )}
                  </div>
                  {!hasOperationalCargo && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Para proteger os dados comerciais, o cargo nao pode ser escolhido pelo proprio usuario.
                    </p>
                  )}
                </div>
              )}

              {hasOperationalCargo && !pureAdmin && (
                <div className="rounded-lg border border-border/40 bg-muted/15 p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="section-label">Remuneracao configurada</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Salario fixo</p>
                      <p className="mt-1 font-mono text-sm text-foreground">
                        R$ {form.fixed_salary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Comissao</p>
                      <p className="mt-1 font-mono text-sm text-foreground">{form.commission_percent}%</p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Esses valores sao definidos pelo Diretor/Admin e podem ser revisados em Configuracoes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-5 py-4">
          <Button variant="outline" onClick={goBack} disabled={step === 0 || saving} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="text-xs text-muted-foreground">
            Etapa {step + 1} de {totalSteps}
          </div>

          {isLastStep ? (
            <Button onClick={handleSave} disabled={saving || !form.full_name.trim()} className="gap-2">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                : <><Save className="h-4 w-4" />{hasRequiredProfileData ? "Concluir" : "Salvar nome"}</>
              }
            </Button>
          ) : (
            <Button onClick={goNext} disabled={saving} className="gap-2">
              Avancar
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
