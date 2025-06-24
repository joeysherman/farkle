import { createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen.ts";
import "./styles/tailwind.css";
import "./common/i18n";
//import "./registerSW";
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

const getLoadingMessage = (loadingState: string): string => {
	switch (loadingState) {
		case "initializing":
			return "Starting up...";
		case "signing-in":
			return "Signing you in...";
		case "signing-out":
			return "Signing you out...";
		case "fetching-profile":
			return "Loading your profile...";
		case "updating-profile":
			return "Updating your profile...";
		default:
			return "Loading...";
	}
};

export function App(): FunctionComponent {
	const auth = useAuth();
	if (auth.isAuthChecking) {
		return (
			<div className="flex h-screen items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="loading loading-spinner loading-lg text-indigo-600 mb-4"></div>
					<p className="text-gray-600 font-medium">
						{getLoadingMessage(auth.loadingState)}
					</p>
				</div>
			</div>
		);
	}
	return <RouterProvider context={{ auth }} router={router} />;
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
