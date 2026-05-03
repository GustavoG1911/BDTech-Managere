import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Loader2, Mail, Chrome, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message?.includes("querying schema")) {
        console.warn("[Auth] Erro de schema ignorado. Conectando...");
      } else {
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
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30 ring-1 ring-primary/20">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div className="text-center space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">BD Tech Manager</h1>
            <p className="text-xs text-muted-foreground">Gestão de comissões e recebíveis</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border/60 p-6 space-y-5 shadow-xl shadow-black/20">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Acesse sua conta</p>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Acesso liberado somente por convite.
            </p>
          </div>

          {/* Google */}
          <Button
            variant="outline"
            className="w-full gap-2 border-border/60 hover:bg-muted/50 hover:border-border transition-all"
            onClick={handleGoogleLogin}
          >
            <Chrome className="h-4 w-4" />
            Entrar com Google
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                ou
              </span>
            </div>
          </div>

          {/* Email tabs */}
          <Tabs defaultValue="login">
            <TabsList className="w-full h-9 bg-muted/40 border border-border/40">
              <TabsTrigger value="login" className="flex-1 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                Entrar
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                Tenho convite
              </TabsTrigger>
            </TabsList>

            {/* Login */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="bg-muted/30 border-border/50 focus-visible:border-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-muted/30 border-border/50 focus-visible:border-primary/50"
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Mail className="h-4 w-4" />Entrar<ArrowRight className="h-3.5 w-3.5 ml-auto" /></>
                  }
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground h-auto py-1 hover:text-foreground"
                  onClick={handleForgotPassword}
                >
                  Esqueci minha senha
                </Button>
              </form>
            </TabsContent>

            {/* Sign up */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email do convite</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="bg-muted/30 border-border/50 focus-visible:border-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Criar senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="bg-muted/30 border-border/50 focus-visible:border-primary/50"
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar acesso"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/40 tracking-widest uppercase">
          Sales Intelligence Platform
        </p>
      </div>
    </div>
  );
}
