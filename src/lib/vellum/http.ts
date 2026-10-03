import { asArrayBuffer } from "./zip";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

export function empty(status = 204): Response {
  return new Response(null, { status, headers: CORS });
}

export function bytes(body: Uint8Array, contentType: string, filename: string): Response {
  return new Response(new Blob([asArrayBuffer(body)]), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      ...CORS,
    },
  });
}
