import { createFileRoute } from "@tanstack/react-router";
import { adaptPayload } from "@/lib/vellum/adapt";
import { empty, json } from "@/lib/vellum/http";
import { toSillyTavern } from "@/lib/vellum/st";

export const Route = createFileRoute("/api/v1/adapt")({
  server: {
    handlers: {
      OPTIONS: () => empty(),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Send JSON from the vault, the archives, or the card editor." }, 400);
        }
        const source = new URL(request.url).searchParams.get("source");
        const hint = source === "archives" || source === "editor" || source === "vault" ? source : "bundle";
        const items = adaptPayload(body, hint);
        if (!items.length) {
          return json(
            { error: "Nothing in that file matched a card, lorebook, persona, or Vellum bundle." },
            422,
          );
        }
        return json({
          protocol: "vellum-catalog-v1",
          items,
          sillytavern: items.map(toSillyTavern),
        });
      },
    },
  },
});
