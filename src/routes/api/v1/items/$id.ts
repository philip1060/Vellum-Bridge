import { createFileRoute } from "@tanstack/react-router";
import { empty, json } from "@/lib/vellum/http";
import { toSillyTavern } from "@/lib/vellum/st";
import { getVaultItem } from "@/lib/vellum/vault";

export const Route = createFileRoute("/api/v1/items/$id")({
  server: {
    handlers: {
      OPTIONS: () => empty(),
      GET: ({ request, params }) => {
        const item = getVaultItem(params.id);
        if (!item) return json({ error: "Not in the vault" }, 404);
        const format = new URL(request.url).searchParams.get("format");
        if (format === "sillytavern") return json(toSillyTavern(item));
        return json(item);
      },
    },
  },
});
