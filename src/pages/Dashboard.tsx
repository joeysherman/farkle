import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { FunctionComponent } from "../common/types";
import { supabase } from "../lib/supabaseClient";
import { nanoid } from "nanoid";
import { generateRoomName } from "../utils/roomNames";
import { GameInvites } from "../features/GameInvites";
import { useAuth } from "../contexts/AuthContext";
import { FriendsList } from "../components/FriendsList";

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

	const handleJoinRecentGame = (): void => {
		if (currentRooms && currentRooms.length > 0) {
			// Join the first (most recent) active game
			const mostRecentRoom = currentRooms[0];
			if (mostRecentRoom) {
				void navigate({
					to: "/app/room",
					search: { roomId: mostRecentRoom.id },
				});
			}
		}
	};

	if (isAuthChecking) {
		return (
			<div className="bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
				<LoadingSpinner />
			</div>
		);
	}

	return (
		<div className="container mx-auto pt-6">
			{/* Header */}
			<div className="rounded-xl p-6 bg-gradient-to-r from-indigo-50 via-white to-sky-50 shadow-inner mb-8">
				<h1 className="text-4xl font-bold text-neutral mb-1">Welcome back!</h1>
				<p className="text-slate-500 text-md">Ready to roll some dice?</p>
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

			<div className="grid grid-cols-1 grid-rows-none auto-rows-min lg:grid-cols-3 gap-6">
				{/* Left Column - Primary Actions and Active Games */}
				<div className="lg:col-span-2 space-y-6">
					{/* Quick Actions Card */}
					<div className="card bg-base-100 shadow-md ring-1 ring-base-300">
						<div className="card-body">
							<h2 className="card-title text-2xl mb-4">Quick Actions</h2>

							<div className="flex flex-col sm:flex-row gap-4 justify-center">
								<button
									className="btn btn-primary flex-1 max-w-md"
									disabled={loading}
									onClick={handleCreateRoom}
								>
									{loading ? <LoadingSpinner /> : "🎲 Create New Game"}
								</button>

								{/* <button
										className="btn btn-secondary flex-1 max-w-md h-auto py-3"
										disabled={!currentRooms || currentRooms.length === 0}
										onClick={handleJoinRecentGame}
									>
										{currentRooms &&
										currentRooms.length > 0 &&
										currentRooms[0] ? (
											<div className="flex flex-col items-center gap-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold">
														Continue Last Game
													</span>
												</div>
												<div className="text-xs opacity-80">
													{currentRooms[0].name}
												</div>
												<div className="text-xs opacity-70">
													👥 {currentRooms[0].current_players}/
													{currentRooms[0].max_players} •{" "}
													{currentRooms[0].status === "waiting"
														? "⏳ Waiting"
														: "🎲 In Progress"}
												</div>
											</div>
										) : (
											"🚀 Join Recent Game"
										)}
									</button> */}
							</div>
						</div>
					</div>

					{/* Available Games */}
					{/* <div className="card bg-base-100 shadow-2xl">
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
						</div> */}
				</div>
				{/* Right Column - Secondary Info */}
				<div className="flex">
					{/* Game Invites */}
					<div className="card bg-base-100 shadow-md ring-1 ring-base-300 flex-1">
						<div className="card-body">
							<h2 className="card-title text-lg mb-4">Game Invites</h2>
							<GameInvites />
						</div>
					</div>
				</div>
				<div className="lg:col-span-2 space-y-6">
					{/* Active Games */}
					<div className="card bg-base-100 shadow-md ring-1 ring-base-300">
						<div className="card-body">
							<div className="flex items-center gap-3 mb-6">
								<h2 className="card-title text-2xl">Your Active Games</h2>
								{currentRooms && currentRooms.length > 0 && (
									<div className="badge badge-accent">
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
											className="p-4 bg-base-200 rounded-lg border border-base-300 transition-all duration-200 hover:ring-accent/40 hover:bg-base-100"
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
														👤 {room.created_by === user?.id ? "You" : "Friend"}
													</span>
													<span className="text-accent font-bold">
														👥 {room.current_players}/{room.max_players}
													</span>
												</div>
											</div>

											<div className="flex justify-end gap-3">
												<button
													className="btn btn-accent btn-sm"
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
												className="skeleton h-24 w-full bg-base-300 rounded-lg ring-1 ring-base-200"
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
				</div>

				{/* Right Column - Secondary Info */}
				<div className="flex">
					{/* Friends List */}
					<div className="card bg-base-100 shadow-md ring-1 ring-base-300 flex-1">
						<div className="card-body">
							<div className="flex items-center justify-between mb-4">
								<h2 className="card-title text-xl">Friends</h2>
								<button
									className="btn btn-primary btn-sm"
									onClick={() => navigate({ to: "/app/friends" })}
								>
									<svg
										className="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										/>
									</svg>
								</button>
							</div>

							<FriendsList
								showSearch={false}
								showInvites={false}
								maxDisplay={3}
								compact={true}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
