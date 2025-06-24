import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Navbar } from "../../components/layout/navbar/Navbar";

export const Route = createFileRoute("/app")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<div className="min-h-screen pt-16">
			<Navbar />
			<main className="relative">
				<Outlet />
			</main>
		</div>
	);
}
