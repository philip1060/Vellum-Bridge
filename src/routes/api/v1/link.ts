import { createFileRoute } from "@tanstack/react-router";
import { empty, json } from "@/lib/vellum/http";
import { toSillyTavern } from "@/lib/vellum/st";

function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Use an http or https link.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
  ) {
    throw new Error("That address is not a public Vellum page.");
  }
}

function parseLink(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("That is not a link.");
  }
  assertPublic(url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!/^\/(c|l|p)\/[^/]+$/.test(path)) {
    throw new Error("Use a character (/c/), lorebook (/l/), or persona (/p/) link.");
  }
  url.pathname = path;
  url.hash = "";
  return url;
}

async function readLimited(res: Response, max: number): Promise<ArrayBuffer> {
  const buf = await res.arrayBuffer();
  if (buf.byteLength > max) throw new Error("That page was too large to read.");
  return buf;
}

export const Route = createFileRoute("/api/v1/link")({
  server: {
    handlers: {
      OPTIONS: () => empty(),
      POST: async ({ request }) => {
        let body: { url?: unknown };
        try {
          body = (await request.json()) as { url?: unknown };
        } catch {
          return json({ error: "Send the Vellum link as JSON." }, 400);
        }
        if (typeof body.url !== "string" || !body.url.trim()) {
          return json({ error: "Paste a Vellum link." }, 400);
        }
        try {
          const pageUrl = parseLink(body.url);
          const { itemsFromLoader, portraitPath, readVellumLoader } = await import("@/lib/vellum/page.server");
          const res = await fetch(pageUrl, {
            headers: { accept: "text/html", "user-agent": "VellumBridge/1.0" },
            redirect: "follow",
            signal: AbortSignal.timeout(15000),
          });
          assertPublic(new URL(res.url));
          if (!res.ok) return json({ error: `That page answered ${res.status}.` }, 422);
          const html = new TextDecoder().decode(await readLimited(res, 2_000_000));
          const loader = readVellumLoader(html);
          if (!loader) return json({ error: "That page had no card, lorebook, or persona." }, 422);
          const items = itemsFromLoader(loader);
          if (!items.length) return json({ error: "That page had nothing this bridge could read." }, 422);
          let portrait: { contentType: string; base64: string } | null = null;
          const path = portraitPath(loader);
          if (path) {
            const imageUrl = new URL(path, pageUrl);
            assertPublic(imageUrl);
            const image = await fetch(imageUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
            assertPublic(new URL(image.url));
            if (image.ok) {
              const bytes = new Uint8Array(await readLimited(image, 4_000_000));
              if (bytes.byteLength) {
                portrait = {
                  contentType: image.headers.get("content-type")?.split(";")[0] || "application/octet-stream",
                  base64: Buffer.from(bytes).toString("base64"),
                };
              }
            }
          }
          return json({
            protocol: "vellum-catalog-v1",
            items,
            sillytavern: items.map(toSillyTavern),
            portrait,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not read that link.";
          return json({ error: message }, 422);
        }
      },
    },
  },
});
