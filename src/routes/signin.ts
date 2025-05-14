/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Signin } from "../pages/Signin";

export const Route = createFileRoute("/signin")({
  component: Signin,
  beforeLoad: ({ context, location }) => {
    debugger;
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
}); 