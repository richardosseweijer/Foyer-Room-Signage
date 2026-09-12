import { createFileRoute } from "@tanstack/react-router";
import { ConfigApp } from "@/components/foyer/config/ConfigApp";

export const Route = createFileRoute("/config")({
  component: ConfigApp,
});
