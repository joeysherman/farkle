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

const test_bot_decisions = async (): Promise<void> => {
	const { data, error } = await supabase.rpc("test_bot_decisions");
	if (error) {
		console.error("Error testing bot decisions:", error);
	}
	console.log(data);
};

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

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
			{/* Background Pattern */}
			<div className="absolute inset-0 opacity-20">
				<div
					className="h-full w-full bg-repeat"
					style={{
						backgroundImage:
							"radial-gradient(circle at 1px 1px, rgba(156, 146, 172, 0.15) 1px, transparent 0)",
						backgroundSize: "20px 20px",
					}}
				></div>
			</div>

			<div className="relative container mx-auto p-6">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-white mb-2">Welcome back!</h1>
					<p className="text-slate-300 text-lg">Ready to roll some dice?</p>
				</div>

				{/* Error Alert */}
				{error && (
					<div className="alert bg-red-900/50 border border-red-500/50 backdrop-blur-sm rounded-2xl mb-6">
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
						<span className="text-red-200">{error}</span>
						<button
							className="btn btn-sm bg-red-800 hover:bg-red-700 border-0 text-red-100"
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
						<div className="card bg-slate-800/90 backdrop-blur-sm border border-indigo-400/30 shadow-xl">
							<div className="card-body p-6">
								<div className="flex items-center space-x-3 mb-4">
									<div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold">⚡</span>
									</div>
									<h2 className="text-2xl font-bold text-white">
										Quick Actions
									</h2>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="flex space-x-2">
										<button
											className="btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 border-0 text-white rounded-xl h-16"
											onClick={() => {
												void test_bot_decisions();
											}}
										>
											Test Bot Decisions
										</button>
									</div>

									<button
										disabled={loading}
										className={`btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 border-0 text-white rounded-xl h-16 ${
											loading ? "loading" : ""
										}`}
										onClick={handleCreateRoom}
									>
										{loading ? "Creating..." : "🎲 Create New Game"}
									</button>

									<div className="flex space-x-2">
										<input
											type="text"
											placeholder="Enter game code"
											value={joinCode}
											onChange={(e) => setJoinCode(e.target.value)}
											className="input input-bordered bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 flex-1"
											onKeyPress={(e) =>
												e.key === "Enter" && handleJoinByCode()
											}
										/>
										<button
											disabled={joinCodeLoading || !joinCode.trim()}
											className={`btn bg-emerald-600 hover:bg-emerald-700 border-0 text-white ${
												joinCodeLoading ? "loading" : ""
											}`}
											onClick={handleJoinByCode}
										>
											{joinCodeLoading ? "" : "Join"}
										</button>
									</div>
								</div>
							</div>
						</div>

						{/* Active Games */}
						<div className="card bg-slate-800/90 backdrop-blur-sm border border-indigo-400/30 shadow-xl">
							<div className="card-body p-6">
								<div className="flex items-center space-x-3 mb-6">
									<div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold">🎮</span>
									</div>
									<h2 className="text-2xl font-bold text-white">
										Your Active Games
									</h2>
									{currentRooms && currentRooms.length > 0 && (
										<div className="badge bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
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
												className="p-4 bg-slate-700/50 rounded-lg border border-slate-600/50 hover:border-indigo-400/50 transition-colors"
											>
												<div className="flex justify-between items-start mb-3">
													<h3 className="text-lg font-bold text-white">
														{room.name}
													</h3>
													<div
														className={`badge text-xs font-semibold px-3 py-2 ${
															room?.status === "waiting"
																? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
																: "bg-green-500/20 text-green-300 border-green-500/30"
														}`}
													>
														{room?.status === "waiting"
															? "⏳ Waiting"
															: "🎲 In Progress"}
													</div>
												</div>

												<div className="flex justify-between items-center mb-4">
													<div className="flex items-center space-x-4 text-sm">
														<span className="text-slate-300">
															👤{" "}
															{room.created_by === user?.id ? "You" : "Friend"}
														</span>
														<span className="text-indigo-300 font-bold">
															👥 {room.current_players}/{room.max_players}
														</span>
													</div>
												</div>

												<div className="flex justify-end gap-3">
													<button
														className="btn bg-indigo-600 hover:bg-indigo-700 border-0 text-white btn-sm rounded-lg"
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
																className="btn bg-red-600 hover:bg-red-700 border-0 text-white btn-sm rounded-lg"
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
													className="skeleton h-24 w-full bg-slate-700/50 rounded-lg"
												></div>
											))}
										</div>
									)}

									{currentRooms && currentRooms.length === 0 && (
										<div className="text-center py-8">
											<div className="text-4xl mb-3">🎲</div>
											<h3 className="text-lg font-medium text-white mb-2">
												No active games
											</h3>
											<p className="text-slate-300">
												Create a new game to get started!
											</p>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Available Games */}
						<div className="card bg-slate-800/90 backdrop-blur-sm border border-green-400/30 shadow-xl">
							<div className="card-body p-6">
								<div className="flex items-center space-x-3 mb-6">
									<div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold">🌟</span>
									</div>
									<h2 className="text-2xl font-bold text-white">
										Available Games
									</h2>
									{availableRooms && availableRooms.length > 0 && (
										<div className="badge bg-green-500/20 text-green-300 border-green-500/30">
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
												className="p-4 bg-slate-700/50 rounded-lg border border-slate-600/50 hover:border-green-400/50 transition-colors"
											>
												<div className="flex justify-between items-center">
													<div>
														<h3 className="text-lg font-bold text-white mb-1">
															{room.name}
														</h3>
														<span className="text-green-300 font-medium text-sm">
															👥 {room.current_players}/{room.max_players}{" "}
															players
														</span>
													</div>
													<button
														className="btn bg-green-600 hover:bg-green-700 border-0 text-white btn-sm rounded-lg"
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
													className="skeleton h-20 w-full bg-slate-700/50 rounded-lg"
												></div>
											))}
										</div>
									)}

									{availableRooms && availableRooms.length === 0 && (
										<div className="text-center py-8">
											<div className="text-4xl mb-3">🎯</div>
											<h3 className="text-lg font-medium text-white mb-2">
												No games available
											</h3>
											<p className="text-slate-300">
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
							<div className="card bg-slate-800/90 backdrop-blur-sm border border-purple-400/30 shadow-xl">
								<div className="card-body p-6">
									<div className="flex items-center space-x-3 mb-6">
										<div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
											<span className="text-white font-bold">📊</span>
										</div>
										<h2 className="text-xl font-bold text-white">Your Stats</h2>
									</div>

									<div className="space-y-4">
										<div className="stat bg-purple-500/10 rounded-lg p-4">
											<div className="stat-title text-purple-300 text-sm">
												Total Games
											</div>
											<div className="stat-value text-purple-400 text-2xl font-bold">
												{userStats.totalGames}
											</div>
										</div>

										<div className="stat bg-green-500/10 rounded-lg p-4">
											<div className="stat-title text-green-300 text-sm">
												Games Won
											</div>
											<div className="stat-value text-green-400 text-2xl font-bold">
												{userStats.gamesWon}
											</div>
										</div>

										<div className="stat bg-yellow-500/10 rounded-lg p-4">
											<div className="stat-title text-yellow-300 text-sm">
												Win Rate
											</div>
											<div className="stat-value text-yellow-400 text-2xl font-bold">
												{userStats.winRate}%
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Game Invites */}
						<div className="card bg-slate-800/90 backdrop-blur-sm border border-yellow-400/30 shadow-xl">
							<div className="card-body p-6">
								<div className="flex items-center space-x-3 mb-6">
									<div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold">✉️</span>
									</div>
									<h2 className="text-xl font-bold text-white">Game Invites</h2>
								</div>
								<GameInvites />
							</div>
						</div>

						{/* Friends List Placeholder */}
						<div className="card bg-slate-800/90 backdrop-blur-sm border border-blue-400/30 shadow-xl">
							<div className="card-body p-6">
								<div className="flex items-center space-x-3 mb-6">
									<div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold">👥</span>
									</div>
									<h2 className="text-xl font-bold text-white">Friends</h2>
								</div>

								<div className="text-center py-8">
									<div className="text-4xl mb-3">👋</div>
									<h3 className="text-lg font-medium text-white mb-2">
										Friends Feature Coming Soon
									</h3>
									<p className="text-slate-300 text-sm">
										Connect with friends to play together!
									</p>
								</div>
							</div>
						</div>

						{/* Quick Tips */}
						<div className="card bg-slate-800/90 backdrop-blur-sm border border-cyan-400/30 shadow-xl">
							<div className="card-body p-6">
								<div className="flex items-center space-x-3 mb-6">
									<div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold">💡</span>
									</div>
									<h2 className="text-xl font-bold text-white">Quick Tips</h2>
								</div>

								<div className="space-y-3 text-sm">
									<div className="p-3 bg-slate-700/50 rounded-lg">
										<span className="text-cyan-300">💎</span>
										<span className="text-slate-300 ml-2">
											Three 1s = 1000 points!
										</span>
									</div>
									<div className="p-3 bg-slate-700/50 rounded-lg">
										<span className="text-cyan-300">🎯</span>
										<span className="text-slate-300 ml-2">
											Single 1s = 100 points each
										</span>
									</div>
									<div className="p-3 bg-slate-700/50 rounded-lg">
										<span className="text-cyan-300">⚡</span>
										<span className="text-slate-300 ml-2">
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
