import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Save,
  UserCog,
  User,
  Loader2,
  SlidersHorizontal,
  MailPlus,
  Mail,
  Send,
  ImageIcon,
  Upload,
  CheckCircle2,
  Trash2,
  X,
  CalendarDays,
  RefreshCw,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AvatarUpload } from "@/components/AvatarUpload";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { useAppData } from "@/hooks/useAppData";
import { useAppLogo } from "@/hooks/useAppLogo";
import { isOperationalPosition, isPureSystemAdmin } from "@/lib/roles";
import { getCurrentUserContext } from "@/lib/supabase-env";
import { formatMonthLabel, getDueDateForMonth, getMonthKey } from "@/lib/commission";
import { fetchAdminCalendarStatus, startGoogleCalendarConnection, syncGoogleCalendar } from "@/lib/google-calendar";
import { fetchPaymentDueSettings } from "@/lib/payment-settings";

type InviteRow = {
  id: string;
  email: string;
  position: string | null;
  role: string;
  fixed_salary: number | null;
  commission_percent: number | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
};

export default function Settings() {
  const { role, user, loading: authLoading, position } = useAuth();
  const { settings, updateSettings, updatePaymentDueSettings } = useAppData(role, user?.id, position);
  const pureAdmin = isPureSystemAdmin(role, position);
  const isDirector = position === "Diretor";
  const canManageUsers = isDirector || pureAdmin;
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  const defaultTab = requestedTab === "calendar" && pureAdmin ? "calendar" : pureAdmin ? "team" : "profile";

  if (authLoading) {
    return (
      <AppLoadingScreen fullScreen={false} message="Carregando configurações" detail="Sincronizando perfil e permissões." />
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          Perfil, convites, permissões, metas e equipe
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="h-9 mb-6 bg-muted/40 border border-border/40">
          <TabsTrigger value="profile" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <User className="h-3.5 w-3.5" />
            Meu Perfil
          </TabsTrigger>
          {!pureAdmin && (
            <TabsTrigger value="comissions" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {isDirector ? "Metas e Comissões" : "Minha Remuneração"}
            </TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="invites" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <MailPlus className="h-3.5 w-3.5" />
              Convites
            </TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="team" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Users className="h-3.5 w-3.5" />
              Gestão de Equipe
            </TabsTrigger>
          )}
          {pureAdmin && (
            <TabsTrigger value="calendar" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <CalendarDays className="h-3.5 w-3.5" />
              Calendario
            </TabsTrigger>
          )}
          {pureAdmin && (
            <TabsTrigger value="payments" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <CalendarClock className="h-3.5 w-3.5" />
              Pagamentos
            </TabsTrigger>
          )}
          {pureAdmin && (
            <TabsTrigger value="appearance" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <ImageIcon className="h-3.5 w-3.5" />
              Aparência
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        {!pureAdmin && (
        <TabsContent value="comissions">
          <SettingsPanel
            settings={settings}
            onUpdate={isDirector ? updateSettings : undefined}
            readOnly={!isDirector}
          />
        </TabsContent>
        )}
        {canManageUsers && (
          <TabsContent value="invites">
            <InvitesTab />
          </TabsContent>
        )}
        {canManageUsers && (
          <TabsContent value="team">
            <TeamTab />
          </TabsContent>
        )}
        {pureAdmin && (
          <TabsContent value="calendar">
            <AdminCalendarTab />
          </TabsContent>
        )}
        {pureAdmin && (
          <TabsContent value="payments">
            <PaymentDueDatesPanel settings={settings} onUpdate={updatePaymentDueSettings} />
          </TabsContent>
        )}
        {pureAdmin && (
          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PaymentDueDatesPanel({
  settings,
  onUpdate,
}: {
  settings: { salaryDueDay?: number; commissionDueDay?: number };
  onUpdate?: (salaryDueDay: number, commissionDueDay: number) => Promise<void>;
}) {
  const [salaryDueDay, setSalaryDueDay] = useState(String(settings.salaryDueDay || 1));
  const [commissionDueDay, setCommissionDueDay] = useState(String(settings.commissionDueDay || 20));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSalaryDueDay(String(settings.salaryDueDay || 1));
    setCommissionDueDay(String(settings.commissionDueDay || 20));
  }, [settings.salaryDueDay, settings.commissionDueDay]);

  const normalizeDay = (value: string, fallback: number) => Math.min(31, Math.max(1, Math.round(Number(value || fallback))));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate?.(
        normalizeDay(salaryDueDay, 1),
        normalizeDay(commissionDueDay, 20),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg bg-card rounded-xl border border-border/60 p-5 space-y-5">
      <div className="flex items-center gap-2 pb-4 border-b border-border/40">
        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <CalendarClock className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Vencimentos padrão</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Defina o dia em que salários e comissões vencem no Financeiro.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Salários</Label>
          <Input
            type="number"
            min="1"
            max="31"
            value={salaryDueDay}
            onChange={(e) => setSalaryDueDay(e.target.value)}
            className="font-mono text-lg bg-muted/30 border-border/50"
          />
          <p className="text-[11px] text-muted-foreground/50">Padrão atual: dia {settings.salaryDueDay || 1}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Comissões</Label>
          <Input
            type="number"
            min="1"
            max="31"
            value={commissionDueDay}
            onChange={(e) => setCommissionDueDay(e.target.value)}
            className="font-mono text-lg bg-muted/30 border-border/50"
          />
          <p className="text-[11px] text-muted-foreground/50">Padrão atual: dia {settings.commissionDueDay || 20}</p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Salvando..." : "Salvar Vencimentos"}
      </Button>
    </div>
  );
}

function AdminCalendarTab() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const status = await fetchAdminCalendarStatus();
      setGoogleEmail(status?.google_email ?? null);
      setSyncEnabled(Boolean(status?.sync_enabled));
      setUpdatedAt(status?.updated_at ?? null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao carregar calendario: " + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "1") {
      toast.success("Conta Google conectada com sucesso!");
      window.history.replaceState({}, "", "/settings?tab=calendar");
    } else if (params.get("google_error")) {
      toast.error("Erro ao conectar conta Google. Tente novamente.");
      window.history.replaceState({}, "", "/settings?tab=calendar");
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await startGoogleCalendarConnection("/settings?tab=calendar");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao iniciar conexao";
      toast.error(msg);
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncGoogleCalendar();
      await loadStatus();
      toast.success(`Calendario sincronizado: ${result.created} novo(s), ${result.updated} atualizado(s).`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao sincronizar";
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl bg-card rounded-xl border border-border/60 p-5 space-y-5">
      <div className="flex items-center gap-2 pb-4 border-b border-border/40">
        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Calendario central</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            O admin conecta a conta padrao. Todos os usuarios veem e sincronizam a mesma agenda.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando configuracao...
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Conta base do calendario</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {syncEnabled && googleEmail ? googleEmail : "Nenhuma conta conectada"}
                </p>
              </div>
              {syncEnabled ? (
                <Badge className="text-xs bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15">Ativo</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Nao configurado</Badge>
              )}
            </div>

            {updatedAt && (
              <p className="text-xs text-muted-foreground">
                Ultima atualizacao da configuracao: {new Date(updatedAt).toLocaleString("pt-BR")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleConnect} disabled={connecting} className="sm:w-auto">
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              {syncEnabled ? "Trocar conta Google" : "Conectar conta Google"}
            </Button>
            <Button variant="outline" onClick={handleSync} disabled={!syncEnabled || syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Como fica para o time</p>
            <p>Todos veem os eventos importados dessa mesma conta central na pagina Agenda.</p>
            <p>Qualquer usuario pode apertar sincronizar manualmente na Agenda; isso atualiza os eventos existentes pelo ID do Google e evita duplicidade.</p>
          </div>
        </>
      )}
    </div>
  );
}

function ProfileTab() {
  const { user, role: currentUserRole, position: currentPosition, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    position: "none",
    role: "user",
  });
  const pureAdmin = isPureSystemAdmin(currentUserRole, currentPosition);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("profiles")
      .select("full_name, job_title, position, role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setForm({
            full_name: data.full_name || "",
            job_title: data.job_title || (pureAdmin ? "Administrador do Sistema" : ""),
            position: data.position || "none",
            role: data.role || "user",
          });
        }
        setLoading(false);
      });
  }, [user, pureAdmin]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.full_name.trim()) {
      toast.error("Nome completo é obrigatório.");
      return;
    }

    const updateData: any = {
      full_name: form.full_name.trim(),
      job_title: form.job_title.trim() || form.position || "Administrador do Sistema",
    };

    setSaving(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }

    await refreshProfile();
    toast.success("Perfil atualizado!");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null;
  const initials = form.full_name
    ? form.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? "BD");

  return (
    <div className="max-w-lg bg-card rounded-xl border border-border/60 p-5 space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-border/40">
        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Meu Perfil</span>
      </div>

      {/* ── Avatar ── */}
      {user && (
        <div className="flex items-center gap-4 py-1">
          <AvatarUpload
            userId={user.id}
            currentUrl={avatarUrl}
            initials={initials}
            size="lg"
          />
          <div>
            <p className="text-sm font-medium text-foreground">{form.full_name || user.email}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Clique na foto para alterar &middot; JPG, PNG ou WebP &middot; máx. 2 MB
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nome Completo *</Label>
        <Input
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="bg-muted/30 border-border/50"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cargo Descritivo</Label>
        <Input
          value={form.job_title}
          onChange={(e) => setForm({ ...form, job_title: e.target.value })}
          className="bg-muted/30 border-border/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nível de Sistema</Label>
          <Select
            value={form.role}
            onValueChange={(val) => setForm({ ...form, role: val })}
            disabled
          >
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="gestor">Gestor</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Função na Empresa</Label>
          <Select
            value={isOperationalPosition(form.position) ? form.position : "none"}
            onValueChange={(val) => setForm({ ...form, position: val })}
            disabled
          >
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Admin do Sistema</SelectItem>
              <SelectItem value="SDR">SDR</SelectItem>
              <SelectItem value="Executivo de Negócios">Executivo de Negócios</SelectItem>
              <SelectItem value="Diretor">Diretor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        {saving ? "Salvando..." : "Salvar Perfil"}
      </Button>
    </div>
  );
}

function InvitesTab() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [form, setForm] = useState({
    email: "",
    position: "",
    fixed_salary: 0,
    commission_percent: 20,
  });

  const loadInvites = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_invitations")
      .select("id, email, position, role, fixed_salary, commission_percent, status, created_at, accepted_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar convites: " + error.message);
      setLoading(false);
      return;
    }

    setInvites(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadInvites();
  }, []);

  const handleInvite = async () => {
    const email = form.email.trim().toLowerCase();
    if (!isOperationalPosition(form.position)) {
      toast.error("Escolha o cargo do convite.");
      return;
    }
    if (form.fixed_salary < 0 || form.commission_percent < 0 || form.commission_percent > 100) {
      toast.error("Revise salário e comissão antes de enviar.");
      return;
    }
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSending(true);
    const { error: functionError } = await supabase.functions.invoke("invite-user", {
      body: {
        email,
        position: form.position,
        fixedSalary: form.fixed_salary,
        commissionPercent: form.commission_percent,
        redirectTo: `${window.location.origin}/reset-password?invite=1`,
      },
    });

    setSending(false);

    if (functionError) {
      toast.error("Erro ao enviar convite: " + functionError.message);
      return;
    }

    setForm({ email: "", position: "", fixed_salary: 0, commission_percent: 20 });
    await loadInvites();
    toast.success("Convite enviado com sucesso!");
  };

  const handleDeleteInvite = async (invite: InviteRow) => {
    const confirmed = window.confirm(`Excluir o convite enviado para ${invite.email}?`);
    if (!confirmed) return;

    setDeletingInviteId(invite.id);
    const { error } = await (supabase as any)
      .from("user_invitations")
      .delete()
      .eq("id", invite.id);
    setDeletingInviteId(null);

    if (error) {
      toast.error("Erro ao excluir convite: " + error.message);
      return;
    }

    setInvites((prev) => prev.filter((item) => item.id !== invite.id));
    toast.success("Convite excluido.");
  };

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <div className="flex items-center gap-2 pb-4 border-b border-border/40">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <MailPlus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Novo Convite</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              O convite já define cargo, salário e comissão. A permissão de sistema entra como user.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_110px_100px_90px_90px] pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="usuario@empresa.com"
              className="bg-muted/30 border-border/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cargo</Label>
            <Select
              value={form.position}
              onValueChange={(val) => setForm({ ...form, position: val })}
            >
              <SelectTrigger className="bg-muted/30 border-border/50">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SDR">SDR</SelectItem>
                <SelectItem value="Executivo de Negócios">Executivo de Negócios</SelectItem>
                <SelectItem value="Diretor">Diretor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Salário</Label>
            <Input
              type="number"
              min="0"
              value={form.fixed_salary}
              onChange={(e) => setForm({ ...form, fixed_salary: Number(e.target.value || 0) })}
              className="bg-muted/30 border-border/50 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Comissão</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={form.commission_percent}
              onChange={(e) => setForm({ ...form, commission_percent: Math.round(Number(e.target.value || 0)) })}
              className="bg-muted/30 border-border/50 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Permissão</Label>
            <div className="h-10 rounded-md border border-border/50 bg-muted/30 px-3 flex items-center text-sm">
              user
            </div>
          </div>


          <div className="flex items-end">
            <Button onClick={handleInvite} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
          <MailPlus className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Convites</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">E-mail</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cargo</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Salário</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Permissão</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Comissão</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Status</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id} className="border-border/25 hover:bg-[#242842]/40">
                  <TableCell className="px-4 py-3 text-sm font-medium">{invite.email}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">{invite.position || "A configurar"}</TableCell>
                  <TableCell className="px-4 py-3 text-xs font-mono">
                    {invite.fixed_salary == null ? "-" : Number(invite.fixed_salary).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">{invite.role}</TableCell>
                  <TableCell className="px-4 py-3 text-xs font-mono">
                    {invite.commission_percent == null ? "-" : `${Number(invite.commission_percent)}%`}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={invite.status === "accepted" ? "default" : "secondary"}>
                      {invite.status === "accepted" ? "Aceito" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Excluir convite"
                      disabled={deletingInviteId === invite.id}
                      onClick={() => handleDeleteInvite(invite)}
                    >
                      {deletingInviteId === invite.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                    Nenhum convite encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function TeamTab() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [salaryBaseline, setSalaryBaseline] = useState<Record<string, number>>({});
  const [salaryEffectiveMode, setSalaryEffectiveMode] = useState<Record<string, "current" | "next" | "custom">>({});
  const [salaryCustomMonth, setSalaryCustomMonth] = useState<Record<string, string>>({});
  const [salaryDueDay, setSalaryDueDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const currentSalaryMonth = getMonthKey(new Date());
  const nextSalaryMonth = getMonthKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
  const salaryMonthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 13 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
      const value = getMonthKey(date);
      return { value, label: formatMonthLabel(value) };
    });
  }, []);

  useEffect(() => {
    const loadTeam = async () => {
      const { isTestEnv } = await getCurrentUserContext();
      const dueSettings = await fetchPaymentDueSettings();
      setSalaryDueDay(dueSettings.salaryDueDay);

      const query = (supabase as any)
        .from("profiles")
        .select("id, user_id, display_name, full_name, role, job_title, position, fixed_salary, commission_percent, onboarding_completed_at, created_at, is_test_data")
        .eq("is_test_data", isTestEnv)
        .order("created_at", { ascending: true });

      const { data, error } = await query;

      if (data) {
        setProfiles(data);
        setSalaryBaseline(Object.fromEntries(data.map((p: any) => [p.user_id, Number(p.fixed_salary || 0)])));
      }
      if (error) {
        const fallback = await (supabase as any)
          .from("profiles")
          .select("id, user_id, display_name, full_name, role, job_title, position, fixed_salary, commission_percent, onboarding_completed_at, created_at")
          .order("created_at", { ascending: true });

        if (fallback.data) {
          setProfiles(fallback.data);
          setSalaryBaseline(Object.fromEntries(fallback.data.map((p: any) => [p.user_id, Number(p.fixed_salary || 0)])));
        }
        if (fallback.error) toast.error("Erro ao carregar usuários: " + fallback.error.message);
      }
      setLoading(false);
    };

    loadTeam();
  }, []);

  const handleLocalFieldChange = (userId: string, field: "position" | "fixed_salary" | "commission_percent", value: string | number | null) => {
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, [field]: value } : p)));
  };

  const getSalaryEffectiveMonth = (userId: string) => {
    const mode = salaryEffectiveMode[userId] || "current";
    if (mode === "next") return nextSalaryMonth;
    if (mode === "custom") return salaryCustomMonth[userId] || nextSalaryMonth;
    return currentSalaryMonth;
  };

  const monthRange = (fromMonth: string, toBeforeMonth: string) => {
    const months: string[] = [];
    const [fromYear, fromM] = fromMonth.split("-").map(Number);
    const [toYear, toM] = toBeforeMonth.split("-").map(Number);
    const cursor = new Date(fromYear, fromM - 1, 1);
    const end = new Date(toYear, toM - 1, 1);
    while (cursor < end) {
      months.push(getMonthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  };

  const upsertSalaryPayment = async (userId: string, amount: number, monthKey: string, isTestEnv: boolean, preservePaid = true) => {
    const referenceMonth = `${monthKey}-01`;
    const { data: existing, error: existingError } = await (supabase as any)
      .from("salary_payments")
      .select("id, is_paid_by_gestor, confirmed_by_user_at")
      .eq("user_id", userId)
      .eq("reference_month", referenceMonth)
      .eq("is_test_data", isTestEnv)
      .maybeSingle();

    if (existingError) throw existingError;
    if (preservePaid && (existing?.is_paid_by_gestor || existing?.confirmed_by_user_at)) return false;

    const { error } = await (supabase as any)
      .from("salary_payments")
      .upsert(
        {
          user_id: userId,
          amount,
          reference_month: referenceMonth,
          expected_payment_date: getDueDateForMonth(monthKey, salaryDueDay),
          is_paid_by_gestor: false,
          payment_date: null,
          user_confirmed_receipt: false,
          confirmed_by_user_at: null,
          rejected_by_user_at: null,
          is_test_data: isTestEnv,
        },
        { onConflict: "user_id,reference_month,is_test_data" }
      );
    if (error) throw error;
    return true;
  };

  const handleUpdateSalary = async (userId: string, value: number) => {
    const amount = Number(value || 0);
    const effectiveMonth = getSalaryEffectiveMonth(userId);
    const previousAmount = salaryBaseline[userId] ?? 0;
    const { isTestEnv } = await getCurrentUserContext();

    try {
      if (effectiveMonth === currentSalaryMonth) {
        const changed = await upsertSalaryPayment(userId, amount, effectiveMonth, isTestEnv);
        if (!changed) {
          toast.error("O salário deste mês já foi pago ou confirmado. Escolha próximo mês ou outro mês.");
          handleLocalFieldChange(userId, "fixed_salary", previousAmount);
          return;
        }
      } else {
        for (const monthKey of monthRange(currentSalaryMonth, effectiveMonth)) {
          await upsertSalaryPayment(userId, previousAmount, monthKey, isTestEnv);
        }
        await upsertSalaryPayment(userId, amount, effectiveMonth, isTestEnv);
      }

      const { error } = await (supabase as any)
        .from("profiles")
        .update({ fixed_salary: amount })
        .eq("user_id", userId);

      if (error) throw error;

      setSalaryBaseline((prev) => ({ ...prev, [userId]: amount }));
      setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, fixed_salary: amount } : p)));
      toast.success(`Salário atualizado com vigência em ${formatMonthLabel(effectiveMonth)}.`);
    } catch (err: any) {
      toast.error("Erro ao atualizar salário: " + (err?.message || "tente novamente."));
      handleLocalFieldChange(userId, "fixed_salary", previousAmount);
    }
  };

  const isAdminProfile = (profile: any) => isPureSystemAdmin(profile.role, profile.position);
  const hasRequiredUserData = (profile: any) => Boolean(profile.full_name?.trim());
  const isApprovedProfile = (profile: any) =>
    isAdminProfile(profile)
    || (
      hasRequiredUserData(profile)
      && isOperationalPosition(profile.position)
      && Boolean(profile.onboarding_completed_at)
    );

  const getApprovalState = (profile: any) => {
    if (isAdminProfile(profile)) {
      return {
        label: "Admin",
        buttonLabel: "Liberado",
        approved: true,
        ready: false,
        disabledReason: null,
      };
    }
    if (isApprovedProfile(profile)) {
      return {
        label: "Aprovado",
        buttonLabel: "Aprovado",
        approved: true,
        ready: false,
        disabledReason: null,
      };
    }
    if (!hasRequiredUserData(profile)) {
      return {
        label: "Aguardando dados",
        buttonLabel: "Aguardando",
        approved: false,
        ready: false,
        disabledReason: "A pessoa precisa acessar e informar os dados obrigatórios primeiro.",
      };
    }
    if (!isOperationalPosition(profile.position)) {
      return {
        label: "Sem função",
        buttonLabel: "Defina função",
        approved: false,
        ready: false,
        disabledReason: "Escolha a função da pessoa antes de aprovar.",
      };
    }
    return {
      label: "Pronto",
      buttonLabel: "Aprovar",
      approved: false,
      ready: true,
      disabledReason: null,
    };
  };

  const handleApproveUser = async (profile: any) => {
    if (!hasRequiredUserData(profile)) {
      toast.error("A pessoa precisa acessar e informar os dados obrigatórios antes da aprovação.");
      return;
    }

    if (!isOperationalPosition(profile.position)) {
      toast.error("Escolha a função da pessoa antes de aprovar.");
      return;
    }

    const approvedAt = new Date().toISOString();
    const updatePayload = {
      role: "user",
      onboarding_completed_at: approvedAt,
      job_title: profile.job_title || profile.position,
    };

    const { error } = await (supabase as any)
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", profile.user_id);

    if (error) {
      toast.error("Erro ao aprovar usuário: " + error.message);
      return;
    }

    setProfiles((prev) => prev.map((p) => (p.user_id === profile.user_id ? { ...p, ...updatePayload } : p)));
    toast.success("Usuário aprovado e liberado para acessar o sistema.");
  };

  const handleUpdateField = async (userId: string, field: "position" | "fixed_salary" | "commission_percent", value: string | number | null) => {
    if (field === "fixed_salary") {
      await handleUpdateSalary(userId, Number(value || 0));
      return;
    }

    const normalizedValue = field === "position" && value === "none" ? null : value;
    const updatePayload: Record<string, string | number | null> = { [field]: normalizedValue };

    if (field === "position" && typeof normalizedValue === "string" && isOperationalPosition(normalizedValue)) {
      updatePayload.role = "user";
    }

    const { error } = await (supabase as any)
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", userId);

    if (error) {
      toast.error("Erro ao atualizar usuário: " + error.message);
      return;
    }

    toast.success("Perfil atualizado!");
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, ...updatePayload } : p)));
  };

  const handleDeleteUser = async (profile: any) => {
    if (profile.user_id === user?.id) {
      toast.error("Voce nao pode excluir seu proprio usuario.");
      return;
    }

    const label = profile.full_name || profile.display_name || profile.job_title || "este usuario";
    const confirmed = window.confirm(`Excluir ${label}? Esta acao remove o acesso e os dados vinculados a este usuario.`);
    if (!confirmed) return;

    setDeletingUserId(profile.user_id);
    const { error } = await supabase.functions.invoke("delete-user", {
      body: { userId: profile.user_id },
    });
    setDeletingUserId(null);

    if (error) {
      toast.error("Erro ao excluir usuario: " + error.message);
      return;
    }

    setProfiles((prev) => prev.filter((p) => p.user_id !== profile.user_id));
    toast.success("Usuario excluido.");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Gestão de Equipe</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-border/30 hover:bg-transparent">
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Usuário</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cargo Descritivo</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Desde</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase w-[170px]">Função na Empresa</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase w-[320px]">Salário e vigência</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase w-[120px]">Comissão</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase w-[120px]">Status</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right w-[130px]">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => {
            const adminProfile = isAdminProfile(p);
            const approvalState = getApprovalState(p);

            return (
            <TableRow key={p.id} className="border-border/25 hover:bg-[#242842]/40">
              <TableCell className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-muted/60 border border-border/40 flex items-center justify-center shrink-0">
                    <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{p.full_name || p.display_name || "-"}</p>
                    <p className="text-[11px] text-muted-foreground/60">{p.job_title || "-"}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{p.job_title || "-"}</TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground tabular-nums font-mono">
                {new Date(p.created_at).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell className="px-4 py-3">
                <Select
                  value={isOperationalPosition(p.position) ? p.position : "none"}
                  onValueChange={(val) => handleUpdateField(p.user_id, "position", val)}
                >
                  <SelectTrigger className="h-8 text-xs w-[160px] bg-muted/30 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Admin do Sistema</SelectItem>
                    <SelectItem value="SDR">SDR</SelectItem>
                    <SelectItem value="Executivo de Negócios">Executivo de Negócios</SelectItem>
                    <SelectItem value="Diretor">Diretor</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={Number(p.fixed_salary || 0)}
                    onChange={(e) => handleLocalFieldChange(p.user_id, "fixed_salary", Number(e.target.value))}
                    onBlur={(e) => handleUpdateField(p.user_id, "fixed_salary", Number(e.target.value || 0))}
                    className="h-8 text-xs w-[110px] bg-muted/30 border-border/40 font-mono"
                  />
                  <Select
                    value={salaryEffectiveMode[p.user_id] || "current"}
                    onValueChange={(val: "current" | "next" | "custom") =>
                      setSalaryEffectiveMode((prev) => ({ ...prev, [p.user_id]: val }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-[120px] bg-muted/30 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Mês atual</SelectItem>
                      <SelectItem value="next">Próximo mês</SelectItem>
                      <SelectItem value="custom">Outro mês</SelectItem>
                    </SelectContent>
                  </Select>
                  {(salaryEffectiveMode[p.user_id] || "current") === "custom" && (
                    <Select
                      value={salaryCustomMonth[p.user_id] || nextSalaryMonth}
                      onValueChange={(val) => setSalaryCustomMonth((prev) => ({ ...prev, [p.user_id]: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs w-[130px] bg-muted/30 border-border/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {salaryMonthOptions.map((month) => (
                          <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={Number(p.commission_percent || 0)}
                  onChange={(e) => handleLocalFieldChange(p.user_id, "commission_percent", Number(e.target.value))}
                  onBlur={(e) => handleUpdateField(p.user_id, "commission_percent", Math.round(Number(e.target.value || 0)))}
                  className="h-8 text-xs w-[100px] bg-muted/30 border-border/40 font-mono"
                />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Badge
                  variant={approvalState.approved ? "default" : "secondary"}
                  className={
                    approvalState.approved
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                      : approvalState.ready
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
                        : "bg-muted/50 text-muted-foreground border-border/50"
                  }
                >
                  {approvalState.label}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {adminProfile || approvalState.approved ? (
                    <Button disabled variant="outline" size="sm" className="h-8 text-xs">
                      {approvalState.buttonLabel}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!approvalState.ready}
                      title={approvalState.disabledReason || undefined}
                      onClick={() => handleApproveUser(p)}
                      className="h-8 text-xs gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {approvalState.buttonLabel}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title={p.user_id === user?.id ? "Voce nao pode excluir seu proprio usuario" : "Excluir usuario"}
                    disabled={p.user_id === user?.id || deletingUserId === p.user_id}
                    onClick={() => handleDeleteUser(p)}
                  >
                    {deletingUserId === p.user_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            );
          })}
          {profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Appearance Tab — admin only
   Manages the system logo stored in Supabase Storage (app-assets bucket)
───────────────────────────────────────────────────────────────────*/
function AppearanceTab() {
  const { logoUrl, loading, uploadLogo, removeLogo } = useAppLogo();
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPG, PNG, SVG ou WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2 MB.");
      return;
    }

    setUploading(true);
    try {
      await uploadLogo(file);
      toast.success("Logo atualizada com sucesso!");
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.toLowerCase().includes("bucket")) {
        toast.error("Bucket 'app-assets' não existe. Crie-o em Supabase → Storage → Buckets (público).");
      } else {
        toast.error("Erro ao enviar logo: " + (msg || "Tente novamente."));
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeLogo();
      toast.success("Logo removida. O ícone padrão será exibido.");
    } catch {
      toast.error("Erro ao remover logo.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      {/* ── Logo do sistema ── */}
      <div className="bg-card rounded-xl border border-border/70 p-5 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-border/40">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <ImageIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
              Logo do Sistema
            </span>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              Aparece no canto superior esquerdo da sidebar
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-2xl border-2 border-border/50 bg-muted/30
                          flex items-center justify-center overflow-hidden shrink-0">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo atual" className="h-full w-full object-contain p-1.5" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground/25" />
            )}
          </div>

          <div className="space-y-2 flex-1">
            <p className="text-sm text-muted-foreground/70">
              {logoUrl ? "Logo personalizada ativa" : "Usando ícone padrão do sistema"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-border/60"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Enviando..." : logoUrl ? "Trocar logo" : "Enviar logo"}
              </Button>

              {logoUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleRemove}
                  disabled={removing}
                >
                  {removing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <X className="h-3.5 w-3.5" />}
                  {removing ? "Removendo..." : "Remover"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Format hints */}
        <div className="rounded-lg bg-muted/20 border border-border/30 px-4 py-3 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Requisitos
          </p>
          <ul className="text-xs text-muted-foreground/60 space-y-0.5">
            <li>• Formatos: JPG, PNG, SVG ou WebP</li>
            <li>• Tamanho máximo: 2 MB</li>
            <li>• Recomendado: imagem quadrada ou logo com fundo transparente (PNG/SVG)</li>
            <li>• A logo é armazenada no bucket <code className="text-primary/80">app-assets</code> do Supabase</li>
          </ul>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* ── Bucket setup hint ── */}
      <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
        <p className="text-[11px] font-semibold text-warning uppercase tracking-wide mb-1.5">
          Pré-requisito — Buckets no Supabase
        </p>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          Para ativar uploads, crie dois buckets públicos em{" "}
          <span className="text-foreground font-medium">Supabase → Storage → Buckets</span>:
          <br />
          <span className="text-primary/80 font-mono">avatars</span> — fotos de perfil dos usuários
          <br />
          <span className="text-primary/80 font-mono">app-assets</span> — logo do sistema
        </p>
      </div>
    </div>
  );
}
