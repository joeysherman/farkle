import {
	createRootRouteWithContext,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { AuthProvider } from "../contexts/AuthContext";
import { Navbar } from "../components/layout/navbar/Navbar";
import * as React from "react";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import type { AuthContextType } from "../contexts/AuthContext";

interface MyRouterContext {
	auth: AuthContextType;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: () => (
		<div className="pt-12">
			{/* <Navbar /> */}
			<Outlet />
			<TanStackRouterDevtools position="bottom-right" initialIsOpen={false} />
		</div>
	),
	beforeLoad: ({ context, location }) => {
		// Skip auth check for auth-related routes and root
		if (
			location.pathname === "/signin" ||
			location.pathname === "/signup" ||
			location.pathname === "/"
		) {
			return;
		}

		// If user is not authenticated, redirect to signin
		if (!context.auth.isAuthChecking && !context.auth.isAuthenticated) {
			throw redirect({
				to: "/signin",
			});
		}
	},
});
