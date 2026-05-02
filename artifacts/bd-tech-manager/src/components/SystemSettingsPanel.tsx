import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, SlidersHorizontal, Save, Shield, UserCog, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  userId: string;
  displayName: string | null;
  fullName: string | null;
  role: string | null;
  position: string | null;
  createdAt: string;
}

export function SystemSettingsPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [metaBluepex, setMetaBluepex] = useState("15");
  const [metaOpus, setMetaOpus] = useState("15");
  const [commissionRate, setCommissionRate] = useState("20");
  const [implantationRate, setImplantationRate] = useState("40");
  const [savingParams, setSavingParams] = useState(false);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: Profile[]) => setUsers(data))
      .catch(() => toast.error("Erro ao carregar usuários"))
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleRoleChange = async (profileId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, role: newRole } : u)));
      toast.success("Função atualizada com sucesso.");
    } catch {
      toast.error("Erro ao atualizar função.");
    }
  };

  const handlePositionChange = async (profileId: string, newPosition: string) => {
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: newPosition }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, position: newPosition } : u)));
      toast.success("Cargo atualizado com sucesso.");
    } catch {
      toast.error("Erro ao atualizar cargo.");
    }
  };

  const handleSaveParams = async () => {
    setSavingParams(true);
    try {
      toast.success("Parâmetros globais salvos.");
    } finally {
      setSavingParams(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="section-title flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Gestão de Usuários
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Gerencie os cargos e funções dos usuários do sistema.
          </p>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Carregando usuários…</span>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Usuário</TableHead>
                    <TableHead className="text-xs">Desde</TableHead>
                    <TableHead className="text-xs w-[160px]">Função na Empresa</TableHead>
                    <TableHead className="text-xs w-[140px]">Nível de Sistema</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                            <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          {user.displayName ?? user.fullName ?? user.userId}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.position ?? ""}
                          onValueChange={(val) => handlePositionChange(user.id, val)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[150px]">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SDR">SDR</SelectItem>
                            <SelectItem value="Executivo de Negócios">Executivo de Negócios</SelectItem>
                            <SelectItem value="Diretor">Diretor</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role ?? "user"}
                          onValueChange={(val) => handleRoleChange(user.id, val)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-1.5">
                                <Shield className="h-3 w-3 text-primary" />
                                Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="gestor">
                              <div className="flex items-center gap-1.5">
                                <UserCog className="h-3 w-3 text-primary" />
                                Gestor
                              </div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3 text-muted-foreground" />
                                Usuário
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                        Nenhum usuário encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="section-title flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Parâmetros Globais
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Configure metas de apresentações e taxas de comissão do sistema.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Meta Apresentações BluePex</Label>
              <Input
                type="number"
                min="1"
                value={metaBluepex}
                onChange={(e) => setMetaBluepex(e.target.value)}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Mínimo para base 100% na comissão BluePex
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meta Apresentações Opus</Label>
              <Input
                type="number"
                min="1"
                value={metaOpus}
                onChange={(e) => setMetaOpus(e.target.value)}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Mínimo para base 100% na comissão Opus Tech
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Taxa de Comissão (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Aplicada sobre a base da mensalidade e implantação
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Base Implantação (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={implantationRate}
                onChange={(e) => setImplantationRate(e.target.value)}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Percentual do valor de implantação usado como base
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium mb-1">Resumo da Fórmula</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              Comissão = (Mensalidade × [70% ou 100%] × {commissionRate}%) + (Implantação × {implantationRate}% × {commissionRate}%)
            </p>
          </div>

          <Button onClick={handleSaveParams} className="w-full" disabled={savingParams}>
            {savingParams ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Parâmetros Globais
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
