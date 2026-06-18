import { Loader2 } from "lucide-react";
import { useState, type FormEvent, type SVGProps } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { toast } from "sonner";
import { Input } from "@workbench/components/ui/input";
import { Label } from "@workbench/components/ui/label";
import { Button } from "../workbench/components/Button";
import { useWorkbenchAuthClient } from "../data/WorkbenchDataProvider";

type Mode = "sign-in" | "sign-up";

type AuthFormProps = {
  /** Called after a successful email sign-in / sign-up. */
  onAuthenticated?: () => void;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

/** Google's multicolor "G" mark — lucide ships no brand icons, so inline the SVG. */
function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const { t } = useTranslation("workbench");
  const authClient = useWorkbenchAuthClient();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name || email });
      if (result.error) {
        toast.error(errorMessage(result.error, t("auth.genericError")));
        return;
      }
      onAuthenticated?.();
    } catch (caught) {
      toast.error(errorMessage(caught, t("auth.genericError")));
    } finally {
      setPending(false);
    }
  };

  const signInWithGoogle = async () => {
    setGooglePending(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: window.location.href });
      if (result.error) {
        toast.error(errorMessage(result.error, t("auth.genericError")));
        setGooglePending(false);
      }
      // On success the browser redirects to Google, so keep the pending state.
    } catch (caught) {
      toast.error(errorMessage(caught, t("auth.genericError")));
      setGooglePending(false);
    }
  };

  const busy = pending || googlePending;

  return (
    <form className="space-y-4 p-4" onSubmit={submit}>
      <div className="flex rounded-md border border-border p-0.5 text-sm">
        {(["sign-in", "sign-up"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`flex-1 rounded-sm px-3 py-1.5 font-medium transition-colors ${
              mode === value ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "sign-in" ? t("auth.signIn") : t("auth.signUp")}
          </button>
        ))}
      </div>

      {mode === "sign-up" && (
        <div className="space-y-1.5">
          <Label htmlFor="auth-name">{t("auth.name")}</Label>
          <Input
            id="auth-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("auth.namePlaceholder")}
            autoComplete="name"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="auth-email">{t("auth.email")}</Label>
        <Input
          id="auth-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("auth.emailPlaceholder")}
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="auth-password">{t("auth.password")}</Label>
        <Input
          id="auth-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("auth.passwordPlaceholder")}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        />
      </div>

      <Button type="submit" variant="success" fullWidth disabled={busy}>
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {mode === "sign-in" ? t("auth.signIn") : t("auth.createAccount")}
      </Button>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("auth.divider")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="secondary"
        fullWidth
        className="gap-2"
        onClick={signInWithGoogle}
        disabled={busy}
      >
        {googlePending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <GoogleIcon />}
        {t("auth.google")}
      </Button>
    </form>
  );
}
