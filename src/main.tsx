import { createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen.ts";
import "./styles/tailwind.css";
import "./common/i18n";
import "./registerSW";
import { AuthProvider, useAuth } from "./contexts/AuthContext.tsx";
import type { FunctionComponent } from "./common/types";
import { Toaster } from "react-hot-toast";
import { NotificationProvider } from "./contexts/NotificationContext.tsx";

const queryClient = new QueryClient();

const router = createRouter({
	routeTree,
	context: {
		auth: undefined!, // This will be set after we wrap the app in an AuthProvider
	},
});

declare module "@tanstack/react-router" {
	interface Register {
		// This infers the type of our router and registers it across your entire project
		router: typeof router;
	}
}

export function App(): FunctionComponent {
	const auth = useAuth();
	if (auth.isAuthChecking) {
		// add a loading spinner here using daisyui
		// make purple
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="loading loading-spinner loading-lg text-indigo-600"></div>
			</div>
		);
	}
	return <RouterProvider router={router} context={{ auth }} />;
}

export function Wrapper(): FunctionComponent {
	return (
		<AuthProvider>
			<QueryClientProvider client={queryClient}>
				<NotificationProvider>
					<App />
					<Toaster position="bottom-center" />
				</NotificationProvider>
			</QueryClientProvider>
		</AuthProvider>
	);
}

const rootElement = document.querySelector("#root") as Element;

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<React.StrictMode>
			<Wrapper />
		</React.StrictMode>
	);
}
