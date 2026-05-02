import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, SlidersHorizontal, Save, Shield, UserCog, User } from "lucide-react";
import { toast } from "sonner";

interface MockUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "gestor" | "user";
  position: "SDR" | "Executivo de Negócios" | "Diretor";
  createdAt: string;
}

const MOCK_USERS: MockUser[] = [
  { id: "1", email: "admin@dealflow.com", displayName: "Admin Principal", role: "admin", position: "Diretor", createdAt: "2025-01-15" },
  { id: "2", email: "joao.silva@dealflow.com", displayName: "João Silva", role: "user", position: "SDR", createdAt: "2025-02-20" },
  { id: "3", email: "maria.santos@dealflow.com", displayName: "Maria Santos", role: "gestor", position: "Executivo de Negócios", createdAt: "2025-03-10" },
  { id: "4", email: "pedro.costa@dealflow.com", displayName: "Pedro Costa", role: "admin", position: "Diretor", createdAt: "2025-04-01" },
];

export function SystemSettingsPanel() {
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS);
  const [metaBluepex, setMetaBluepex] = useState("15");
  const [metaOpus, setMetaOpus] = useState("15");
  const [commissionRate, setCommissionRate] = useState("20");
  const [implantationRate, setImplantationRate] = useState("40");

  const handleRoleChange = (userId: string, newRole: "admin" | "gestor" | "user") => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    toast.info("Alteração de cargo simulada (mockup). Nenhuma alteração foi salva no banco.");
  };

  const handlePositionChange = (userId: string, newPosition: "SDR" | "Executivo de Negócios" | "Diretor") => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, position: newPosition } : u))
    );
    toast.info("Alteração de função simulada (mockup). Nenhuma alteração foi salva no banco.");
  };

  const handleSaveParams = () => {
    toast.info("Parâmetros simulados (mockup). Nenhuma alteração foi salva no banco.");
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* User Management */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="section-title flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Gestão de Usuários
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Gerencie os cargos dos usuários do sistema. Alterações aqui são apenas visuais (mockup).
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">E-mail</TableHead>
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
                        {user.displayName}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.position}
                        onValueChange={(val) => handlePositionChange(user.id, val as any)}
                      >
                        <SelectTrigger className="h-8 text-xs w-[150px]">
                          <SelectValue />
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
                        value={user.role}
                        onValueChange={(val) => handleRoleChange(user.id, val as "admin" | "gestor" | "user")}
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
                              User
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Mockup</Badge>
            As alterações de cargo serão integradas ao Supabase em uma próxima etapa.
          </p>
        </CardContent>
      </Card>

      {/* Global Parameters */}
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

          <Button onClick={handleSaveParams} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Salvar Parâmetros Globais
            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">Mockup</Badge>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
