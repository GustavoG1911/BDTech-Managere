import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { useEffect } from "react";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import SettingsPage from "./pages/Settings.tsx";
import Financeiro from "./pages/Financeiro.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RefreshCw } from "lucide-react";
import { isPureSystemAdmin } from "@/lib/roles";

const queryClient = new QueryClient();

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role, position } = useAuth();
  const location = useLocation();

  if (loading) {
    return <SyncingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isPureSystemAdmin(role, position) && location.pathname !== "/settings") {
    return <Navigate to="/settings" replace />;
  }
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <SyncingScreen />;
  }

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => {
  useEffect(() => {
    console.log("[App] App montado com sucesso");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
