import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isOperationalPosition } from "@/lib/roles";

export type UserRole = "admin" | "gestor" | "user";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: UserRole;
  position: string;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  role: "user",
  position: "",
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>("user");
  const [position, setPosition] = useState<string>("");
  const profileTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchRole = useCallback(async (userId: string) => {
    try {
      // Tenta buscar o perfil do usuário
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, position")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile && !error) {
        const profilePosition = profile.position ?? "";
        const normalizedRole = profile.role === "admin" && isOperationalPosition(profilePosition)
          ? "user"
          : profile.role;
        setRole(normalizedRole as UserRole);
        setPosition(profilePosition);
      } else {
        setRole("user");
        setPosition("");
      }
    } catch (err) {
      console.warn("[useAuth] Erro ao carregar role, usando padrão 'user'");
      setRole("user");
      setPosition("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Safety Force - Libera em no máximo 4 segundos
    const safety = setTimeout(() => {
      setLoading(false);
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setLoading(false);
        setRole("user");
        setPosition("");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safety);
    };
  }, [fetchRole]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`auth-profile-${userId.slice(0, 8)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
        () => {
          clearTimeout(profileTimer.current);
          profileTimer.current = setTimeout(() => fetchRole(userId), 300);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(profileTimer.current);
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchRole]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setRole("user");
    setPosition("");
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchRole(session.user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, role, position, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
