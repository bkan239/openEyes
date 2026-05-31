import JSZip from "jszip";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import { listCaptures } from "./_blob";

function setCors(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const limit = Number(req.query.limit ?? 200);
    const windowMinutes = Number(req.query.windowMinutes ?? 10);
    const safeLimit = Number.isFinite(limit) ? Math.min(limit, 1000) : 200;
    const safeWindowMinutes = Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 10;
    const minCapturedAtMs = Date.now() - safeWindowMinutes * 60 * 1000;
    const captures = (await listCaptures(safeLimit)).filter(
      (capture) => capture.capturedAtMs >= minCapturedAtMs,
    );
    const zip = new JSZip();

    for (const capture of captures) {
      const response = await fetch(capture.url);
      if (!response.ok) {
        continue;
      }
      const data = new Uint8Array(await response.arrayBuffer());
      const name = capture.pathname.replace(/^captures\//, "");
      zip.file(name, data);
    }

    const archive = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=captures.zip");
    res.status(200).send(archive);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected error" });
  }
}
