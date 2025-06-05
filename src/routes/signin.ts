/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Signin } from "../pages/Signin";

export const Route = createFileRoute("/signin")({
  component: Signin,
  beforeLoad: ({ context }) => {
    // If user is already authenticated, check onboarding status
    if (!context.auth.isAuthChecking && context.auth.isAuthenticated) {
      // If onboarding not completed, redirect to onboarding
      if (context.auth.profile && !context.auth.profile.onboarding_completed) {
        throw redirect({
          to: "/app/onboarding",
        });
      }
      // Otherwise redirect to dashboard
      throw redirect({
        to: "/app/dashboard",
      });
    }
  },
}); 