import { useState, type FormEvent } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { createEditorInvite } from "@/lib/auth/invites.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InviteEditorDialog({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setEmail("");
    setError(null);
    setSubmitting(false);
    setInviteUrl(null);
    setExpiresAt(null);
    setCopied(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    setCopied(false);
    try {
      const result = await createEditorInvite({ data: { email } });
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setInviteUrl(`${origin}${result.path}`);
      setExpiresAt(result.expiresAt);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create invite.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError("Could not copy — select the link and copy manually.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite editor</DialogTitle>
          <DialogDescription>
            Create a single-use link (expires in 7 days). The invitee opens it,
            sets a password for the email you enter here, and becomes an editor.
            There is no open signup.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-url">Copy-paste invite link</Label>
              <Input
                id="invite-url"
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs sm:text-sm"
              />
            </div>
            {expiresAt ? (
              <p className="text-xs text-muted-foreground">
                Expires{" "}
                {new Date(expiresAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · one-time use · bound to the invitee email
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copyLink()}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setInviteUrl(null);
                  setExpiresAt(null);
                  setCopied(false);
                  setError(null);
                }}
              >
                Invite another
              </Button>
            </div>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Invitee email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@example.com"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={submitting}>
              <UserPlus />
              {submitting ? "Creating invite…" : "Create invite link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
