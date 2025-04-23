import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout(): JSX.Element {
	return (
		<AuthProvider>
			<RootContent />
		</AuthProvider>
	);
}

function RootContent(): JSX.Element {
	const { isAuthChecking } = useAuth();

	if (isAuthChecking) {
		return <div>Loading...root</div>;
	}

	return (
		<div>
			<Outlet />
		</div>
	);
}
