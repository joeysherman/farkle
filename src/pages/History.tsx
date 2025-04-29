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

	// Helper function to parse duration string to minutes
	const parseDuration = (duration: string): number => {
		const days = duration.match(/(\d+) days?/);
		const timeMatch = duration.match(/(\d+):(\d+):(\d+)/);
		let totalMinutes = 0;

		if (days && days[1]) {
			totalMinutes += parseInt(days[1]) * 24 * 60;
		}

		if (timeMatch && timeMatch[1] && timeMatch[2]) {
			totalMinutes += parseInt(timeMatch[1]) * 60; // hours to minutes
			totalMinutes += parseInt(timeMatch[2]); // minutes
		}

		return totalMinutes;
	};

	// Format duration from interval to human-readable string
	const formatDuration = (duration: string | number): string => {
		if (typeof duration === "number") {
			// Convert minutes to days, hours, minutes
			const days = Math.floor(duration / (24 * 60));
			const hours = Math.floor((duration % (24 * 60)) / 60);
			const minutes = Math.floor(duration % 60);

			const parts = [];
			if (days > 0) parts.push(`${days}d`);
			if (hours > 0) parts.push(`${hours}h`);
			if (minutes > 0) parts.push(`${minutes}m`);
			return parts.join(" ") || "< 1m";
		}

		// Handle string duration (existing logic)
		const days = duration.match(/(\d+) days?/);
		const timeMatch = duration.match(/(\d+):(\d+):(\d+)/);
		const parts = [];

		if (days && days[1]) {
			parts.push(`${days[1]}d`);
		}

		if (timeMatch && timeMatch[1] && timeMatch[2]) {
			const hours = parseInt(timeMatch[1]);
			const minutes = parseInt(timeMatch[2]);
			if (hours > 0) parts.push(`${hours}h`);
			if (minutes > 0) parts.push(`${minutes}m`);
		}

		return parts.join(" ") || "< 1m";
	};

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
				totalGames: historyData.length,
				gamesWon: historyData.filter((game) => game.winner_id === user?.id)
					.length,
				// Calculate average duration
				averageDuration:
					historyData.length > 0
						? formatDuration(
								historyData.reduce(
									(accumulator, game) =>
										accumulator + parseDuration(game.duration),
									0
								) / historyData.length
							)
						: "0m",
				lastPlayed:
					historyData.length > 0
						? format(new Date(historyData[0].created_at), "MMM d, yyyy")
						: "Never",
			}
		: null;

	// Calculate win rate
	const winRate = userStats
		? userStats.totalGames > 0
			? ((userStats.gamesWon / userStats.totalGames) * 100).toFixed(1)
			: "0"
		: "0";

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-8">Game History</h1>

			{/* User Stats Summary */}
			{userStats && (
				<div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
					<h2 className="text-2xl font-bold mb-4 sm:mb-6">Your Statistics</h2>
					<div className="grid grid-cols-2 gap-3 sm:gap-4">
						{/* Primary Stats */}
						<div className="col-span-2 bg-indigo-50 rounded-lg p-4 sm:p-6">
							<div className="text-indigo-600 text-base sm:text-lg mb-1 sm:mb-2">
								Total Games
							</div>
							<div className="text-3xl sm:text-4xl font-bold">
								{userStats.totalGames}
							</div>
						</div>
						<div className="bg-green-50 rounded-lg p-4 sm:p-6">
							<div className="text-green-600 text-base sm:text-lg mb-1 sm:mb-2">
								Games Won
							</div>
							<div className="text-3xl sm:text-4xl font-bold">
								{userStats.gamesWon}
							</div>
						</div>
						<div className="bg-purple-50 rounded-lg p-4 sm:p-6">
							<div className="text-purple-600 text-base sm:text-lg mb-1 sm:mb-2">
								Win Rate
							</div>
							<div className="text-3xl sm:text-4xl font-bold">{winRate}%</div>
						</div>

						{/* Additional Stats */}
						<div className="bg-blue-50 rounded-lg p-4 sm:p-6">
							<div className="text-blue-600 text-base sm:text-lg mb-1 sm:mb-2">
								Avg Duration
							</div>
							<div className="text-xl sm:text-2xl font-bold">
								{userStats.averageDuration}
							</div>
						</div>
						<div className="bg-rose-50 rounded-lg p-4 sm:p-6">
							<div className="text-rose-600 text-base sm:text-lg mb-1 sm:mb-2">
								Last Played
							</div>
							<div className="text-xl sm:text-2xl font-bold">
								{userStats.lastPlayed}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Game History Cards */}
			<div className="bg-white rounded-lg shadow-md overflow-hidden">
				<h2 className="text-xl font-semibold p-6 border-b">Recent Games</h2>
				{isHistoryLoading ? (
					<div className="p-6 text-center">Loading game history...</div>
				) : historyData && historyData.length > 0 ? (
					<div className="p-4">
						<div className="grid grid-cols-1 gap-4">
							{historyData.map((game) => (
								<div
									key={game.id}
									className="bg-gray-50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
								>
									<div className="flex flex-col space-y-2">
										<div className="text-lg font-medium text-gray-900">
											{game.game_room?.name || "Unnamed Game"}
										</div>
										<div className="flex items-center space-x-2">
											<span className="text-sm text-gray-500">Winner:</span>
											<span
												className={`text-sm ${
													game.winner_id === user?.id
														? "font-bold text-indigo-600"
														: "text-gray-900"
												}`}
											>
												{game.winner?.username || "Unknown"}
												{game.winner_id === user?.id && " (You)"}
											</span>
										</div>
										<div className="flex items-center space-x-2">
											<span className="text-sm text-gray-500">Duration:</span>
											<span className="text-sm text-gray-900">
												{formatDuration(game.duration)}
											</span>
										</div>
										<div className="flex items-center space-x-2">
											<span className="text-sm text-gray-500">Date:</span>
											<span className="text-sm text-gray-900">
												{format(new Date(game.created_at), "MMM d, yyyy")}
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
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
