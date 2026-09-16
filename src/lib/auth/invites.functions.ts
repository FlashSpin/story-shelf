import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, requireEditorMiddleware } from "@/lib/auth/middleware";

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

/**
 * Create a single-use editor invite (7-day expiry). Returns a copy-paste path
 * with the raw token — only the hash is stored.
 *
 * Uses authMiddleware (for userId/email) + requireEditorMiddleware (membership).
 */
export const createEditorInvite = createServerFn({ method: "POST" })
  .validator(z.object({ email: emailSchema }))
  .middleware([authMiddleware, requireEditorMiddleware])
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      path: string;
      email: string;
      expiresAt: string;
    }> => {
      const { createEditorInvite: create } = await import("./invites.server");
      const userId = context.userId as string;
      const userEmail = context.userEmail as string | null;
      if (!userId || !userEmail) {
        throw new Error("Editor session required to create invites");
      }
      const invite = await create({
        email: data.email,
        createdByUserId: userId,
        createdByEmail: userEmail,
      });
      return {
        path: invite.path,
        email: invite.email,
        expiresAt: invite.expiresAt,
      };
    },
  );

/** Public: validate token and return invitee email when still redeemable. */
export const previewEditorInvite = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().trim().min(16).max(200) }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; email: string; expiresAt: string }
      | { ok: false; reason: "invalid" }
    > => {
      const { previewInvite } = await import("./invites.server");
      const preview = await previewInvite(data.token);
      if (!preview) return { ok: false, reason: "invalid" };
      return { ok: true, email: preview.email, expiresAt: preview.expiresAt };
    },
  );
