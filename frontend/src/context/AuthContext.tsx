import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Account } from "@/types";
import { api, ApiError, authToken } from "@/api/client";
import { supabase } from "@/auth/supabase";

type AuthContextValue = {
  account: Account | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  loginWithProvider: (provider: "google" | "apple") => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(Boolean(authToken.get()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authToken.get()) {
      api.getMe().then(setAccount).catch(() => authToken.clear()).finally(() => setLoading(false));
      return;
    }
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    client.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session?.user.email) return;
      const result = await api.loginWithOAuth({ accessToken: session.access_token });
      authToken.set(result.token);
      setAccount(result.account);
      await client.auth.signOut();
    }).catch((e) => {
      setError(e instanceof ApiError ? e.message : "OAuth authentication failed.");
    }).finally(() => setLoading(false));
  }, []);

  const authenticate = async (action: () => Promise<{ account: Account; token: string }>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await action();
      authToken.set(result.token);
      setAccount(result.account);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Authentication failed.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try { await api.logout(); } finally { authToken.clear(); setAccount(null); }
  };

  const loginWithProvider = async (provider: "google" | "apple") => {
    if (!supabase) {
      setError("Social login is not configured yet.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  return <AuthContext.Provider value={{
    account, loading, error,
    login: (email, password) => authenticate(() => api.login({ email, password })),
    register: (email, password, displayName) => authenticate(() => api.register({ email, password, displayName })),
    loginWithProvider,
    logout,
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}