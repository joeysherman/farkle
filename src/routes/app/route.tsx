import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Navbar } from "../../components/layout/navbar/Navbar";

function AppLayout(): JSX.Element {
	return (
		<div className="min-h-screen">
			<Navbar />
			<main className="pt-12 sm:pt-16">
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createFileRoute("/app")({
	component: AppLayout,
});
