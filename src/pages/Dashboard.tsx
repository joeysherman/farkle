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
		<div className="container mx-auto px-4 py-4 sm:py-8">
			{/* Hero Section */}
			<div className="text-center mb-8 sm:mb-12">
				<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900">
					Welcome to Farkle Online
				</h1>
				<p className="mt-3 max-w-md mx-auto text-gray-500 md:text-xl md:max-w-3xl">
					Join the fun and play the classic dice game with friends online!
				</p>
			</div>

			{/* Current Rooms Section */}
			<div className="mb-8">
				<h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
					Your Current Games
				</h2>
				<div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{currentRooms &&
						currentRooms.length > 0 &&
						currentRooms.map((room) => (
							<div
								key={room.id}
								className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
							>
								<div className="p-4 sm:p-6">
									<div className="flex justify-between items-center mb-3 sm:mb-4">
										<h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">
											{room.name}
										</h3>
										<span
											className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
												room?.status === "waiting"
													? "bg-yellow-100 text-yellow-800"
													: "bg-green-100 text-green-800"
											}`}
										>
											{room?.status === "waiting" ? "Waiting" : "In Progress"}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<p className="mt-1 text-sm text-gray-500">
											Created by:{" "}
											{room.created_by === user?.id ? "You" : "Someone else"}
										</p>
										<p className="mt-1 text-sm text-gray-500">
											Players: {room.current_players}/{room.max_players}
										</p>
									</div>
									<div className="mt-4 flex gap-2">
										<button
											onClick={() =>
												navigate({
													to: "/app/room",
													search: { roomId: room.id },
												})
											}
											className={`flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
												room?.status === "waiting"
													? "bg-indigo-600 hover:bg-indigo-700"
													: "bg-green-600 hover:bg-green-700"
											} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
										>
											{room?.status === "waiting"
												? "Continue Game"
												: "Continue Game"}
										</button>
										{user &&
											room.created_by === user.id &&
											room?.status === "in_progress" && (
												<button
													onClick={() => handleEndGame(room.id)}
													className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
												>
													End Game
												</button>
											)}
									</div>
								</div>
							</div>
						))}
					{currentRooms === null && (
						<>
							<div className="skeleton h-[146px] w-full opacity-70 rounded-lg shadow"></div>
							<div className="skeleton h-[146px] w-full opacity-70 rounded-lg shadow"></div>
						</>
					)}
					{currentRooms && currentRooms.length === 0 && (
						<div className="min-h-[146px] w-full bg-white opacity-100 rounded-lg shadow hover:shadow-md transition-shadow duration-200">
							<div className="p-6 text-center">
								<h3 className="text-xl font-semibold text-gray-900 mb-3">
									No games available
								</h3>
								<p className="text-sm text-gray-600 mb-6">
									Create a new game and invite friends to play!
								</p>
								<button
									className="inline-flex items-center justify-center px-6 pl-4 py-3 border-2 border-green-600 text-sm font-medium rounded-md text-green-600 bg-transparent hover:bg-green-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm hover:shadow transition-all duration-200 group"
									onClick={handleCreateRoom}
								>
									<svg
										className="h-5 w-5 mr-2 text-green-600 group-hover:text-white transition-colors duration-200"
										fill="currentColor"
										viewBox="0 0 20 20"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											fillRule="evenodd"
											d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
											clipRule="evenodd"
										/>
									</svg>
									Create Game
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Game Invites Section */}
			<div className="mb-8">
				<h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
					Game Invites
				</h2>
				<div className="bg-white shadow overflow-hidden sm:rounded-lg">
					<div className="px-4 py-5 sm:p-6">
						<GameInvites />
					</div>
				</div>
			</div>

			{/* Available Rooms Section */}
			<div className="mb-8">
				<h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
					Available Games
				</h2>
				<div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{availableRooms &&
						availableRooms.length > 0 &&
						availableRooms.map((room) => (
							<div
								key={room.id}
								className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
							>
								<div className="p-4 sm:p-6">
									<div className="flex justify-between items-center mb-3 sm:mb-4">
										<h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">
											{room.name}
										</h3>
										<span
											className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
												room?.status === "waiting"
													? "bg-yellow-100 text-yellow-800"
													: "bg-green-100 text-green-800"
											}`}
										>
											{room?.status === "waiting" ? "Waiting" : "In Progress"}
										</span>
									</div>
									<p className="mt-1 text-sm text-gray-500">
										Players: {room.current_players}/{room.max_players}
									</p>
									<div className="mt-3 sm:mt-4 flex gap-2">
										<button
											onClick={() =>
												navigate({
													to: "/app/room",
													search: { roomId: room.id },
												})
											}
											className={`flex-1 inline-flex justify-center py-2 px-3 sm:px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
												room?.status === "waiting"
													? "bg-indigo-600 hover:bg-indigo-700"
													: "bg-green-600 hover:bg-green-700"
											} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
										>
											{room?.status === "waiting" ? "Join Game" : "View Game"}
										</button>
										{user &&
											room.created_by === user.id &&
											room?.status === "in_progress" && (
												<button
													onClick={() => handleEndGame(room.id)}
													className="inline-flex justify-center py-2 px-3 sm:px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
												>
													End Game
												</button>
											)}
									</div>
								</div>
							</div>
						))}
					{availableRooms === null && (
						<>
							<div className="skeleton h-[146px] w-full opacity-70 rounded-lg shadow"></div>
							<div className="skeleton h-[146px] w-full opacity-70 rounded-lg shadow"></div>
						</>
					)}
					{availableRooms && availableRooms.length === 0 && (
						<div className="min-h-[146px] w-full bg-white opacity-100 rounded-lg shadow hover:shadow-md transition-shadow duration-200">
							<div className="p-6 text-center">
								<h3 className="text-xl font-semibold text-gray-900 mb-3">
									No games available
								</h3>
								<p className="text-sm text-gray-600 mb-6">
									Create a new game and invite friends to play!
								</p>
								<button
									className="inline-flex items-center justify-center px-6 pl-4 py-3 border-2 border-green-600 text-sm font-medium rounded-md text-green-600 bg-transparent hover:bg-green-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm hover:shadow transition-all duration-200 group"
									onClick={handleCreateRoom}
								>
									<svg
										className="h-5 w-5 mr-2 text-green-600 group-hover:text-white transition-colors duration-200"
										fill="currentColor"
										viewBox="0 0 20 20"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											fillRule="evenodd"
											d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
											clipRule="evenodd"
										/>
									</svg>
									Create Game
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Game Rules Section */}
			<div className="pt-0">
				<h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
					How to Play
				</h2>
				<div className="bg-white shadow overflow-hidden sm:rounded-lg">
					<div className="px-3 py-4 sm:p-6">
						<dl className="grid grid-cols-1 gap-y-4 sm:gap-y-6 sm:grid-cols-2 sm:gap-x-4">
							<div>
								<dt className="text-sm font-medium text-gray-500">Objective</dt>
								<dd className="mt-1 text-sm text-gray-900">
									Be the first player to score 10,000 points by rolling dice and
									making strategic decisions.
								</dd>
							</div>
							<div>
								<dt className="text-sm font-medium text-gray-500">Scoring</dt>
								<dd className="mt-1 text-sm text-gray-900 space-y-1">
									<p>• Single 1: 100 points</p>
									<p>• Single 5: 50 points</p>
									<p>• Three of a kind: Value × 100 (1s are worth 1000)</p>
									<p>• Three pairs: 750 points</p>
									<p>• Straight (1-6): 1000 points</p>
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</div>
		</div>
	);
};
