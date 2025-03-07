import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/rooms/$roomId")({
	component: RoomComponent,
});

function RoomComponent() {
	const { roomId } = Route.useParams();

	useEffect(() => {
		console.log("roomId", roomId);
	}, []);

	return <div>Room {roomId}</div>;
}
