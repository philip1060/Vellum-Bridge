import { createFileRoute } from "@tanstack/react-router";
import { empty, json } from "@/lib/vellum/http";
import { listVault } from "@/lib/vellum/vault";

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      OPTIONS: () => empty(),
      GET: () => {
        const items = listVault();
        return json({
          name: "Vellum Bridge",
          protocol: "vellum-catalog-v1",
          adapters: ["vault", "archives", "editor"],
          counts: {
            card: items.filter((item) => item.kind === "card").length,
            lorebook: items.filter((item) => item.kind === "lorebook").length,
            persona: items.filter((item) => item.kind === "persona").length,
          },
        });
      },
    },
  },
});
