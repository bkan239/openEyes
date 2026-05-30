"use client";

import { useRef, useState } from "react";
import { createUploadUrl, registerClip } from "@/lib/api";
import { getDeviceId, hashMediaWithContext } from "@/lib/hash";

type Step =
  | "idle"
  | "hashing"
  | "requesting"
  | "uploading"
  | "registering"
  | "done"
  | "error";

/**
 * PWA capture/upload flow. Records (or picks) a clip, computes the
 * capture-provenance hash on-device, requests a presigned S3 URL, uploads the
 * bytes directly to the bucket, then registers the clip with the API.
 *
 * TODO(team): swap the file picker for live MediaRecorder capture + optional
 * GPS via navigator.geolocation, and add the native Secure-Enclave signature.
 */
export default function CapturePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string>("");

  async function onUpload(file: File) {
    try {
      const capturedAt = new Date().toISOString();
      const deviceId = getDeviceId();

      setStep("hashing");
      const hash = await hashMediaWithContext(file, { deviceId, capturedAt });

      setStep("requesting");
      const { clipId, uploadUrl } = await createUploadUrl({
        contentType: file.type || "video/mp4",
        hash,
        deviceId,
        capturedAt,
      });

      setStep("uploading");
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "video/mp4" },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);

      setStep("registering");
      await registerClip({ clipId });

      setStep("done");
      setMessage(`Clip registered (${clipId}). Hash: ${hash.slice(0, 16)}…`);
    } catch (err) {
      setStep("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const busy = ["hashing", "requesting", "uploading", "registering"].includes(
    step,
  );

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Capture a clip</h1>
      <p className="text-mist mt-1 text-sm">
        Your clip is hashed on this device before it leaves it. The hash proves
        the bytes weren&apos;t altered after capture — corroboration across
        independent angles does the rest.
      </p>

      <div className="border-edge bg-surface mt-6 rounded-2xl border p-6">
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        <button
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="bg-eye w-full rounded-full px-6 py-3 font-medium text-black disabled:opacity-50"
        >
          {busy ? "Working…" : "Record or choose a clip"}
        </button>

        <ol className="text-mist mt-6 space-y-2 text-sm">
          {(
            [
              ["hashing", "Hashing on device (SHA-256)"],
              ["requesting", "Requesting secure upload URL"],
              ["uploading", "Uploading to storage"],
              ["registering", "Registering provenance"],
            ] as const
          ).map(([key, label]) => (
            <li key={key} className="flex items-center gap-2">
              <span
                className={
                  step === key
                    ? "text-eye"
                    : isPast(step, key)
                      ? "text-trust-high"
                      : "text-mist"
                }
              >
                {isPast(step, key) ? "✓" : step === key ? "●" : "○"}
              </span>
              {label}
            </li>
          ))}
        </ol>

        {step === "done" && (
          <p className="text-trust-high mt-4 text-sm">{message}</p>
        )}
        {step === "error" && (
          <p className="text-trust-low mt-4 text-sm">Error: {message}</p>
        )}
      </div>
    </div>
  );
}

const ORDER = ["idle", "hashing", "requesting", "uploading", "registering", "done"];
function isPast(current: Step, key: Step): boolean {
  if (current === "error") return false;
  return ORDER.indexOf(current) > ORDER.indexOf(key);
}
