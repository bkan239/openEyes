import { list, put } from "@vercel/blob";

const CAPTURE_PREFIX = "captures/";

export type CaptureRecord = {
  id: string;
  capturedAt: string;
  capturedAtMs: number;
  url: string;
  pathname: string;
  size: number;
  contentType: string;
  uploadedAt: string;
};

export function getBlobToken(): string | undefined {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ??
    process.env.BLOB_READWRITE_TOKEN ??
    process.env["BLOB:READWRITE_TOKEN"]
  );
}

function extensionForContentType(contentType: string): string {
  return (
    {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
    }[contentType.toLowerCase()] ?? "bin"
  );
}

function contentTypeForPathname(pathname: string): string {
  const ext = pathname.split(".").pop()?.toLowerCase();
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
    }[ext ?? ""] ?? "application/octet-stream"
  );
}

function parseCaptureFromPathname(pathname: string): { capturedAtMs: number; id: string } | null {
  const filename = pathname.startsWith(CAPTURE_PREFIX) ? pathname.slice(CAPTURE_PREFIX.length) : pathname;
  const match = /^(\d+)_([^.]+)\.[^.]+$/.exec(filename);
  if (!match) {
    return null;
  }
  return {
    capturedAtMs: Number(match[1]),
    id: match[2],
  };
}

export async function putCaptureFromDataUrl(dataUrl: string, capturedAt: string): Promise<CaptureRecord> {
  const token = getBlobToken();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Expected image data URL");
  }

  const contentType = match[1].toLowerCase();
  const data = Buffer.from(match[2], "base64");
  const capturedAtMs = Date.parse(capturedAt);
  if (Number.isNaN(capturedAtMs)) {
    throw new Error("Invalid capturedAt timestamp");
  }

  const id = `cap_${Math.random().toString(36).slice(2, 12)}`;
  const ext = extensionForContentType(contentType);
  const pathname = `${CAPTURE_PREFIX}${capturedAtMs}_${id}.${ext}`;

  const blob = await put(pathname, data, {
    access: "public",
    ...(token ? { token } : {}),
    contentType,
    addRandomSuffix: false,
  });

  return {
    id,
    capturedAt: new Date(capturedAtMs).toISOString(),
    capturedAtMs,
    url: blob.url,
    pathname: blob.pathname,
    size: data.length,
    contentType,
    uploadedAt: new Date().toISOString(),
  };
}

export async function listCaptures(limit: number): Promise<CaptureRecord[]> {
  const token = getBlobToken();
  const { blobs } = await list({
    ...(token ? { token } : {}),
    limit,
    prefix: CAPTURE_PREFIX,
  });

  const captures = blobs
    .map((blob) => {
      const parsed = parseCaptureFromPathname(blob.pathname);
      if (!parsed) {
        return null;
      }
      return {
        id: parsed.id,
        capturedAt: new Date(parsed.capturedAtMs).toISOString(),
        capturedAtMs: parsed.capturedAtMs,
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        contentType: contentTypeForPathname(blob.pathname),
        uploadedAt: blob.uploadedAt.toISOString(),
      } satisfies CaptureRecord;
    })
    .filter((item): item is CaptureRecord => item !== null);

  captures.sort((a, b) => b.capturedAtMs - a.capturedAtMs);
  return captures;
}
