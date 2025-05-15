/* eslint-disable @typescript-eslint/only-throw-error */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Home } from "../pages/Home";

export const Route = createFileRoute("/")({
	component: Home,
	beforeLoad: ({ context }) => {
		debugger;
		if (!context.auth.isAuthChecking && !context.auth.isAuthenticated) {
			throw redirect({
				to: "/signin",
			});
		}
	  },
});
