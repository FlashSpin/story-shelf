import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { looksLikeIsbn, canonicalIsbn } from "@/lib/isbn";

type DetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function getDetector(): DetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ??
    null
  );
}

export function scannerSupported(): boolean {
  return Boolean(getDetector());
}

export function BarcodeScanner({
  onDetect,
  onCancel,
}: {
  onDetect: (isbn: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const Detector = getDetector();
    let cancelled = false;
    let timer: number | null = null;

    async function start() {
      if (!Detector) {
        setError("This browser cannot scan barcodes. Enter the ISBN instead.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is not available here. Enter the ISBN instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });
        const tick = async () => {
          if (cancelled || !video || video.readyState < 2) {
            timer = window.setTimeout(tick, 250);
            return;
          }
          try {
            const codes = await detector.detect(video);
            const isbn = codes
              .map((c) => c.rawValue)
              .map((v) => canonicalIsbn(v) ?? v)
              .find((v) => looksLikeIsbn(v));
            if (isbn) {
              onDetect(isbn);
              return;
            }
          } catch {
            // keep scanning
          }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError("Camera permission was declined. Enter the ISBN instead.");
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onDetect]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl bg-foreground aspect-4/3">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-2/5 w-4/5 rounded-lg border-2 border-primary-foreground/80" />
        </div>
      </div>
      {error ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CameraOff className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Point the camera at the barcode on the back of the book.
        </p>
      )}
      <Button variant="outline" onClick={onCancel} type="button">
        Cancel scan
      </Button>
    </div>
  );
}
