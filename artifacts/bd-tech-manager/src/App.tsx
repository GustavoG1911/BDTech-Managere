import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index.tsx";
import SettingsPage from "./pages/Settings.tsx";
import Financeiro from "./pages/Financeiro.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RefreshCw } from "lucide-react";
import { isPureSystemAdmin } from "@/lib/roles";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#3b82f6",
    colorForeground: "#f1f5f9",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#1e293b",
    colorInput: "#0f172a",
    colorInputForeground: "#f1f5f9",
    colorNeutral: "#334155",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-slate-800 rounded-2xl w-[440px] max-w-full overflow-hidden border border-slate-700",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-100 font-bold",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-slate-200",
    formFieldLabel: "text-slate-300",
    footerActionLink: "text-blue-400 hover:text-blue-300",
    footerActionText: "text-slate-400",
    dividerText: "text-slate-500",
    identityPreviewEditButton: "text-blue-400",
    formFieldSuccessText: "text-green-400",
    alertText: "text-slate-200",
    logoBox: "flex justify-center",
    logoImage: "h-8",
    socialButtonsBlockButton: "border border-slate-600 bg-slate-700 hover:bg-slate-600",
    formButtonPrimary: "bg-blue-600 hover:bg-blue-500 text-white",
    formFieldInput: "bg-slate-900 border-slate-600 text-slate-100",
    footerAction: "bg-slate-900/50",
    dividerLine: "bg-slate-600",
    alert: "bg-slate-700 border-slate-600",
    otpCodeFieldInput: "bg-slate-900 border-slate-600 text-slate-100",
    formFieldRow: "",
    main: "",
  },
};

function SyncingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border/60 bg-card p-5 text-center shadow-lg">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">Atualizando o sistema</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Estamos sincronizando seu perfil, permissões e dados mais recentes.
        </p>
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role, position } = useAuth();
  const [location] = useLocation();

  if (loading) return <SyncingScreen />;
  if (!user) return <Redirect to="/sign-in" />;
  if (isPureSystemAdmin(role, position) && location !== "/settings") {
    return <Redirect to="/settings" />;
  }
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/">
          <ProtectedRoute><Index /></ProtectedRoute>
        </Route>
        <Route path="/settings">
          <ProtectedRoute><SettingsPage /></ProtectedRoute>
        </Route>
        <Route path="/financeiro">
          <ProtectedRoute><Financeiro /></ProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AuthProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Bem-vindo de volta",
            subtitle: "Entre para acessar sua conta",
          },
        },
        signUp: {
          start: {
            title: "Criar conta",
            subtitle: "Comece hoje mesmo",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

const App = () => {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
};

export default App;
