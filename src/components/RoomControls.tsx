import { Room, User } from "@/types";
import { Button } from "./ui/button";

interface RoomControlsProps {
	room: Room;
	user: User;
	onStartGame: () => void;
	onEndGame: () => void;
	onShowInvite: () => void;
}

export function RoomControls({
	room,
	user,
	onStartGame,
	onEndGame,
	onShowInvite,
}: RoomControlsProps) {
	const isHost = room.host_id === user.id;
	const canStartGame = isHost && room.status === "waiting";
	const canEndGame = isHost && room.status === "in_progress";

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-2">
				{canStartGame && (
					<Button
						onClick={onStartGame}
						size="lg"
						className="flex-1 min-w-[120px] text-lg font-medium"
					>
						Start Game
					</Button>
				)}
				{canEndGame && (
					<Button
						onClick={onEndGame}
						variant="destructive"
						size="lg"
						className="flex-1 min-w-[120px] text-lg font-medium"
					>
						End Game
					</Button>
				)}
				<Button
					onClick={onShowInvite}
					variant="outline"
					size="lg"
					className="flex-1 min-w-[120px] text-lg font-medium"
				>
					Invite Players
				</Button>
			</div>
			<div className="text-center text-sm text-muted-foreground">
				Room Code: <span className="font-mono font-bold">{room.id}</span>
			</div>
		</div>
	);
}
