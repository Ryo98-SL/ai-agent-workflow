import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Input } from "@workbench/components/ui/input";
import { Label } from "@workbench/components/ui/label";
import { Button } from "../workbench/components/Button";
import { useWorkbenchAuthClient } from "../data/WorkbenchDataProvider";

type Mode = "sign-in" | "sign-up";

type AuthFormProps = {
  /** Called after a successful email sign-in / sign-up. */
  onAuthenticated?: () => void;
};

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const authClient = useWorkbenchAuthClient();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name || email });
      if (result.error) {
        setError(errorMessage(result.error));
        return;
      }
      onAuthenticated?.();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: window.location.href });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <form className="space-y-4 p-4" onSubmit={submit}>
      <div className="flex rounded-md border border-border p-0.5 text-sm">
        {(["sign-in", "sign-up"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={`flex-1 rounded-sm px-3 py-1.5 font-medium transition-colors ${
              mode === value ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "sign-in" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      {mode === "sign-up" && (
        <div className="space-y-1.5">
          <Label htmlFor="auth-name">Name</Label>
          <Input
            id="auth-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" variant="success" fullWidth disabled={pending}>
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="secondary" fullWidth onClick={signInWithGoogle} disabled={pending}>
        Continue with Google
      </Button>
    </form>
  );
}
