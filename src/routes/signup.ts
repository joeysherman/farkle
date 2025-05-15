import { createFileRoute, redirect } from "@tanstack/react-router";
import { Signup } from "../pages/Signup";

export const Route = createFileRoute("/signup")({
  component: Signup,
  beforeLoad: ({ context }) => {
    // If user is already authenticated, redirect to home
    if (context.auth.isAuthenticated) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
}); 