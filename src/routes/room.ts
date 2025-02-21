import { createFileRoute } from "@tanstack/react-router";
import { Room } from "../pages/Room";

export interface SearchParams {
	roomId?: string;
}

export const Route = createFileRoute("/room")({
	component: Room,
	// validateSearch: (
	//   search: Record<string, unknown>
	// ): SearchParams => {
	//   const roomId = search['roomId'];
	//   return {
	//     roomId: typeof roomId === 'string' ? roomId : undefined,
	//   };
	// },
});
