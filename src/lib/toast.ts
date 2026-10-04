/**
 * App toast helper — use instead of importing `toast` from "sonner" directly.
 *
 * Success toasts are short (2.5s) so they never linger over the add-book
 * sheet or the header Add button on phones. Errors/info keep sonner's default
 * (4s). Every toast can be swiped or tapped away (see AppToaster).
 */
import { toast as sonnerToast, type ExternalToast } from "sonner";

export const SUCCESS_TOAST_MS = 2500;

type ToastMessage = Parameters<typeof sonnerToast.success>[0];

export const toast: typeof sonnerToast = Object.assign(
  (message: ToastMessage, data?: ExternalToast) => sonnerToast(message, data),
  sonnerToast,
  {
    success: (message: ToastMessage, data?: ExternalToast) =>
      sonnerToast.success(message, { duration: SUCCESS_TOAST_MS, ...data }),
  },
);
