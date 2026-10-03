import { createFileRoute } from "@tanstack/react-router";
import indexJs from "../../../../public/plugins/vellum-bridge/index.js?raw";
import manifest from "../../../../public/plugins/vellum-bridge/manifest.json?raw";
import readme from "../../../../public/plugins/vellum-bridge/README.md?raw";
import settings from "../../../../public/plugins/vellum-bridge/settings.html?raw";
import style from "../../../../public/plugins/vellum-bridge/style.css?raw";
import { empty, bytes } from "@/lib/vellum/http";
import { textFile, zipStore } from "@/lib/vellum/zip";

export const Route = createFileRoute("/api/v1/plugin")({
  server: {
    handlers: {
      OPTIONS: () => empty(),
      GET: () => {
        const zip = zipStore([
          textFile("vellum-bridge/manifest.json", manifest),
          textFile("vellum-bridge/index.js", indexJs),
          textFile("vellum-bridge/style.css", style),
          textFile("vellum-bridge/settings.html", settings),
          textFile("vellum-bridge/README.md", readme),
        ]);
        return bytes(zip, "application/zip", "vellum-bridge.zip");
      },
    },
  },
});
