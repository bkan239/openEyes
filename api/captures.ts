import type { VercelRequest, VercelResponse } from "@vercel/node";

import { listCaptures, putCaptureFromDataUrl } from "./_blob";

function setCors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

type UploadBody = {
  imageDataUrl?: string;
  capturedAt?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === "GET") {
      const limit = Number(req.query.limit ?? 200);
      const captures = await listCaptures(Number.isFinite(limit) ? Math.min(limit, 1000) : 200);
      res.status(200).json(captures);
      return;
    }

    if (req.method === "POST") {
      const body: UploadBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
      if (!body.imageDataUrl || !body.capturedAt) {
        res.status(400).json({ error: "imageDataUrl and capturedAt are required" });
        return;
      }

      const uploaded = await putCaptureFromDataUrl(body.imageDataUrl, body.capturedAt);
      res.status(200).json(uploaded);
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected error" });
  }
}
