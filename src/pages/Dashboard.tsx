import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionComponent } from "../common/types";
import { Navbar } from "../components/layout/navbar/Navbar";
import { supabase } from "../lib/supabaseClient";
import { nanoid } from "nanoid";
import { generateRoomName } from "../utils/roomNames";
import { GameInvites } from "../features/GameInvites";

import type { User } from "@supabase/supabase-js";
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
	const [error, setError] = useState("");

	const gameRoomSubscriptionRef = useRef<RealtimeChannel | null>(null);

	useEffect(() => {
		const fetchCurrentRooms = async (): Promise<void> => {
			if (!user) return;

			// get the rooms where this user is a player and the room status is not completed
			// and only get the game_rooms data
			const { data: playerRooms } = await supabase
				.from("game_players")
				.select("game_id, game_rooms(*)")
				.not("game_rooms.status", "eq", "completed")
				.not("game_rooms", "is", null)
				.eq("user_id", user.id)
				.eq("is_joined", true);

			const { data: waitingRooms } = await supabase
				.from("game_rooms")
				.select("*")
				.in("status", ["waiting"])
				.order("created_at", { ascending: false });

			if (waitingRooms) {
				// Filter out rooms that are already in currentRooms
				if (playerRooms && playerRooms.length > 0) {
					const filteredRooms = waitingRooms.filter(
						(room) =>
							!playerRooms.some(
								(playerRoom) => playerRoom.game_rooms.id === room.id
							)
					);
					setAvailableRooms(filteredRooms);
				} else {
					setAvailableRooms(waitingRooms);
				}
			}

			if (playerRooms) {
				setCurrentRooms(playerRooms.map((item) => item.game_rooms as GameRoom));
			}
		};
		if (!isAuthChecking && user) {
			void fetchCurrentRooms();
		}
	}, [isAuthChecking, user]);

	const handleCreateRoom = async () => {
		try {
			setLoading(true);
			setError("");
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			// First, check if user profile exists
			const { data: profile } = await supabase
				.from("profiles")
				.select("id")
				.eq("id", user.id)
				.single();

			// If profile doesn't exist, create it
			if (!profile) {
				const { error: profileError } = await supabase.from("profiles").insert([
					{
						id: user.id,
						username: user.email?.split("@")[0] || `player_${nanoid(4)}`,
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
			navigate({ to: "/app/room", search: { roomId } });
		} catch (error) {
			console.error("Error creating room:", error);
			setError("Failed to create room. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleEndGame = async (roomId: string) => {
		try {
			const { error, data } = await supabase.rpc("end_game", {
				p_game_id: roomId,
			});

			setCurrentRooms(currentRooms?.filter((room) => room.id !== roomId));

			if (error) {
				console.error("End game error:", error);
				setError("Failed to end game. Please try again.");
			}
		} catch (err) {
			console.error("End game error:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to end game. Please try again."
			);
		}
	};

	return (
		<div className="container mx-auto p-6 space-y-8">
			{/* Hero Section */}
			<div className="hero bg-base-200 rounded-2xl">
				<div className="hero-content text-center py-12">
					<div className="max-w-md">
						<h1 className="text-5xl font-bold">Welcome to Farkle Online</h1>
						<p className="py-6 text-base-content/70">
							Join the fun and play the classic dice game with friends online!
						</p>
						<button
							className={`btn btn-primary btn-lg ${loading ? "loading" : ""}`}
							onClick={handleCreateRoom}
							disabled={loading}
						>
							{loading ? "Creating..." : "Create New Game"}
						</button>
					</div>
				</div>
			</div>

			{/* Error Alert */}
			{error && (
				<div className="alert alert-error">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{error}</span>
					<button className="btn btn-sm btn-ghost" onClick={() => setError("")}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			)}

			{/* Current Games Section */}
			<div className="space-y-4">
				<h2 className="text-2xl font-bold">Your Current Games</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{currentRooms &&
						currentRooms.length > 0 &&
						currentRooms.map((room) => (
							<div key={room.id} className="card bg-base-100 shadow-xl">
								<div className="card-body">
									<div className="flex justify-between items-start mb-4">
										<h3 className="card-title text-lg">{room.name}</h3>
										<div
											className={`badge ${
												room?.status === "waiting"
													? "badge-warning"
													: "badge-success"
											}`}
										>
											{room?.status === "waiting" ? "Waiting" : "In Progress"}
										</div>
									</div>

									<div className="space-y-2 text-sm">
										<div className="flex justify-between">
											<span className="text-base-content/70">Created by:</span>
											<span>
												{room.created_by === user?.id ? "You" : "Someone else"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-base-content/70">Players:</span>
											<span>
												{room.current_players}/{room.max_players}
											</span>
										</div>
									</div>

									<div className="card-actions justify-end mt-4 gap-2">
										<button
											onClick={() =>
												navigate({
													to: "/app/room",
													search: { roomId: room.id },
												})
											}
											className="btn btn-primary btn-sm flex-1"
										>
											Continue Game
										</button>
										{user &&
											room.created_by === user.id &&
											room?.status === "in_progress" && (
												<button
													onClick={() => handleEndGame(room.id)}
													className="btn btn-error btn-sm"
												>
													End
												</button>
											)}
									</div>
								</div>
							</div>
						))}

					{currentRooms === null && (
						<>
							<div className="skeleton h-48 w-full"></div>
							<div className="skeleton h-48 w-full"></div>
							<div className="skeleton h-48 w-full"></div>
						</>
					)}

					{currentRooms && currentRooms.length === 0 && (
						<div className="card bg-base-100 shadow-xl border-2 border-dashed border-base-300">
							<div className="card-body items-center text-center">
								<div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-4">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-8 w-8 text-base-content/50"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
								</div>
								<h3 className="card-title">No active games</h3>
								<p className="text-base-content/70">
									Create a new game to get started!
								</p>
								<button
									className="btn btn-primary mt-4"
									onClick={handleCreateRoom}
									disabled={loading}
								>
									Create Game
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Game Invites Section */}
			<div className="space-y-4">
				<h2 className="text-2xl font-bold">Game Invites</h2>
				<div className="card bg-base-100 shadow-xl">
					<div className="card-body">
						<GameInvites />
					</div>
				</div>
			</div>

			{/* Available Games Section */}
			<div className="space-y-4">
				<h2 className="text-2xl font-bold">Available Games</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{availableRooms &&
						availableRooms.length > 0 &&
						availableRooms.map((room) => (
							<div key={room.id} className="card bg-base-100 shadow-xl">
								<div className="card-body">
									<div className="flex justify-between items-start mb-4">
										<h3 className="card-title text-lg">{room.name}</h3>
										<div className="badge badge-warning">Waiting</div>
									</div>

									<div className="flex justify-between text-sm mb-4">
										<span className="text-base-content/70">Players:</span>
										<span>
											{room.current_players}/{room.max_players}
										</span>
									</div>

									<div className="card-actions justify-end gap-2">
										<button
											onClick={() =>
												navigate({
													to: "/app/room",
													search: { roomId: room.id },
												})
											}
											className="btn btn-primary btn-sm flex-1"
										>
											Join Game
										</button>
									</div>
								</div>
							</div>
						))}

					{availableRooms === null && (
						<>
							<div className="skeleton h-48 w-full"></div>
							<div className="skeleton h-48 w-full"></div>
							<div className="skeleton h-48 w-full"></div>
						</>
					)}

					{availableRooms && availableRooms.length === 0 && (
						<div className="card bg-base-100 shadow-xl border-2 border-dashed border-base-300">
							<div className="card-body items-center text-center">
								<div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-4">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-8 w-8 text-base-content/50"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
										/>
									</svg>
								</div>
								<h3 className="card-title">No games available</h3>
								<p className="text-base-content/70">
									Be the first to create a game!
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* How to Play Section */}
			<div className="space-y-4">
				<h2 className="text-2xl font-bold">How to Play</h2>
				<div className="card bg-base-100 shadow-xl">
					<div className="card-body">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="space-y-3">
								<h3 className="text-lg font-semibold">Objective</h3>
								<p className="text-base-content/80">
									Be the first player to score 10,000 points by rolling dice and
									making strategic decisions.
								</p>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-semibold">Scoring</h3>
								<div className="space-y-1 text-sm">
									<div className="flex justify-between">
										<span>Single 1:</span>
										<span className="font-medium">100 points</span>
									</div>
									<div className="flex justify-between">
										<span>Single 5:</span>
										<span className="font-medium">50 points</span>
									</div>
									<div className="flex justify-between">
										<span>Three of a kind:</span>
										<span className="font-medium">Value × 100</span>
									</div>
									<div className="flex justify-between">
										<span>Three pairs:</span>
										<span className="font-medium">750 points</span>
									</div>
									<div className="flex justify-between">
										<span>Straight (1-6):</span>
										<span className="font-medium">1000 points</span>
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
