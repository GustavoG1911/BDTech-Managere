import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useUser, useClerk } from "@clerk/react";
import { isOperationalPosition } from "@/lib/roles";

export type UserRole = "admin" | "gestor" | "user";

interface AuthContextType {
  user: { id: string; email?: string } | null;
  loading: boolean;
  role: UserRole;
  position: string;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: "user",
  position: "",
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [role, setRole] = useState<UserRole>("user");
  const [position, setPosition] = useState<string>("");
  const [profileLoading, setProfileLoading] = useState(true);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  const fetchProfile = async (_userId: string) => {
    try {
      setProfileLoading(true);
      const res = await fetch("/api/profiles/me");
      if (res.ok) {
        const profile = await res.json();
        const profilePosition = profile.position ?? "";
        const normalizedRole =
          profile.role === "admin" && isOperationalPosition(profilePosition)
            ? "user"
            : profile.role;
        setRole((normalizedRole as UserRole) ?? "user");
        setPosition(profilePosition);
      } else if (res.status === 404) {
        await fetch("/api/profiles/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user" }),
        });
        setRole("user");
        setPosition("");
      } else {
        setRole("user");
        setPosition("");
      }
    } catch {
      setRole("user");
      setPosition("");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    const userId = clerkUser?.id ?? null;
    if (userId !== prevUserIdRef.current) {
      prevUserIdRef.current = userId;
      if (userId) {
        fetchProfile(userId);
      } else {
        setRole("user");
        setPosition("");
        setProfileLoading(false);
      }
    }
  }, [isLoaded, clerkUser?.id]);

  const loading = !isLoaded || (!!clerkUser && profileLoading);

  const user = clerkUser
    ? { id: clerkUser.id, email: clerkUser.emailAddresses[0]?.emailAddress }
    : null;

  const signOut = async () => {
    await clerkSignOut();
    setRole("user");
    setPosition("");
  };

  const refreshProfile = async () => {
    if (clerkUser?.id) await fetchProfile(clerkUser.id);
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, position, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
