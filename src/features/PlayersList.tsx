import type { User } from "@supabase/supabase-js";
import { GamePlayer, GameState, GameRoom } from "../pages/Room";

// Players List Component
export const PlayersList: React.FC<{
	players: Array<GamePlayer>;
	gameState: GameState | null;
	user: User | null;
	room: GameRoom;
}> = ({ players, gameState, user, room }) => {
	return (
		<div className="space-y-3">
			{players.map((player) => {
				const isCurrentTurn = gameState?.current_player_id === player.id;
				const isCurrentUser = player.user_id === user?.id;

				return (
					<PlayerListItem
						key={player.id}
						player={player}
						isCurrentTurn={isCurrentTurn}
						isCurrentUser={isCurrentUser}
					/>
				);
			})}

			{room?.status === "waiting" &&
				Array.from({ length: room.max_players - players.length }).map(
					(_, index) => (
						<EmptyPlayerSlot
							key={`empty-${index}`}
							slotNumber={players.length + index + 1}
						/>
					)
				)}
		</div>
	);
}; // Player List Item Component

export const PlayerListItem: React.FC<{
	player: GamePlayer;
	isCurrentTurn: boolean;
	isCurrentUser: boolean;
}> = ({ player, isCurrentTurn, isCurrentUser }) => {
	return (
		<div
			key={player.id}
			className={`relative rounded-lg border ${
				isCurrentTurn
					? "border-indigo-500 bg-indigo-50"
					: isCurrentUser
						? "border-green-500 bg-green-50"
						: "border-gray-300 bg-white"
			} p-3 shadow-sm transition-colors duration-200`}
			style={{
				animation: isCurrentTurn ? "softPulse 2s infinite" : "none",
			}}
		>
			<div className="flex items-center gap-3">
				<div className="flex-shrink-0">
					<div
						className={`w-10 h-10 rounded-full ${
							isCurrentTurn
								? "bg-indigo-200"
								: isCurrentUser
									? "bg-green-200"
									: "bg-gray-200"
						} flex items-center justify-center`}
					>
						<span
							className={`font-medium ${
								isCurrentTurn
									? "text-indigo-900"
									: isCurrentUser
										? "text-green-900"
										: "text-gray-900"
							}`}
						>
							P{player.player_order}
						</span>
					</div>
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap gap-2">
						<p className="text-sm font-medium text-gray-900 truncate">
							{isCurrentUser ? "You" : player.username}
						</p>
					</div>
					<div className="mt-1 flex items-center justify-between">
						<p className="text-sm text-gray-500">
							Score: <span className="font-medium">{player.score}</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
// Empty Player Slot Component

export const EmptyPlayerSlot: React.FC<{ slotNumber: number }> = ({
	slotNumber,
}) => (
	<div className="relative rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 shadow-sm">
		<div className="flex items-center gap-3">
			<div className="flex-shrink-0">
				<div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
					<span className="text-gray-400 font-medium">{slotNumber}</span>
				</div>
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-sm text-gray-500">Waiting for player...</p>
			</div>
		</div>
	</div>
);
