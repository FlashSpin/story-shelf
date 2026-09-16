import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  authClient,
  authEnabled,
} from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { INVITE_TOKEN_HEADER } from "@/lib/auth/invite-constants";
import { previewEditorInvite } from "@/lib/auth/invites.functions";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/invite/$token")({
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useParams();
  const { user, isPending: authPending } = useCurrentUserState();
  const [preview, setPreview] = useState<
    | { status: "loading" }
    | { status: "invalid" }
    | { status: "ready"; email: string; expiresAt: string }
  >({ status: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreview({ status: "loading" });
    void previewEditorInvite({ data: { token } })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setPreview({ status: "invalid" });
          return;
        }
        setPreview({
          status: "ready",
          email: result.email,
          expiresAt: result.expiresAt,
        });
      })
      .catch(() => {
        if (!cancelled) setPreview({ status: "invalid" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (authPending || preview.status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <div className="h-40 w-full max-w-sm animate-pulse rounded-2xl bg-muted" />
      </main>
    );
  }

  if (user || done) return <Navigate to="/" />;

  if (preview.status === "invalid") {
    return (
      <main className="grid min-h-dvh place-items-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Raffy's shelf
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
            Invite unavailable
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link is invalid, expired, or already used. Ask a current
            editor for a new one.
          </p>
          <p className="mt-6 text-sm">
            <Link
              to="/"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to Raffy's shelf
            </Link>
          </p>
        </div>
      </main>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !authEnabled ||
      !emailAndPasswordEnabled ||
      submitting ||
      preview.status !== "ready"
    ) {
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await authClient.signUp.email(
        {
          name: name.trim() || preview.email.split("@")[0] || "Editor",
          email: preview.email,
          password,
          callbackURL: "/",
        },
        {
          headers: {
            [INVITE_TOKEN_HEADER]: token,
          },
        },
      );

      if (result.error) {
        setError(
          result.error.message ||
            "Could not create your editor account. Try again.",
        );
        return;
      }

      try {
        await authClient.getSession();
      } catch {
        /* session store recovers on next useSession fetch */
      }
      setDone(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not complete setup.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Raffy's shelf
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight">
          Join Raffy's shelf
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You were invited to help with Raffy's shelf. Choose a password for{" "}
          <span className="font-medium text-foreground">{preview.email}</span>.
          Guests stay browse-only — this link is for you only.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Expires{" "}
          {new Date(preview.expiresAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>

        {authEnabled && emailAndPasswordEnabled ? (
          <form className="mt-8 flex flex-col gap-3" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                readOnly
                value={preview.email}
                className="bg-muted"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Password</Label>
              <Input
                id="invite-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="h-12 w-full" disabled={submitting}>
              {submitting ? "Creating editor account…" : "Complete setup"}
            </Button>
          </form>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Sign-in is disabled.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
