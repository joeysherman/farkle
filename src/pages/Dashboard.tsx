import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { FunctionComponent } from "../common/types";
import { supabase } from "../lib/supabaseClient";
import { nanoid } from "nanoid";
import { generateRoomName } from "../utils/roomNames";
import { GameInvites } from "../features/GameInvites";
import { useAuth } from "../contexts/AuthContext";

interface GameRoom {
	id: string;
	name: string;
	created_by: string;
	max_players: number;
	current_players: number;
	status: "waiting" | "in_progress" | "completed";
	invite_code: string;
}

interface UserStats {
	totalGames: number;
	gamesWon: number;
	winRate: string;
	currentStreak: number;
}

// Loading spinner component
function LoadingSpinner(): JSX.Element {
	return (
		<div className="flex justify-center items-center">
			<div className="loading loading-spinner loading-lg text-primary"></div>
		</div>
	);
}

export const Dashboard = (): FunctionComponent => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);
	const [joinCodeLoading, setJoinCodeLoading] = useState(false);
	const [joinCode, setJoinCode] = useState("");
	const { isAuthChecking, user } = useAuth();
	const [availableRooms, setAvailableRooms] = useState<Array<GameRoom> | null>(
		null
	);
	const [currentRooms, setCurrentRooms] = useState<Array<GameRoom> | null>(
		null
	);
	const [userStats, setUserStats] = useState<UserStats | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		const fetchDashboardData = async (): Promise<void> => {
			if (!user) return;

			try {
				// Fetch current rooms
				const { data: playerRooms } = await supabase
					.from("game_players")
					.select("game_id, game_rooms(*)")
					.not("game_rooms.status", "eq", "completed")
					.not("game_rooms", "is", null)
					.eq("user_id", user.id)
					.eq("is_joined", true);

				// Fetch available rooms
				const { data: waitingRooms } = await supabase
					.from("game_rooms")
					.select("*")
					.in("status", ["waiting"])
					.order("created_at", { ascending: false });

				// Fetch user stats
				const { data: statsData } = await supabase
					.from("game_history")
					.select("winner_id")
					.or(`winner_id.eq.${user.id},final_scores.cs.{"${user.id}"}`);

				if (waitingRooms) {
					if (playerRooms && playerRooms.length > 0) {
						const filteredRooms = waitingRooms.filter(
							(room) =>
								!playerRooms.some(
									(playerRoom) => (playerRoom.game_rooms as any)?.id === room.id
								)
						);
						setAvailableRooms(filteredRooms);
					} else {
						setAvailableRooms(waitingRooms);
					}
				}

				if (playerRooms) {
					setCurrentRooms(
						playerRooms
							.map((item) => item.game_rooms as unknown as GameRoom)
							.filter(Boolean)
					);
				}

				// Calculate user stats
				if (statsData) {
					const totalGames = statsData.length;
					const gamesWon = statsData.filter(
						(game) => game.winner_id === user.id
					).length;
					const winRate =
						totalGames > 0 ? ((gamesWon / totalGames) * 100).toFixed(1) : "0";

					setUserStats({
						totalGames,
						gamesWon,
						winRate,
						currentStreak: 0, // TODO: Calculate actual streak
					});
				}
			} catch (error) {
				console.error("Error fetching dashboard data:", error);
			}
		};

		if (!isAuthChecking && user) {
			void fetchDashboardData();
		}
	}, [isAuthChecking, user]);

	const handleCreateRoom = async (): Promise<void> => {
		try {
			setLoading(true);
			setError("");
			const {
				data: { user: currentUser },
			} = await supabase.auth.getUser();
			if (!currentUser) return;

			// First, check if user profile exists
			const { data: profile } = await supabase
				.from("profiles")
				.select("id")
				.eq("id", currentUser.id)
				.single();

			// If profile doesn't exist, create it
			if (!profile) {
				const { error: profileError } = await supabase.from("profiles").insert([
					{
						id: currentUser.id,
						username: currentUser.email?.split("@")[0] || `player_${nanoid(4)}`,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				]);

				if (profileError) throw profileError;
			}

			const roomName = generateRoomName();

			// Use create_room RPC function
			const { data: roomId, error: createRoomError } = await supabase.rpc(
				"create_room",
				{
					p_name: roomName,
				}
			);

			if (createRoomError) throw createRoomError;
			if (!roomId) throw new Error("No room ID returned");

			// Navigate to the room page
			void navigate({ to: "/app/room", search: { roomId: roomId as string } });
		} catch (error) {
			console.error("Error creating room:", error);
			setError("Failed to create room. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleJoinByCode = async (): Promise<void> => {
		if (!joinCode.trim()) return;

		try {
			setJoinCodeLoading(true);
			setError("");

			// Find room by invite code
			const { data: room, error: roomError } = await supabase
				.from("game_rooms")
				.select("id")
				.eq("invite_code", joinCode.trim())
				.eq("status", "waiting")
				.single();

			if (roomError || !room) {
				setError("Invalid or expired game code.");
				return;
			}

			// Navigate to the room
			void navigate({ to: "/app/room", search: { roomId: room.id } });
		} catch (error) {
			console.error("Error joining by code:", error);
			setError("Failed to join game. Please try again.");
		} finally {
			setJoinCodeLoading(false);
		}
	};

	const handleEndGame = async (roomId: string): Promise<void> => {
		try {
			const { error } = await supabase.rpc("end_game", {
				p_game_id: roomId,
			});

			setCurrentRooms(
				currentRooms?.filter((room) => room.id !== roomId) || null
			);

			if (error) {
				console.error("End game error:", error);
				setError("Failed to end game. Please try again.");
			}
		} catch (error_) {
			console.error("End game error:", error_);
			setError(
				error_ instanceof Error
					? error_.message
					: "Failed to end game. Please try again."
			);
		}
	};

	if (isAuthChecking) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
				<LoadingSpinner />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 p-4 py-8">
			<div className="container mx-auto max-w-7xl">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-base-content mb-2">
						Welcome back!
					</h1>
					<p className="text-base-content/70 text-lg">
						Ready to roll some dice?
					</p>
				</div>

				{/* Error Alert */}
				{error && (
					<div className="alert alert-error mb-6">
						<svg
							className="stroke-current shrink-0 h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
							/>
						</svg>
						<span>{error}</span>
						<button
							className="btn btn-sm btn-circle btn-ghost"
							onClick={() => {
								setError("");
							}}
						>
							<svg
								className="h-4 w-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M6 18L18 6M6 6l12 12"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
								/>
							</svg>
						</button>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left Column - Primary Actions and Active Games */}
					<div className="lg:col-span-2 space-y-6">
						{/* Quick Actions Card */}
						<div className="card bg-base-100 shadow-2xl">
							<div className="card-body">
								<h2 className="card-title text-2xl mb-4">Quick Actions</h2>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<button
										disabled={loading}
										className="btn btn-primary w-full"
										onClick={handleCreateRoom}
									>
										{loading ? <LoadingSpinner /> : "🎲 Create New Game"}
									</button>

									<div className="flex space-x-2">
										<input
											type="text"
											placeholder="Enter game code"
											value={joinCode}
											onChange={(e) => setJoinCode(e.target.value)}
											className="input input-bordered input-primary flex-1"
											onKeyPress={(e) =>
												e.key === "Enter" && handleJoinByCode()
											}
										/>
										<button
											disabled={joinCodeLoading || !joinCode.trim()}
											className="btn btn-primary"
											onClick={handleJoinByCode}
										>
											{joinCodeLoading ? <LoadingSpinner /> : "Join"}
										</button>
									</div>
								</div>
							</div>
						</div>

						{/* Active Games */}
						<div className="card bg-base-100 shadow-2xl">
							<div className="card-body">
								<div className="flex items-center gap-3 mb-6">
									<h2 className="card-title text-2xl">Your Active Games</h2>
									{currentRooms && currentRooms.length > 0 && (
										<div className="badge badge-primary">
											{currentRooms.length}
										</div>
									)}
								</div>

								<div className="space-y-4">
									{currentRooms &&
										currentRooms.length > 0 &&
										currentRooms.map((room) => (
											<div
												key={room.id}
												className="p-4 bg-base-200 rounded-lg border border-base-300 hover:border-primary/50 transition-colors"
											>
												<div className="flex justify-between items-start mb-3">
													<h3 className="text-lg font-bold">{room.name}</h3>
													<div
														className={`badge ${
															room?.status === "waiting"
																? "badge-warning"
																: "badge-success"
														}`}
													>
														{room?.status === "waiting"
															? "⏳ Waiting"
															: "🎲 In Progress"}
													</div>
												</div>

												<div className="flex justify-between items-center mb-4">
													<div className="flex items-center space-x-4 text-sm">
														<span className="text-base-content/70">
															👤{" "}
															{room.created_by === user?.id ? "You" : "Friend"}
														</span>
														<span className="text-primary font-bold">
															👥 {room.current_players}/{room.max_players}
														</span>
													</div>
												</div>

												<div className="flex justify-end gap-3">
													<button
														className="btn btn-primary btn-sm"
														onClick={() =>
															navigate({
																to: "/app/room",
																search: { roomId: room.id },
															})
														}
													>
														Continue
													</button>
													{user &&
														room.created_by === user.id &&
														room?.status === "in_progress" && (
															<button
																className="btn btn-error btn-sm"
																onClick={() => handleEndGame(room.id)}
															>
																End
															</button>
														)}
												</div>
											</div>
										))}

									{currentRooms === null && (
										<div className="space-y-4">
											{[1, 2].map((index) => (
												<div
													key={index}
													className="skeleton h-24 w-full bg-base-200 rounded-lg"
												></div>
											))}
										</div>
									)}

									{currentRooms && currentRooms.length === 0 && (
										<div className="text-center py-8">
											<div className="text-4xl mb-3">🎲</div>
											<h3 className="text-lg font-medium mb-2">
												No active games
											</h3>
											<p className="text-base-content/70">
												Create a new game to get started!
											</p>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Available Games */}
						<div className="card bg-base-100 shadow-2xl">
							<div className="card-body">
								<div className="flex items-center gap-3 mb-6">
									<h2 className="card-title text-2xl">Available Games</h2>
									{availableRooms && availableRooms.length > 0 && (
										<div className="badge badge-success">
											{availableRooms.length}
										</div>
									)}
								</div>

								<div className="space-y-4">
									{availableRooms &&
										availableRooms.length > 0 &&
										availableRooms.slice(0, 3).map((room) => (
											<div
												key={room.id}
												className="p-4 bg-base-200 rounded-lg border border-base-300 hover:border-success/50 transition-colors"
											>
												<div className="flex justify-between items-center">
													<div>
														<h3 className="text-lg font-bold mb-1">
															{room.name}
														</h3>
														<span className="text-success font-medium text-sm">
															👥 {room.current_players}/{room.max_players}{" "}
															players
														</span>
													</div>
													<button
														className="btn btn-success btn-sm"
														onClick={() =>
															navigate({
																to: "/app/room",
																search: { roomId: room.id },
															})
														}
													>
														🚀 Join
													</button>
												</div>
											</div>
										))}

									{availableRooms === null && (
										<div className="space-y-4">
											{[1, 2].map((index) => (
												<div
													key={index}
													className="skeleton h-20 w-full bg-base-200 rounded-lg"
												></div>
											))}
										</div>
									)}

									{availableRooms && availableRooms.length === 0 && (
										<div className="text-center py-8">
											<div className="text-4xl mb-3">🎯</div>
											<h3 className="text-lg font-medium mb-2">
												No games available
											</h3>
											<p className="text-base-content/70">
												Be the first to create a game!
											</p>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Right Column - Secondary Info */}
					<div className="space-y-6">
						{/* Player Stats */}
						{userStats && (
							<div className="card bg-base-100 shadow-2xl">
								<div className="card-body">
									<h2 className="card-title text-xl mb-4">Your Stats</h2>

									<div className="space-y-4">
										<div className="stat bg-base-200 rounded-lg p-4">
											<div className="stat-title text-base-content/70 text-sm">
												Total Games
											</div>
											<div className="stat-value text-primary text-2xl font-bold">
												{userStats.totalGames}
											</div>
										</div>

										<div className="stat bg-base-200 rounded-lg p-4">
											<div className="stat-title text-base-content/70 text-sm">
												Games Won
											</div>
											<div className="stat-value text-success text-2xl font-bold">
												{userStats.gamesWon}
											</div>
										</div>

										<div className="stat bg-base-200 rounded-lg p-4">
											<div className="stat-title text-base-content/70 text-sm">
												Win Rate
											</div>
											<div className="stat-value text-accent text-2xl font-bold">
												{userStats.winRate}%
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Game Invites */}
						<div className="card bg-base-100 shadow-2xl">
							<div className="card-body">
								<h2 className="card-title text-xl mb-4">Game Invites</h2>
								<GameInvites />
							</div>
						</div>

						{/* Friends List Placeholder */}
						<div className="card bg-base-100 shadow-2xl">
							<div className="card-body">
								<h2 className="card-title text-xl mb-4">Friends</h2>

								<div className="text-center py-8">
									<div className="text-4xl mb-3">👋</div>
									<h3 className="text-lg font-medium mb-2">
										Friends Feature Coming Soon
									</h3>
									<p className="text-base-content/70 text-sm">
										Connect with friends to play together!
									</p>
								</div>
							</div>
						</div>

						{/* Quick Tips */}
						<div className="card bg-base-100 shadow-2xl">
							<div className="card-body">
								<h2 className="card-title text-xl mb-4">Quick Tips</h2>

								<div className="space-y-3 text-sm">
									<div className="p-3 bg-base-200 rounded-lg">
										<span className="text-info">💎</span>
										<span className="text-base-content/70 ml-2">
											Three 1s = 1000 points!
										</span>
									</div>
									<div className="p-3 bg-base-200 rounded-lg">
										<span className="text-info">🎯</span>
										<span className="text-base-content/70 ml-2">
											Single 1s = 100 points each
										</span>
									</div>
									<div className="p-3 bg-base-200 rounded-lg">
										<span className="text-info">⚡</span>
										<span className="text-base-content/70 ml-2">
											Single 5s = 50 points each
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
