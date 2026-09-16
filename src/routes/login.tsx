import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <div className="h-40 w-full max-w-sm animate-pulse rounded-2xl bg-muted" />
      </main>
    );
  }

  if (user || done) return <Navigate to="/" />;

  async function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authEnabled || !emailAndPasswordEnabled || submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: "/",
      });

      if (result.error) {
        setError(result.error.message || "Sign-in failed. Check email and password.");
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
        err instanceof Error ? err.message : "Sign-in failed. Try again.";
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
          Sign in to help
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Anyone can browse Raffy's shelf. Sign in if you've been invited to help
          — there's no open signup.
        </p>

        {authEnabled ? (
          <div className="mt-8 flex flex-col gap-6">
            {emailAndPasswordEnabled ? (
              <form className="flex flex-col gap-3" onSubmit={onEmailSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
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

                <Button
                  type="submit"
                  className="h-12 w-full"
                  disabled={submitting}
                >
                  {submitting ? "Signing in…" : "Sign in with email"}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Invite-only: helpers sign in with email here. New accounts are
                  created from an invite link — not from this page.
                </p>
              </form>
            ) : null}

            <div className="flex flex-col gap-2">
              {emailAndPasswordEnabled ? (
                <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                  Or continue with
                </p>
              ) : null}
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="secondary"
                  className="h-12 w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
              {emailAndPasswordEnabled ? (
                <p className="text-xs text-muted-foreground">
                  Google or X may appear when available. Otherwise invited
                  helpers use email and password above.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Sign-in is disabled.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            to="/"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to the shelf
          </Link>
        </p>
      </div>
    </main>
  );
}
