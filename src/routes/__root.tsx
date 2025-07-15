import {
	createRootRouteWithContext,
	Outlet,
	redirect,
} from "@tanstack/react-router";

import type { AuthContextType } from "../contexts/AuthContext.types";

interface MyRouterContext {
	auth: AuthContextType;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: () => <Outlet />,
	beforeLoad: ({ context, location }) => {
		console.log("🛡️ Root guard: Checking route", location.pathname);
		console.log("🛡️ Root guard: Auth state", {
			isAuthChecking: context.auth.isAuthChecking,
			isAuthenticated: context.auth.isAuthenticated,
			onboardingCompleted: context.auth.profile?.onboarding_completed,
		});

		// Skip auth check for auth-related routes and root
		if (
			location.pathname === "/signin" ||
			location.pathname === "/signup" ||
			location.pathname === "/"
		) {
			console.log("🛡️ Root guard: Skipping auth check for public route");
			return;
		}

		// If user is not authenticated, redirect to signin
		if (!context.auth.isAuthChecking && !context.auth.isAuthenticated) {
			console.log(
				"🛡️ Root guard: User not authenticated - redirecting to signin"
			);
			throw redirect({
				to: "/signin",
			});
		}
		// if the location is /app/onboarding, and the user is authenticated, and the profile is not completed, and the onboarding step is 3, then redirect to dashboard
		if (
			location.pathname === "/app/onboarding" &&
			context.auth.isAuthenticated &&
			context.auth.profile &&
			context.auth.profile.onboarding_completed
		) {
			console.log(
				"🛡️ Root guard: Onboarding completed - redirecting to dashboard"
			);
			throw redirect({
				to: "/app/dashboard",
			});
		}

		// Check onboarding status - redirect to onboarding if not completed
		if (
			!context.auth.isAuthChecking &&
			context.auth.isAuthenticated &&
			context.auth.profile &&
			!context.auth.profile.onboarding_completed &&
			location.pathname !== "/app/onboarding"
		) {
			console.log(
				"🛡️ Root guard: Onboarding not completed - redirecting to onboarding"
			);
			console.log("🛡️ Root guard: Profile state:", context.auth.profile);
			throw redirect({
				to: "/app/onboarding",
			});
		}

		console.log("🛡️ Root guard: All checks passed - allowing navigation");
	},
});
