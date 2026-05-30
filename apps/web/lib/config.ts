/**
 * Runtime config for the web app. `NEXT_PUBLIC_API_URL` is injected by SST
 * (see sst.config.ts) in deployed stages, and read from `.env` locally.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
