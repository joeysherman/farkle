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
			className={`p-2.5 rounded-lg ${
				isCurrentTurn ? "bg-green-100 border-green-200" : "bg-white"
			} border transition-colors duration-200 relative overflow-hidden`}
		>
			{isCurrentTurn && (
				<div className="absolute right-0 top-0">
					<div className="transform rotate-45 translate-y-[-50%] translate-x-[50%] bg-green-500 text-white px-8 py-1 text-xs">
						Turn
					</div>
				</div>
			)}
			<div className="flex items-center space-x-2.5">
				<div className="relative flex-shrink-0">
					<img
						alt={`${userData.username}'s avatar`}
						className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
						src={`/avatars/${userData.avatar_name || "default"}.svg`}
					/>
					<div
						className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-white ${
							isOnline ? "bg-green-500" : "bg-gray-300"
						}`}
					/>
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5">
						<p
							className={`text-sm font-medium ${
								isCurrentUser
									? "text-indigo-600"
									: isCurrentTurn
										? "text-green-800"
										: "text-gray-900"
							} truncate`}
						>
							{userData.username}
							{isCurrentUser && (
								<span className="ml-1 text-xs text-gray-500">(You)</span>
							)}
						</p>
					</div>
					<p className="text-xs sm:text-sm text-gray-500">
						Score: {player.score}
					</p>
				</div>
				{isCurrentTurn && (
					<div className="hidden sm:block">
						<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
							Current
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
	console.log("PlayersList", { players, gameState, user, room, onlineUsers });
	return (
		<div className="space-y-3">
			{players.map((player) => {
				const isCurrentTurn = gameState?.current_player_id === player.id;
				const isCurrentUser = player.user_id === user?.id;
				const isOnline = Boolean(onlineUsers[player.user_id]);
				debugger;
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

			{room &&
				room?.status === "waiting" &&
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
