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

// Create a function that returns a new router instance with the current auth context
const createRouterWithContext = (auth: ReturnType<typeof useAuth>) => {
	return createRouter({
		routeTree,
		context: {
			auth,
		},
	});
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createRouterWithContext>;
	}
}

export function App(): FunctionComponent {
	const auth = useAuth();
	const router = createRouterWithContext(auth);
	// if (auth.isAuthChecking) {
	// 	// add a loading spinner here using daisyui
	// 	// make purple
	// 	return (
	// 		<div className="flex h-screen items-center justify-center">
	// 			<div className="loading loading-spinner loading-lg text-indigo-600"></div>
	// 		</div>
	// 	);
	// }
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
