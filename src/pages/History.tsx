import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface GameHistory {
	id: string;
	game_room_id: string;
	winner_id: string;
	final_scores: Record<string, number>;
	duration: string;
	created_at: string;
	game_room: {
		name: string;
		created_at: string;
	};
	winner: {
		username: string;
	};
}

export default function History(): JSX.Element {
	const { user } = useAuth();

	// Fetch game history data
	const { data: historyData, isLoading: isHistoryLoading } = useQuery({
		queryKey: ["gameHistory"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("game_history")
				.select(
					`
          id,
          game_room_id,
          winner_id,
          final_scores,
          duration,
          created_at,
          game_room:game_rooms(name, created_at),
          winner:profiles!winner_id(username)
        `
				)
				.order("created_at", { ascending: false });

			if (error) {
				throw error;
			}

			return data as Array<GameHistory>;
		},
		enabled: !!user,
	});

	// Calculate statistics from game history
	const userStats = historyData
		? {
				total_games: historyData.length,
				games_won: historyData.filter((game) => game.winner_id === user?.id)
					.length,
			}
		: null;

	// Calculate win rate
	const winRate = userStats
		? userStats.total_games > 0
			? ((userStats.games_won / userStats.total_games) * 100).toFixed(1)
			: "0"
		: "0";

	// Format duration from interval to human-readable string
	const formatDuration = (duration: string): string => {
		// Parse the interval string (e.g., "4 days 22:32:10.577723")
		const days = duration.match(/(\d+) days?/);
		const timeMatch = duration.match(/(\d+):(\d+):(\d+)/);

		const parts = [];

		if (days) {
			parts.push(`${days[1]}d`);
		}

		if (timeMatch) {
			const [, hours, minutes] = timeMatch;
			if (parseInt(hours) > 0) {
				parts.push(`${parseInt(hours)}h`);
			}
			if (parseInt(minutes) > 0) {
				parts.push(`${parseInt(minutes)}m`);
			}
		}

		return parts.join(" ") || "< 1m";
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-8">Game History</h1>

			{/* User Stats Summary */}
			{userStats && (
				<div className="bg-white rounded-lg shadow-md p-6 mb-8">
					<h2 className="text-xl font-semibold mb-4">Your Statistics</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-indigo-50 p-4 rounded-lg">
							<p className="text-sm text-indigo-600">Total Games</p>
							<p className="text-2xl font-bold">{userStats.total_games}</p>
						</div>
						<div className="bg-green-50 p-4 rounded-lg">
							<p className="text-sm text-green-600">Games Won</p>
							<p className="text-2xl font-bold">{userStats.games_won}</p>
						</div>
						<div className="bg-purple-50 p-4 rounded-lg">
							<p className="text-sm text-purple-600">Win Rate</p>
							<p className="text-2xl font-bold">{winRate}%</p>
						</div>
					</div>
				</div>
			)}

			{/* Game History Table */}
			<div className="bg-white rounded-lg shadow-md overflow-hidden">
				<h2 className="text-xl font-semibold p-6 border-b">Recent Games</h2>
				{isHistoryLoading ? (
					<div className="p-6 text-center">Loading game history...</div>
				) : historyData && historyData.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Game
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Winner
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Duration
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Date
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{historyData.map((game) => (
									<tr key={game.id} className="hover:bg-gray-50">
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm font-medium text-gray-900">
												{game.game_room?.name || "Unnamed Game"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div
												className={`text-sm ${game.winner_id === user?.id ? "font-bold text-indigo-600" : "text-gray-900"}`}
											>
												{game.winner?.username || "Unknown"}
												{game.winner_id === user?.id && " (You)"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-900">
												{formatDuration(game.duration)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-900">
												{format(new Date(game.created_at), "MMM d, yyyy")}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<div className="p-6 text-center text-gray-500">
						No game history found. Play some games to see your history here!
					</div>
				)}
			</div>
		</div>
	);
}
