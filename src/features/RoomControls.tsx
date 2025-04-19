import type { User } from "@supabase/supabase-js";
import { GameRoom } from "./Room";

// Room Controls Component
export const RoomControls: React.FC<{
	room: GameRoom;
	user: User | null;
	onStartGame: () => Promise<void>;
	onEndGame: () => Promise<void>;
	onShowInvite: () => void;
}> = ({ room, user, onStartGame, onEndGame, onShowInvite }) => {
	if (!user || room.created_by !== user.id) return null;

	return (
		<div className="flex flex-row gap-2 w-full">
			{room.current_players < room.max_players &&
				room?.status === "waiting" && (
					<button
						className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 border border-transparent text-base sm:text-sm font-medium rounded-xl sm:rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
						onClick={onShowInvite}
					>
						<svg
							className="h-5 w-5 sm:h-4 sm:w-4"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
						</svg>
						Invite Players
					</button>
				)}
			{room?.status === "waiting" && (
				<button
					className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 border border-transparent text-base sm:text-sm font-medium rounded-xl sm:rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
					onClick={onStartGame}
				>
					<svg
						className="h-5 w-5 sm:h-4 sm:w-4"
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							clipRule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
							fillRule="evenodd"
						/>
					</svg>
					Start Game
				</button>
			)}
			{room?.status === "in_progress" && (
				<button
					className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 border border-transparent text-base sm:text-sm font-medium rounded-xl sm:rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
					onClick={onEndGame}
				>
					<svg
						className="h-5 w-5 sm:h-4 sm:w-4"
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							clipRule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
							fillRule="evenodd"
						/>
					</svg>
					End Game
				</button>
			)}
		</div>
	);
};
