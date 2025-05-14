import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/layout/navbar/Navbar";
import * as React from "react";

import type { AuthContextType } from "../contexts/AuthContext";

interface MyRouterContext {
	auth: AuthContextType;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: () => (
		<div className="pt-12">
			<Navbar />
			<Outlet />
		</div>
	),
});
