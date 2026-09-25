import React, { useState } from "react";
import { BillProvider, useBill } from "@/context/BillContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { JoinCodeBanner } from "@/components/JoinCodeBanner";
import { HomeScreen } from "@/screens/HomeScreen";
import { PeopleScreen } from "@/screens/PeopleScreen";
import { ItemsScreen } from "@/screens/ItemsScreen";
import { AssignScreen } from "@/screens/AssignScreen";
import { SummaryScreen } from "@/screens/SummaryScreen";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/screens/AuthScreen";

type Step = "home" | "people" | "items" | "assign" | "summary";

function AppShell() {
  const { bill, loading, readOnly } = useBill();
  const { account, loading: authLoading, logout } = useAuth();
  const [step, setStep] = useState<Step>("home");

  // When a bill is restored from localStorage on page load, land somewhere
  // sensible instead of always starting at "add people" again.
  const enterBillAtSensibleStep = () => {
    setStep(readOnly ? "summary" : "people");
  };

  const renderStep = () => {
    switch (step) {
      case "home":
        return <HomeScreen onEnterBill={enterBillAtSensibleStep} />;
      case "people":
        return <PeopleScreen onNext={() => setStep("items")} />;
      case "items":
        return <ItemsScreen onNext={() => setStep("assign")} />;
      case "assign":
        return <AssignScreen onNext={() => setStep("summary")} />;
      case "summary":
        return <SummaryScreen onRestart={() => setStep("home")} />;
    }
  };

  // On initial mount, if a bill is being restored from localStorage, jump
  // straight past Home once it resolves rather than flashing the landing
  // screen first.
  React.useEffect(() => {
    if (bill && (readOnly || bill.paidAt) && step !== "summary") {
      setStep("summary");
    } else if (bill && step === "home") {
      setStep(readOnly ? "summary" : bill.items.length > 0 ? "assign" : bill.people.length > 0 ? "items" : "people");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill, readOnly]);

  return (
    <div className="app-shell">
      {!authLoading && account && <div className="row-between body-faint" style={{ marginBottom: 16 }}><span>{account.displayName}</span><button className="btn-danger-text" onClick={() => void logout()}>Log out</button></div>}
      <ErrorBanner />
      {step !== "home" && <JoinCodeBanner />}
      {loading && step === "home" ? <p className="body-faint">Loading…</p> : renderStep()}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { account, loading } = useAuth();
  if (loading) return <div className="app-shell"><p className="body-faint">Loading...</p></div>;
  if (!account) return <div className="app-shell"><AuthScreen /></div>;
  return <BillProvider ownerId={account.id}><AppShell /></BillProvider>;
}
