import { createFileRoute } from "@tanstack/react-router";
import { BridgeApp } from "@/components/bridge/app";

export const Route = createFileRoute("/")({ component: BridgeApp });
