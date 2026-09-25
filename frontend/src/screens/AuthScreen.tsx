import { useState } from "react";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";

export function AuthScreen() {
  const { login, register, loginWithProvider, loading, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const submit = async () => {
    if (mode === "login") await login(email, password);
    else await register(email, password, displayName);
  };

  return <div>
    <div className="row"><span className="wordmark">SPLIT</span><span className="wordmark" style={{ color: "var(--settled)" }}>RECEIPT</span></div>
    <p className="body-faint">Keep your splits and paid bills with your account.</p>
    {mode === "register" && <input className="text-input" placeholder="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
    <input className="text-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 16 }} />
    <input className="text-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 12 }} />
    {error && <p className="body-faint" style={{ color: "var(--outstanding)" }}>{error}</p>}
    <Button label={loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"} onClick={() => void submit()} disabled={loading || !email || !password || (mode === "register" && !displayName)} style={{ width: "100%", marginTop: 16 }} />
    <div className="row" style={{ gap: 8, marginTop: 12 }}>
      <Button label="Continue with Google" onClick={() => void loginWithProvider("google")} disabled={loading} variant="secondary" style={{ flex: 1 }} />
      <Button label="Continue with Apple" onClick={() => void loginWithProvider("apple")} disabled={loading} variant="secondary" style={{ flex: 1 }} />
    </div>
    <button className="btn-danger-text" onClick={() => setMode(mode === "login" ? "register" : "login")} style={{ marginTop: 16, color: "var(--ink-faint)" }}>
      {mode === "login" ? "Create a personal account" : "I already have an account"}
    </button>
  </div>;
}