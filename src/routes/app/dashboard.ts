/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Dashboard } from "../../pages/Dashboard";

export const Route = createFileRoute("/app/dashboard")({
	component: Dashboard,
	beforeLoad: ({ context }) => {
		// If user is not authenticated, redirect to signin
		if (!context.auth.isAuthChecking && !context.auth.isAuthenticated) {
			throw redirect({
				to: "/signin",
			});
		}

		// If user is authenticated but onboarding is not completed, redirect to onboarding
		if (
			!context.auth.isAuthChecking &&
			context.auth.isAuthenticated &&
			context.auth.profile &&
			!context.auth.profile.onboarding_completed
		) {
			throw redirect({
				to: "/app/onboarding",
			});
		}
	},
});
