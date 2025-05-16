import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "../../pages/Profile";

export const Route = createFileRoute("/app/profile")({
	component: Profile,
	// validateSearch: (
	//   search: Record<string, unknown>
	// ): SearchParams => {
	//   const roomId = search['roomId'];
	//   return {
	//     roomId: typeof roomId === 'string' ? roomId : undefined,
	//   };
	// },
});
