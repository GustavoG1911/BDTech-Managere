import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, Save, Shield, UserCog, User, Loader2, SlidersHorizontal, FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsPanel } from "@/components/SettingsPanel";
import { useAppData } from "@/hooks/useAppData";
import { seedHistoricalData, clearTestData } from "@/lib/seed-test-data";

export default function Settings() {
  const { role, user, loading: authLoading, position } = useAuth();
  const { settings, updateSettings } = useAppData(role, user?.id, position);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

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
        <p className="text-xs text-muted-foreground/60 mt-0.5">Perfil, metas e gestão de equipe</p>
      </div>
      <Tabs defaultValue="profile">
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
            <TabsTrigger value="team" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Users className="h-3.5 w-3.5" />
              <span>Gestão de Equipe</span>
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
          <TabsContent value="team">
            <TeamTab />
          </TabsContent>
        )}
      </Tabs>

      {position === "Diretor" && (
        <div className="mt-8 bg-card rounded-xl border border-border/60 p-5">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">Ambiente de Teste</p>
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
                Remove todos os deals e apresentações de teste.
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
                Reinserere dados de teste realistas (deals + apresentações).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTab() {
  const { user, role: currentUserRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    position: "SDR",
    role: "user",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, job_title, position, role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            full_name: data.full_name || "",
            job_title: data.job_title || "",
            position: data.position || "SDR",
            role: data.role || "user",
          });
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.full_name.trim() || !form.job_title.trim()) {
      toast.error("Nome e Cargo são obrigatórios.");
      return;
    }
    setSaving(true);
    const updateData: any = {
      full_name: form.full_name.trim(),
      job_title: form.job_title.trim(),
      position: form.position,
    };

    if (currentUserRole === "admin") {
      updateData.role = form.role;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Perfil atualizado!");
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-lg bg-card rounded-xl border border-border/60 p-5 space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-border/40">
        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Meu Perfil</span>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nome Completo *</Label>
        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-muted/30 border-border/50" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cargo Descritivo *</Label>
        <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} className="bg-muted/30 border-border/50" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nível de Sistema</Label>
          <Select
            value={form.role}
            onValueChange={(val) => setForm({ ...form, role: val })}
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
            value={["SDR", "Executivo de Negócios", "Diretor"].includes(form.position) ? form.position : ""}
            onValueChange={(val) => setForm({ ...form, position: val })}
          >
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
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



function TeamTab() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeam = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const isTestEnv = user?.email?.endsWith("@teste.com") || false;

      let query = (supabase
        .from("profiles") as any)
        .select("id, user_id, display_name, full_name, role, job_title, position, created_at")
        .eq("is_test_data", isTestEnv)
        .order("created_at", { ascending: true });

      let { data, error } = await query;

      // Fallback para caso a coluna ainda não exista no Supabase
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

  const handleUpdateField = async (userId: string, field: "role" | "position", newRole: string) => {
    const updatePayload: Record<string, string> = { [field]: newRole };
    const { error } = await (supabase
      .from("profiles")
      .update(updatePayload as any) as any)
      .eq("user_id", userId);
    if (error) {
      toast.error(`Erro ao alterar ${field}: ` + error.message);
      return;
    }
    toast.success("Perfil atualizado!");
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, [field]: newRole } : p)));
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

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
            <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase w-[160px]">Função na Empresa</TableHead>
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
                    <p className="font-medium text-foreground">{p.full_name || p.display_name || "—"}</p>
                    <p className="text-[11px] text-muted-foreground/60">{p.job_title || "—"}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground">{p.job_title || "—"}</TableCell>
              <TableCell className="px-4 py-3 text-xs text-muted-foreground tabular-nums font-mono">
                {new Date(p.created_at).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell className="px-4 py-3">
                <Select value={p.position || "SDR"} onValueChange={(val) => handleUpdateField(p.user_id, "position", val)}>
                  <SelectTrigger className="h-8 text-xs w-[150px] bg-muted/30 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SDR">SDR</SelectItem>
                    <SelectItem value="Executivo de Negócios">Executivo de Negócios</SelectItem>
                    <SelectItem value="Diretor">Diretor</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="px-4 py-3">
                <Select value={p.role || "user"} onValueChange={(val) => handleUpdateField(p.user_id, "role", val)}>
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
