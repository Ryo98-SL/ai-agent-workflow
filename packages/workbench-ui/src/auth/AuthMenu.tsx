import { LogIn, LogOut, User } from "lucide-react";
import { useState } from "react";
import { Button } from "../workbench/components/Button";
import { FloatingPanel } from "../workbench/components/FloatingPanel";
import { Popover } from "../workbench/components/Popover";
import { useWorkbenchAuthClient } from "../data/WorkbenchDataProvider";
import { useSession } from "../data/useAccount";
import { AuthForm } from "./AuthForm";

export function AuthMenu() {
  const authClient = useWorkbenchAuthClient();
  const { data, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const user = data?.user;

  if (isPending) {
    return (
      <Button variant="secondary" size="iconMd" disabled aria-label="Loading session">
        <User size={16} aria-hidden />
      </Button>
    );
  }

  if (!user) {
    return (
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            ref={ref}
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => setOpen((current) => !current)}
            aria-label="Sign in"
            title="Local mode — sign in to save"
          >
            <LogIn size={15} aria-hidden />
            Sign in
          </Button>
        )}
      >
        <FloatingPanel
          title="Sign in"
          description="Local workflows stay on this device until you sign in."
          closeLabel="Close sign in"
          onClose={() => setOpen(false)}
          className="w-[340px]"
        >
          <AuthForm onAuthenticated={() => setOpen(false)} />
        </FloatingPanel>
      </Popover>
    );
  }

  const label = user.name || user.email;
  const initial = (user.name || user.email || "?").slice(0, 1).toUpperCase();

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      renderTrigger={({ ref, props }) => (
        <Button
          {...props}
          ref={ref}
          variant="secondary"
          size="iconMd"
          onClick={() => setOpen((current) => !current)}
          aria-label="Account menu"
          title={label}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-brand-foreground">
            {initial}
          </span>
        </Button>
      )}
    >
      <div className="min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.name || "Signed in"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <div className="my-1 h-px bg-border" />
        <Button
          variant="ghost"
          size="unstyled"
          fullWidth
          className="justify-start gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={async () => {
            await authClient.signOut();
            setOpen(false);
          }}
        >
          <LogOut size={16} aria-hidden />
          Sign out
        </Button>
      </div>
    </Popover>
  );
}
