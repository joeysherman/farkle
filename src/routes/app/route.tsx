import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Navbar } from "../../components/layout/navbar/Navbar";

function AppLayout(): JSX.Element {
	return (
		<div className="h-screen overflow-hidden">
			<Navbar />
			<main className="bg-gradient-to-br from-primary/40 to-accent/40 h-[calc(100vh-64px)] sm:h-[calc(100vh-64px)] overflow-y-auto mt-16">
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createFileRoute("/app")({
	component: AppLayout,
});
