import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionComponent } from "../common/types";
import { Navbar } from "../components/layout/navbar/Navbar";
import { supabase } from "../lib/supabaseClient";
import { nanoid } from "nanoid";
import { generateRoomName } from "../utils/roomNames";

import type { User } from "@supabase/supabase-js";

interface GameRoom {
	id: string;
	name: string;
	created_by: string;
	max_players: number;
	current_players: number;
	status: "waiting" | "in_progress" | "completed";
	invite_code: string;
}

export const Home = (): FunctionComponent => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);
	const [showCreateRoom, setShowCreateRoom] = useState(false);
	const [roomName, setRoomName] = useState(nanoid(6));
	const [error, setError] = useState("");
	const [availableRooms, setAvailableRooms] = useState<Array<GameRoom>>([]);
	const [currentRooms, setCurrentRooms] = useState<Array<GameRoom>>([]);
	const [isAuthChecking, setIsAuthChecking] = useState(true);
	const [user, setUser] = useState<User | null>(null);

	useEffect(() => {
		const checkAuth = async (): Promise<void> => {
			const {
				data: { user: authUser },
			} = await supabase.auth.getUser();

			if (!authUser) {
				await navigate({ to: "/signup" });
				return;
			}
			setUser(authUser);
			setIsAuthChecking(false);
		};

		void checkAuth();
	}, [navigate]);

	useEffect(() => {
		const fetchRooms = async (): Promise<void> => {
			const { data } = await supabase
				.from("game_rooms")
				.select("*")
				.in("status", ["waiting", "in_progress"])
				.order("created_at", { ascending: false });

			if (data) {
				// Filter out rooms that are already in currentRooms
				const filteredRooms = data.filter(
					(room) =>
						!currentRooms.some((currentRoom) => currentRoom.id === room.id)
				);
				setAvailableRooms(filteredRooms);
			}
		};

		const fetchCurrentRooms = async (): Promise<void> => {
			if (!user) return;

			const { data } = await supabase
				.from("game_players")
				.select("game_id, game_rooms(*)")
				.eq("user_id", user.id)
				.eq("is_active", true);

			if (data) {
				setCurrentRooms(data.map((item) => item.game_rooms as GameRoom));
			}
		};

		if (!isAuthChecking) {
			void fetchRooms();
			void fetchCurrentRooms();
		}
		const roomSubscription = supabase
			.channel("room_changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "game_rooms",
				},
				() => {
					void fetchRooms();
					void fetchCurrentRooms();
				}
			)
			.subscribe();

		return () => {
			void roomSubscription.unsubscribe();
		};
	}, [isAuthChecking, user, currentRooms]);

	if (isAuthChecking) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading... home</p>
				</div>
			</div>
		);
	}

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
			navigate({ to: "/room", search: { roomId } });
		} catch (error) {
			console.error("Error creating room:", error);
			setError("Failed to create room. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleQuickPlay = async () => {
		try {
			setLoading(true);
			const { data: rooms } = await supabase
				.from("game_rooms")
				.select("*")
				.eq("status", "waiting")
				.gt("current_players", 0)
				.lt("current_players", "max_players")
				.limit(1)
				.single();

			if (rooms) {
				navigate({ to: "/room", search: { roomId: rooms.id } });
			} else {
				// No rooms available, create one
				handleCreateRoom();
			}
		} catch (error) {
			console.error("Error finding game:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleEndGame = async (roomId: string) => {
		try {
			const { error } = await supabase.rpc("end_game", {
				p_game_id: roomId,
			});

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

	const runAllTests = async (): Promise<void> => {
		try {
			setLoading(true);
			const { error } = await supabase.rpc("run_all_tests");
			if (error) throw error;
			alert("Tests completed successfully!");
		} catch (error) {
			console.error("Test error:", error);
			alert("Failed to run tests. Check console for details.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-100">
			<Navbar />
			<div className="container mx-auto px-4 py-8">
				{/* Hero Section */}
				<div className="text-center mb-12">
					<h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
						Welcome to Farkle Online
					</h1>
					<p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
						Join the fun and play the classic dice game with friends online!
					</p>
				</div>

				{/* Current Rooms Section */}
				{currentRooms.length > 0 && (
					<div className="mb-12">
						<h2 className="text-2xl font-bold text-gray-900 mb-4">
							Your Current Rooms
						</h2>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{currentRooms.map((room) => (
								<div
									key={room.id}
									className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
								>
									<div className="px-4 py-5 sm:p-6">
										<div className="flex justify-between items-center mb-4">
											<h3 className="text-lg font-medium text-gray-900">
												{room.name}
											</h3>
											<span
												className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
										<div className="mt-4 flex gap-2">
											<button
												onClick={() =>
													navigate({ to: "/room", search: { roomId: room.id } })
												}
												className={`flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
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
														className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
													>
														End Game
													</button>
												)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Available Rooms Section */}
				{availableRooms.length > 0 && (
					<div className="mb-12">
						<h2 className="text-2xl font-bold text-gray-900 mb-4">
							Available Rooms
						</h2>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{availableRooms.map((room) => (
								<div
									key={room.id}
									className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
								>
									<div className="px-4 py-5 sm:p-6">
										<div className="flex justify-between items-center mb-4">
											<h3 className="text-lg font-medium text-gray-900">
												{room.name}
											</h3>
											<span
												className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
										<div className="mt-4 flex gap-2">
											<button
												onClick={() =>
													navigate({ to: "/room", search: { roomId: room.id } })
												}
												className={`flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
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
														className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
													>
														End Game
													</button>
												)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Main Menu Options */}
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{/* Quick Play */}
					<div className="bg-white overflow-hidden shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<h3 className="text-lg font-medium text-gray-900">Quick Play</h3>
							<p className="mt-2 text-sm text-gray-500">
								Join a random game that's waiting for players
							</p>
							<button
								onClick={handleQuickPlay}
								disabled={loading}
								className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
							>
								{loading ? "Finding Game..." : "Find Game"}
							</button>
						</div>
					</div>

					{/* Create Game */}
					<div className="bg-white overflow-hidden shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<h3 className="text-lg font-medium text-gray-900">Create Game</h3>
							<p className="mt-2 text-sm text-gray-500">
								Create a new game room and invite friends
							</p>
							<button
								onClick={handleCreateRoom}
								disabled={loading}
								className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
							>
								{loading ? "Creating..." : "Create Room"}
							</button>
							{error && <p className="text-red-500 mt-2">{error}</p>}
						</div>
					</div>

					{/* Profile & Settings */}
					<div className="bg-white overflow-hidden shadow rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<h3 className="text-lg font-medium text-gray-900">
								Profile & Settings
							</h3>
							<p className="mt-2 text-sm text-gray-500">
								View your stats and customize game settings
							</p>
							<button className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
								View Profile
							</button>
							<button
								onClick={runAllTests}
								disabled={loading}
								className="mt-2 w-full inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
							>
								{loading ? "Running Tests..." : "Run All Tests"}
							</button>
						</div>
					</div>
				</div>

				{/* Game Rules Section */}
				<div className="mt-12">
					<h2 className="text-2xl font-bold text-gray-900 mb-4">How to Play</h2>
					<div className="bg-white shadow overflow-hidden sm:rounded-lg">
						<div className="px-4 py-5 sm:p-6">
							<dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
								<div>
									<dt className="text-sm font-medium text-gray-500">
										Objective
									</dt>
									<dd className="mt-1 text-sm text-gray-900">
										Be the first player to score 10,000 points by rolling dice
										and making strategic decisions.
									</dd>
								</div>
								<div>
									<dt className="text-sm font-medium text-gray-500">Scoring</dt>
									<dd className="mt-1 text-sm text-gray-900">
										• Single 1: 100 points
										<br />
										• Single 5: 50 points
										<br />
										• Three of a kind: Value × 100 (1s are worth 1000)
										<br />
										• Three pairs: 750 points
										<br />• Straight (1-6): 1000 points
									</dd>
								</div>
							</dl>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
