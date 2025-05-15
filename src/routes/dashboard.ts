/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Dashboard } from "../pages/Dashboard";

export const Route = createFileRoute("/dashboard")({
	component: Dashboard,
	beforeLoad: ({ context }) => {
		
		if (!context.auth.isAuthChecking && !context.auth.isAuthenticated) {
			throw redirect({
				to: "/signin",
			});
		}
	  },
});
