/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Dashboard } from "../../pages/Dashboard";

export const Route = createFileRoute("/app/dashboard")({
	component: Dashboard,
	beforeLoad: ({ context }) => {
		console.log("🛡️ Dashboard guard: Checking access");
		console.log("🛡️ Dashboard guard: Auth state", {
			isAuthChecking: context.auth.isAuthChecking,
			isAuthenticated: context.auth.isAuthenticated,
			onboardingCompleted: context.auth.profile?.onboarding_completed,
		});

		// If user is not authenticated, redirect to signin
		if (!context.auth.isAuthChecking && !context.auth.isAuthenticated) {
			console.log("🛡️ Dashboard guard: User not authenticated - redirecting to signin");
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
			console.log("🛡️ Dashboard guard: Onboarding not completed - redirecting to onboarding");
			console.log("🛡️ Dashboard guard: Profile state:", context.auth.profile);
			throw redirect({
				to: "/app/onboarding",
			});
		}

		console.log("🛡️ Dashboard guard: All checks passed - allowing access to dashboard");
	},
});
