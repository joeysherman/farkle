import type { User } from "@supabase/supabase-js";
import { useUser } from "../services/user";
import { GamePlayer, GameState, GameRoom } from "../pages/Room";

interface PlayerListItemProps {
	player: GamePlayer;
	isCurrentTurn: boolean;
	isCurrentUser: boolean;
	isOnline?: boolean;
}

const PlayerListItem: React.FC<PlayerListItemProps> = ({
	player,
	isCurrentTurn,
	isCurrentUser,
	isOnline = false,
}) => {
	const { data: userData } = useUser(player.user_id);

	if (!userData) return null;

	return (
		<div
			className={`p-3 rounded-lg ${
				isCurrentTurn
					? "bg-indigo-50 border border-indigo-100"
					: "bg-white border"
			}`}
		>
			<div className="flex items-center space-x-3">
				<div className="relative">
					<img
						alt={`${userData.username}'s avatar`}
						className="w-10 h-10 rounded-full"
						src={`/avatars/${userData.avatar_name || "default"}.svg`}
					/>
					{isOnline && (
						<div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
					)}
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<p
							className={`text-sm font-medium ${
								isCurrentUser ? "text-indigo-600" : "text-gray-900"
							} truncate`}
						>
							{userData.username}
							{isCurrentUser && (
								<span className="ml-1.5 text-xs text-gray-500">(You)</span>
							)}
						</p>
					</div>
					<p className="text-sm text-gray-500">Score: {player.score}</p>
				</div>
				{isCurrentTurn && (
					<div className="flex-shrink-0">
						<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
							Current Turn
						</span>
					</div>
				)}
			</div>
		</div>
	);
};

const EmptyPlayerSlot: React.FC<{ slotNumber: number }> = ({ slotNumber }) => (
	<div className="p-3 rounded-lg bg-gray-50 border border-dashed border-gray-200">
		<div className="flex items-center space-x-3">
			<div className="w-10 h-10 rounded-full bg-gray-200" />
			<div className="flex-1">
				<p className="text-sm text-gray-400">Waiting for Player {slotNumber}</p>
			</div>
		</div>
	</div>
);

// Players List Component
export const PlayersList: React.FC<{
	players: Array<GamePlayer>;
	gameState: GameState | null;
	user: User | null;
	room: GameRoom;
	onlineUsers: Record<string, any>;
}> = ({ players, gameState, user, room, onlineUsers }) => {
	return (
		<div className="space-y-3">
			{players.map((player) => {
				const isCurrentTurn = gameState?.current_player_id === player.id;
				const isCurrentUser = player.user_id === user?.id;
				const isOnline = Boolean(onlineUsers[player.user_id]);

				return (
					<PlayerListItem
						key={player.id}
						player={player}
						isCurrentTurn={isCurrentTurn}
						isCurrentUser={isCurrentUser}
						isOnline={isOnline}
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
};
