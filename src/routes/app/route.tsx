import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Navbar } from "../../components/layout/navbar/Navbar";

export const Route = createFileRoute("/app")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<div className="flex flex-col h-screen pt-16">
			<Navbar />
			<div className="flex-1 overflow-auto">
				<Outlet />
			</div>
		</div>
	);
}
