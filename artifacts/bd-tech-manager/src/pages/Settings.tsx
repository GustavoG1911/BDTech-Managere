import { useState, useEffect, useRef } from "react";
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
  Shield,
  UserCog,
  User,
  Loader2,
  SlidersHorizontal,
  FlaskConical,
  Trash2,
  MailPlus,
  Send,
  ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AvatarUpload } from "@/components/AvatarUpload";
import { useAppData } from "@/hooks/useAppData";
import { useAppLogo } from "@/hooks/useAppLogo";
import { seedHistoricalData, clearTestData } from "@/lib/seed-test-data";
import { isOperationalPosition, isPureSystemAdmin } from "@/lib/roles";

const POSITION_OPTIONS = ["SDR", "Executivo de Negócios", "Diretor"] as const;
const ROLE_OPTIONS = ["user", "gestor", "admin"] as const;

function normalizeRoleForPosition(role: string, position: string | null) {
  return isOperationalPosition(position) ? "user" : role;
}

type InviteRow = {
  id: string;
  email: string;
  position: string;
  role: string;
  fixed_salary: number | null;
  commission_percent: number | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
};

export default function Settings() {
  const { role, user, loading: authLoading, position } = useAuth();
  const { settings, updateSettings } = useAppData(role, user?.id, position);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const pureAdmin = isPureSystemAdmin(role, position);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedHistoricalData();
      toast.success("Banco de teste populado com sucesso!");
    } catch (err: unknown) {
      toast.error("Erro ao popular banco: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSeeding(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearTestData();
      toast.success("Todos os dados de teste foram removidos.");
    } catch (err: unknown) {
      toast.error("Erro ao limpar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setClearing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
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

      <Tabs defaultValue={pureAdmin ? "invites" : "profile"}>
        <TabsList className="h-9 mb-6 bg-muted/40 border border-border/40">
          <TabsTrigger value="profile" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <User className="h-3.5 w-3.5" />
            Meu Perfil
          </TabsTrigger>
          <TabsTrigger value="comissions" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Metas e Comissões
          </TabsTrigger>
          {role === "admin" && (
            <TabsTrigger value="invites" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <MailPlus className="h-3.5 w-3.5" />
              Convites
            </TabsTrigger>
          )}
          {role === "admin" && (
            <TabsTrigger value="team" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Users className="h-3.5 w-3.5" />
              Gestão de Equipe
            </TabsTrigger>
          )}
          {role === "admin" && (
            <TabsTrigger value="appearance" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <ImageIcon className="h-3.5 w-3.5" />
              Aparência
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="comissions">
          <SettingsPanel settings={settings} onUpdate={updateSettings} readOnly={position === "SDR"} />
        </TabsContent>
        {role === "admin" && (
          <TabsContent value="invites">
            <InvitesTab />
          </TabsContent>
        )}
        {role === "admin" && (
          <TabsContent value="team">
            <TeamTab />
          </TabsContent>
        )}
        {role === "admin" && (
          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>
        )}
      </Tabs>

      {(position === "Diretor" || role === "admin") && (
        <div className="mt-8 bg-card rounded-xl border border-border/60 p-5">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
            Ambiente de Teste
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={clearing || seeding}
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
              >
                {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {clearing ? "Limpando..." : "Limpar Todos os Dados"}
              </Button>
              <p className="text-[11px] text-muted-foreground/60">
                Remove todos os deals, pagamentos e apresentações de teste.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                variant="destructive"
                onClick={handleSeed}
                disabled={seeding || clearing}
                className="gap-2"
              >
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                {seeding ? "Populando banco..." : "Popular Banco (Teste)"}
              </Button>
              <p className="text-[11px] text-muted-foreground/60">
                Reinserir dados de teste realistas.
              </p>
            </div>
          </div>
        </div>
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

    const normalizedPosition = form.position === "none" ? null : form.position;
    const normalizedRole = normalizeRoleForPosition(form.role, normalizedPosition);
    const updateData: any = {
      full_name: form.full_name.trim(),
      job_title: form.job_title.trim() || (normalizedPosition || "Administrador do Sistema"),
      position: normalizedPosition,
    };

    if (currentUserRole === "admin") {
      updateData.role = normalizedRole;
    }

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
            onValueChange={(val) => setForm({ ...form, role: val, position: val === "admin" ? "none" : form.position })}
            disabled={currentUserRole !== "admin"}
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
            onValueChange={(val) => setForm({ ...form, position: val, role: isOperationalPosition(val) ? "user" : form.role })}
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
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [form, setForm] = useState({
    email: "",
    position: "Executivo de Negócios",
    role: "user",
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
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (!isOperationalPosition(form.position)) {
      toast.error("Escolha o cargo operacional do convidado.");
      return;
    }

    setSending(true);
    const { data: authData } = await supabase.auth.getUser();
    const isTestEnv = authData.user?.email?.endsWith("@teste.com") || false;

    const { error } = await (supabase as any)
      .from("user_invitations")
      .insert({
        email,
        position: form.position,
        role: "user",
        fixed_salary: Number(form.fixed_salary || 0),
        commission_percent: Math.round(Number(form.commission_percent || 0)),
        invited_by: authData.user?.id,
        is_test_data: isTestEnv,
      });

    if (error) {
      setSending(false);
      toast.error("Erro ao salvar convite: " + error.message);
      return;
    }

    const { error: functionError } = await supabase.functions.invoke("invite-user", {
      body: {
        email,
        redirectTo: window.location.origin,
      },
    });

    setSending(false);
    setForm({ ...form, email: "" });
    await loadInvites();

    if (functionError) {
      toast.warning("Convite salvo. Falta publicar a função invite-user para o e-mail sair automaticamente.");
      return;
    }

    toast.success("Convite enviado com sucesso!");
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
              O cargo escolhido aqui será aplicado no primeiro acesso do usuário.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_120px_120px_120px_auto] pt-4">
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
            <Select value={form.position} onValueChange={(val) => setForm({ ...form, position: val, role: "user" })}>
              <SelectTrigger className="bg-muted/30 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((position) => (
                  <SelectItem key={position} value={position}>{position}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Permissão</Label>
            <div className="h-10 rounded-md border border-border/50 bg-muted/30 px-3 flex items-center text-sm">
              user
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Salário</Label>
            <Input
              type="number"
              min="0"
              value={form.fixed_salary}
              onChange={(e) => setForm({ ...form, fixed_salary: Number(e.target.value) })}
              className="bg-muted/30 border-border/50 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Comissão %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={form.commission_percent}
              onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })}
              className="bg-muted/30 border-border/50 font-mono"
            />
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
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Permissão</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Comissão</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id} className="border-border/25 hover:bg-[#242842]/40">
                  <TableCell className="px-4 py-3 text-sm font-medium">{invite.email}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">{invite.position}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">{invite.role}</TableCell>
                  <TableCell className="px-4 py-3 text-xs font-mono">{Number(invite.commission_percent || 0)}%</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={invite.status === "accepted" ? "default" : "secondary"}>
                      {invite.status === "accepted" ? "Aceito" : "Pendente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {invites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
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
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeam = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const isTestEnv = user?.email?.endsWith("@teste.com") || false;

      let query = (supabase as any)
        .from("profiles")
        .select("id, user_id, display_name, full_name, role, job_title, position, created_at")
        .eq("is_test_data", isTestEnv)
        .order("created_at", { ascending: true });

      let { data, error } = await query;

      if (error && (error.message?.includes("is_test_data") || error.message?.includes("column"))) {
        console.warn("[Settings] Coluna is_test_data não encontrada, buscando tudo.");
        const fallback = await supabase
          .from("profiles")
          .select("id, user_id, display_name, full_name, role, job_title, position, created_at")
          .order("created_at", { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (data) setProfiles(data);
      if (error) toast.error("Erro ao carregar usuários: " + error.message);
      setLoading(false);
    };

    loadTeam();
  }, []);

  const handleUpdateField = async (userId: string, field: "role" | "position", value: string) => {
    const normalizedValue = field === "position" && value === "none" ? null : value;
    const updatePayload: Record<string, string | null> = { [field]: normalizedValue };
    const currentProfile = profiles.find((profile) => profile.user_id === userId);

    if (field === "position" && isOperationalPosition(normalizedValue)) {
      updatePayload.role = "user";
    }

    if (field === "role" && value === "admin") {
      updatePayload.position = null;
      updatePayload.job_title = "Administrador do Sistema";
    }

    if (field === "role" && isOperationalPosition(currentProfile?.position)) {
      updatePayload.role = "user";
    }
    const { error } = await (supabase as any)
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", userId);

    if (error) {
      toast.error(`Erro ao alterar ${field}: ` + error.message);
      return;
    }

    toast.success("Perfil atualizado!");
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, ...updatePayload } : p)));
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
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase w-[140px]">Nível de Sistema</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => (
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
                <Select
                  value={isOperationalPosition(p.position) ? "user" : p.role || "user"}
                  onValueChange={(val) => handleUpdateField(p.user_id, "role", val)}
                  disabled={isOperationalPosition(p.position)}
                >
                  <SelectTrigger className="h-8 text-xs w-[130px] bg-muted/30 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-1.5"><Shield className="h-3 w-3 text-primary" /> Admin</div>
                    </SelectItem>
                    <SelectItem value="gestor">
                      <div className="flex items-center gap-1.5"><Users className="h-3 w-3 text-muted-foreground" /> Gestor</div>
                    </SelectItem>
                    <SelectItem value="user">
                      <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" /> User</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
          {profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
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
