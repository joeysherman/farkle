import { createFileRoute } from "@tanstack/react-router";
import { Room } from "../pages/Room";

export const Route = createFileRoute("/room")({
  component: Room,
}); 