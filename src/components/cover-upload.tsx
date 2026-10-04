import { useId, useState, type ReactNode } from "react";
import { Camera, ImageUp, LoaderCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import { BookCover } from "@/components/book-cover";
import { CoverCropDialog } from "@/components/cover-crop-dialog";
import type { CropRect } from "@/lib/cover-crop";
import {
  COVER_PHOTO_FRIENDLY_ERROR,
  CoverPhotoError,
  loadCoverWorkingCanvas,
  renderCoverCrop,
} from "@/lib/cover-image";
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
  // Photo waiting in the crop step (downscaled working canvas).
  const [cropCanvas, setCropCanvas] = useState<HTMLCanvasElement | null>(null);
  const [encoding, setEncoding] = useState(false);

  function reportPhotoError(err: unknown, file?: File) {
    // Log the real reason (e.g. decode failure on old iOS Safari); show a
    // friendly message instead of raw browser errors.
    console.error(
      "[cover] could not prepare photo",
      file ? { name: file.name, type: file.type, size: file.size } : undefined,
      err,
      err instanceof CoverPhotoError ? err.detail : undefined,
    );
    toast.error(
      err instanceof CoverPhotoError ? err.message : COVER_PHOTO_FRIENDLY_ERROR,
    );
  }

  async function onFile(file: File | undefined) {
    if (!file || disabled) return;
    setBusy(true);
    try {
      setCropCanvas(await loadCoverWorkingCanvas(file));
    } catch (err) {
      reportPhotoError(err, file);
    } finally {
      setBusy(false);
    }
  }

  function closeCrop() {
    if (cropCanvas) {
      // Release the working canvas memory (matters on old iPhones).
      cropCanvas.width = 0;
      cropCanvas.height = 0;
    }
    setCropCanvas(null);
  }

  async function onUseCrop(crop: CropRect) {
    if (!cropCanvas) return;
    setEncoding(true);
    try {
      const dataUrl = await renderCoverCrop(cropCanvas, crop);
      closeCrop();
      onChange(dataUrl);
    } catch (err) {
      reportPhotoError(err);
    } finally {
      setEncoding(false);
    }
  }

  const locked = disabled || busy || Boolean(cropCanvas);

  return (
    <div className="flex flex-col items-center gap-2">
      <BookCover
        title={title || "Cover"}
        authors={authors}
        coverUrl={coverUrl}
        className="mx-auto w-36 sm:w-full"
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
      <CoverCropDialog
        canvas={cropCanvas}
        open={Boolean(cropCanvas)}
        busy={encoding}
        onCancel={closeCrop}
        onConfirm={(crop) => void onUseCrop(crop)}
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
