/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Home } from "../pages/Home";

export const Route = createFileRoute("/")({
	component: Home,
	beforeLoad: ({ context }) => {
		// If not checking auth and user is authenticated, redirect to dashboard
		if (!context.auth.isAuthChecking && context.auth.isAuthenticated) {
			throw redirect({
				to: "/app/dashboard",
			});
		}
		
		// If not checking auth and user is not authenticated, redirect to signin
		if (!context.auth.isAuthChecking && !context.auth.isAuthenticated) {
			throw redirect({
				to: "/signin",
			});
		}
	},
});
