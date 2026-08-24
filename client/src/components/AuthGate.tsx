import { authApi } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Scissors } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthGateProps = {
  callbackError?: string | null;
  recoveryMode?: boolean;
  resetToken?: string | null;
  onRecoveryComplete?: () => Promise<void> | void;
};

export default function AuthGate({ callbackError, recoveryMode = false, resetToken, onRecoveryComplete }: AuthGateProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmation, setRecoveryConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { isArabic, toggleLanguage } = useLanguage();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    try {
      if (recoveryMode) {
        if (!resetToken) throw new Error("This password reset link is invalid or expired.");
        if (recoveryPassword !== recoveryConfirmation) {
          setError("The passwords do not match.");
          return;
        }
        await authApi.reset(resetToken, recoveryPassword);
        setNotice("Password updated. Opening your ERP workspace…");
        await onRecoveryComplete?.();
        return;
      }

      if (mode === "forgot") {
        const response = await authApi.forgot(email);
        setNotice(response.resetUrl ? `Reset link created for local testing: ${response.resetUrl}` : response.message);
        setMode("login");
      } else if (mode === "login") {
        await authApi.login(email, password);
      } else {
        await authApi.register(name, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <div className="relative w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <Button data-no-translate type="button" variant="outline" size="sm" className="absolute right-5 top-5 rounded-xl" onClick={toggleLanguage}>{isArabic ? "EN" : "عربي"}</Button>
        <Scissors className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-5 text-center text-2xl font-semibold">
          {recoveryMode ? "Set a new password" : mode === "login" ? "Sign in to Al-Mamlaka ERP" : mode === "forgot" ? "Reset your password" : "Create your account"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {recoveryMode
            ? "For your security, choose a new password before entering the ERP workspace."
            : mode === "login"
              ? "Use the email and password set up for your staff account."
              : mode === "forgot"
                ? "Enter your staff email and request a secure reset link."
                : "The first account registered with the shop owner's email becomes the administrator."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {recoveryMode ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-password">New password</Label>
                <Input
                  id="recovery-password"
                  type="password"
                  value={recoveryPassword}
                  onChange={e => setRecoveryPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={200}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-confirmation">Confirm new password</Label>
                <Input
                  id="recovery-confirmation"
                  type="password"
                  value={recoveryConfirmation}
                  onChange={e => setRecoveryConfirmation(e.target.value)}
                  required
                  minLength={8}
                  maxLength={200}
                  autoComplete="new-password"
                />
              </div>
            </>
          ) : (
            <>
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={160}
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  maxLength={320}
                  autoComplete="email"
                />
              </div>
              {mode !== "forgot" && <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={200}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>}
            </>
          )}

          {!recoveryMode && callbackError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-5 text-amber-950">{callbackError}</div>}
          {notice && <p className="break-words text-sm text-emerald-600">{notice}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {recoveryMode ? "Update password" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create account"}
          </Button>
        </form>

        {!recoveryMode && <div className="mt-5 space-y-2 text-center text-sm text-muted-foreground">
          {mode === "login" && <button
            type="button"
            className="block w-full underline-offset-4 hover:underline"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setNotice(null);
            }}
          >
            Forgot password?
          </button>}
          <button
            type="button"
            className="block w-full underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "login" || mode === "forgot" ? "register" : "login");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "register" ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
        </div>}
      </div>
    </main>
  );
}
