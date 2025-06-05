/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Signin } from "../pages/Signin";

export const Route = createFileRoute("/signin")({
  component: Signin,
  beforeLoad: ({ context }) => {
    // If user is already authenticated, redirect to dashboard
    if (!context.auth.isAuthChecking && context.auth.isAuthenticated) {
      throw redirect({
        to: "/app/dashboard",
      });
    }
  },
}); 