import { createFileRoute } from "@tanstack/react-router";
import { Signin } from "../pages/Signin";

export const Route = createFileRoute("/signin")({
  component: Signin,
}); 