import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Loader2, Mail, Chrome } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log("[Auth] Tentando login com:", email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Ignorar erro de schema e deixar o session/user gerenciar
      if (error.message?.includes("querying schema")) {
        console.warn("[Auth] Erro de schema ignorado. Conectando...");
      } else {
        console.error("[Auth] Erro no login:", error);
        toast.error(error.message);
      }
    } else {
      console.log("[Auth] Login bem-sucedido. Session ID:", data?.session?.access_token.slice(0, 10));
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verifique seu email para confirmar o cadastro!");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Digite seu email primeiro");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Email de recuperação enviado!");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">BD Tech Manager</h1>
          <p className="text-sm text-muted-foreground">Gestão de comissões e recebíveis</p>
        </div>

        <Card className="glass-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-base">Acesse sua conta</CardTitle>
            <p className="text-center text-xs text-muted-foreground">
              O acesso é liberado somente por convite. Use o mesmo e-mail convidado pelo administrador.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google */}
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
              <Chrome className="h-4 w-4 mr-2" />
              Entrar com Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            {/* Email tabs */}
            <Tabs defaultValue="login">
              <TabsList className="w-full h-8">
                <TabsTrigger value="login" className="text-xs flex-1">Entrar</TabsTrigger>
                <TabsTrigger value="signup" className="text-xs flex-1">Tenho convite</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-3 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4 mr-2" />Entrar</>}
                  </Button>
                  <Button type="button" variant="link" className="w-full text-xs p-0 h-auto" onClick={handleForgotPassword}>
                    Esqueci minha senha
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar acesso"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
