import { createFileRoute } from "@tanstack/react-router";
import { Player } from "@/components/foyer/player/Player";

export const Route = createFileRoute("/play/$displayId")({
  component: PlayPage,
});

function PlayPage() {
  const { displayId } = Route.useParams();
  return <Player displayId={displayId} />;
}
