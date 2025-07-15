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

// Loading spinner component
function LoadingSpinner(): JSX.Element {
	return (
		<div className="flex justify-center items-center">
			<div className="loading loading-spinner loading-lg text-accent"></div>
		</div>
	);
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
		<div className="container mx-auto pt-6">
			{/* User Stats Summary */}
			{userStats && (
				<div className="card bg-base-100 shadow-md ring-1 ring-base-300">
					<div className="card-body">
						<h2 className="card-title text-2xl mb-6 text-neutral">
							Your Statistics
						</h2>
						<div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
							{/* Primary Stats */}
							<div className="col-span-2 lg:col-span-1 stat bg-base-200 rounded-lg">
								<div className="stat-title text-base-content/70">
									Total Games
								</div>
								<div className="stat-value text-accent text-3xl">
									{userStats.totalGames}
								</div>
							</div>

							<div className="stat bg-base-200 rounded-lg">
								<div className="stat-title text-base-content/70">Games Won</div>
								<div className="stat-value text-success text-3xl">
									{userStats.gamesWon}
								</div>
							</div>

							<div className="stat bg-base-200 rounded-lg">
								<div className="stat-title text-base-content/70">Win Rate</div>
								<div className="stat-value text-secondary text-3xl">
									{winRate}%
								</div>
							</div>

							{/* Additional Stats */}
							<div className="stat bg-base-200 rounded-lg">
								<div className="stat-title text-base-content/70">
									Avg Duration
								</div>
								<div className="stat-value text-info text-2xl">
									{userStats.averageDuration}
								</div>
							</div>

							<div className="stat bg-base-200 rounded-lg">
								<div className="stat-title text-base-content/70">
									Last Played
								</div>
								<div className="stat-value text-accent text-2xl">
									{userStats.lastPlayed}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Game History Cards */}
			<div className="card bg-base-100 shadow-md ring-1 ring-base-300 mt-6">
				<div className="card-body">
					<h2 className="card-title text-2xl mb-4 text-neutral">
						Game History
					</h2>
					{isHistoryLoading ? (
						<div className="flex justify-center items-center py-12">
							<LoadingSpinner />
						</div>
					) : historyData && historyData.length > 0 ? (
						<div className="space-y-2">
							{historyData.map((game) => (
								<div
									key={game.id}
									className="collapse collapse-arrow bg-base-200 hover:bg-base-300 transition-all duration-200"
								>
									<input className="peer" type="checkbox" />
									<div className="collapse-title">
										<div className="grid grid-cols-12 items-center gap-2">
											<div className="col-span-4">
												<span className="font-medium text-base-content">
													{game.game_room?.name || "Unnamed Game"}
												</span>
											</div>
											<div className="col-span-4 text-center">
												<div
													className={`badge ${game.winner_id === user?.id ? "badge-accent" : "badge-neutral"}`}
												>
													{game.winner?.username || "Unknown"}
													{game.winner_id === user?.id && " (You)"}
												</div>
											</div>
											<div className="col-span-4 text-base-content/70 text-right">
												{format(new Date(game.created_at), "MMM d, yyyy")}
											</div>
										</div>
									</div>
									<div className="collapse-content bg-base-300/50">
										<div className="py-4">
											<div className="grid grid-cols-2 gap-4">
												<div>
													<div className="text-sm text-base-content/70">
														Duration
													</div>
													<div className="font-medium text-base-content">
														{formatDuration(game.duration)}
													</div>
												</div>
												{/* Additional details can be added here later */}
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-12">
							<div className="text-6xl mb-4">🎲</div>
							<h3 className="text-lg font-medium text-neutral mb-2">
								No game history found
							</h3>
							<p className="text-slate-500">
								Play some games to see your history here!
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
