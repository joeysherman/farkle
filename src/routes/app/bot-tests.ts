/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import BotTestResults from "../../pages/BotTestResults";

export const Route = createFileRoute("/app/bot-tests")({
	component: BotTestResults,
	beforeLoad: ({ context }) => {
		console.log("🛡️ Bot Tests guard: Checking access");
		console.log("🛡️ Bot Tests guard: Auth state", {
			isAuthChecking: context.auth.isAuthChecking,
			isAuthenticated: context.auth.isAuthenticated,
			onboardingCompleted: context.auth.profile?.onboarding_completed,
		});

		// If user is not authenticated, redirect to signin
		if (!context.auth.isAuthChecking && !context.auth.isAuthenticated) {
			console.log("🛡️ Bot Tests guard: User not authenticated - redirecting to signin");
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
			console.log("🛡️ Bot Tests guard: Onboarding not completed - redirecting to onboarding");
			console.log("🛡️ Bot Tests guard: Profile state:", context.auth.profile);
			throw redirect({
				to: "/app/onboarding",
			});
		}

		console.log("🛡️ Bot Tests guard: All checks passed - allowing access to bot tests");
	},
}); 