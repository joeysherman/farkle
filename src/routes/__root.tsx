import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/layout/navbar/Navbar";
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
	const { isAuthChecking, user } = useAuth();

	if (isAuthChecking && !user) {
		return <div>Loading...root</div>;
	}

	return (
		<div className="min-h-dvh bg-gray-100 overflow-hidden bg-red-500">
			<Navbar />
			<div className="pt-12 sm:pt-16">
				<Outlet />
			</div>
		</div>
	);
}
