import { useId, useState, type ReactNode } from "react";
import { Camera, ImageUp, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { BookCover } from "@/components/book-cover";
import { compressCover } from "@/lib/cover-image";
import { cn } from "@/lib/utils";

export function CoverUpload({
  title,
  authors,
  coverUrl,
  onChange,
  disabled,
}: {
  title: string;
  authors?: string;
  coverUrl?: string | null;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const cameraId = useId();
  const fileId = useId();
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || disabled) return;
    setBusy(true);
    try {
      onChange(await compressCover(file));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not read that photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const locked = disabled || busy;

  return (
    <div className="flex flex-col items-center gap-2">
      <BookCover
        title={title || "Cover"}
        authors={authors}
        coverUrl={coverUrl}
        className="w-28 sm:w-full"
      />
      <div className="grid w-full grid-cols-2 gap-2">
        <UploadButton
          htmlFor={cameraId}
          locked={locked}
          busy={busy}
          icon={<Camera className="size-4" />}
          label="Take photo"
        />
        <UploadButton
          htmlFor={fileId}
          locked={locked}
          busy={busy}
          icon={<ImageUp className="size-4" />}
          label={coverUrl ? "Replace" : "Upload"}
        />
      </div>
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={locked}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onFile(file);
        }}
      />
      <input
        id={fileId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={locked}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onFile(file);
        }}
      />
    </div>
  );
}

function UploadButton({
  htmlFor,
  locked,
  busy,
  icon,
  label,
}: {
  htmlFor: string;
  locked: boolean;
  busy: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 text-xs font-medium shadow-card sm:text-sm",
        locked ? "pointer-events-none opacity-50" : "hover:bg-muted",
      )}
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {label}
    </label>
  );
}
