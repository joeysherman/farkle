import { createFileRoute } from "@tanstack/react-router";
import { Onboarding } from "../../pages/Onboarding";

export const Route = createFileRoute("/app/onboarding")({
	component: Onboarding,
	// validateSearch: (
	//   search: Record<string, unknown>
	// ): SearchParams => {
	//   const roomId = search['roomId'];
	//   return {
	//     roomId: typeof roomId === 'string' ? roomId : undefined,
	//   };
	// },
});
