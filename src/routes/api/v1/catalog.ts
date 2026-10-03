import { createFileRoute } from "@tanstack/react-router";
import { empty, json } from "@/lib/vellum/http";
import { listVault, summarize } from "@/lib/vellum/vault";

export const Route = createFileRoute("/api/v1/catalog")({
  server: {
    handlers: {
      OPTIONS: () => empty(),
      GET: ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        const kind = url.searchParams.get("kind") ?? "all";
        const nsfw = url.searchParams.get("nsfw") ?? "hide";
        const items = listVault().filter((item) => {
          if (kind !== "all" && item.kind !== kind) return false;
          if (nsfw === "hide" && item.nsfw) return false;
          if (nsfw === "only" && !item.nsfw) return false;
          if (!q) return true;
          const hay = [item.name, item.creator, item.blurb, ...item.tags].join(" ").toLowerCase();
          return hay.includes(q);
        });
        return json({
          protocol: "vellum-catalog-v1",
          source: "vault",
          items: items.map(summarize),
        });
      },
    },
  },
});
