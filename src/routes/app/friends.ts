import { createFileRoute } from "@tanstack/react-router";
import { Friends } from "../../pages/Friends";

export const Route = createFileRoute("/app/friends")({
  component: Friends,
}); 