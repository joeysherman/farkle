import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { FunctionComponent } from "../common/types";
import { Navbar } from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";

interface GameRoom {
	id: string;
	name: string;
	current_players: number;
	max_players: number;
	status: 'waiting' | 'in_progress' | 'completed';
}

export const Home = (): FunctionComponent => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);
	const [showCreateRoom, setShowCreateRoom] = useState(false);
	const [roomName, setRoomName] = useState('');
	const [availableRooms, setAvailableRooms] = useState<GameRoom[]>([]);
	const [isAuthChecking, setIsAuthChecking] = useState(true);

	useEffect(() => {
		const checkAuth = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) {
				navigate({ to: '/signup' });
				return;
			}
			setIsAuthChecking(false);
		};

		checkAuth();
	}, [navigate]);

	useEffect(() => {
		// Only fetch rooms if user is authenticated
		if (!isAuthChecking) {
			// Fetch available rooms
			const fetchRooms = async () => {
				const { data } = await supabase
					.from('game_rooms')
					.select('*')
					.eq('status', 'waiting')
					.order('created_at', { ascending: false });
				
				if (data) {
					setAvailableRooms(data);
				}
			};

			fetchRooms();

			// Subscribe to room changes
			const roomSubscription = supabase
				.channel('room_changes')
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'game_rooms',
					},
					() => {
						fetchRooms();
					}
				)
				.subscribe();

			return () => {
				roomSubscription.unsubscribe();
			};
		}
	}, [isAuthChecking]);

	if (isAuthChecking) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	const handleCreateRoom = async () => {
		try {
			setLoading(true);
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			const { data, error } = await supabase
				.from('game_rooms')
				.insert([
					{
						name: roomName,
						created_by: user.id,
						max_players: 4,
						current_players: 1,
						status: 'waiting'
					}
				])
				.select()
				.single();

			if (error) throw error;
			
			// Also create a game_players entry for the creator
			const { error: playerError } = await supabase
				.from('game_players')
				.insert([
					{
						game_id: data.id,
						user_id: user.id,
						player_order: 1,
						is_active: true
					}
				]);

			if (playerError) throw playerError;

			// Create initial game state
			const { error: stateError } = await supabase
				.from('game_states')
				.insert([
					{
						game_id: data.id,
						current_turn_number: 1,
						current_player_id: user.id,
						available_dice: 6,
						current_turn_score: 0
					}
				]);

			if (stateError) throw stateError;
			
			// Navigate to the room
			navigate({ to: '/room', search: { roomId: data.id } });
		} catch (error) {
			console.error('Error creating room:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleQuickPlay = async () => {
		try {
			setLoading(true);
			const { data: rooms } = await supabase
				.from('game_rooms')
				.select('*')
				.eq('status', 'waiting')
				.gt('current_players', 0)
				.lt('current_players', 'max_players')
				.limit(1)
				.single();

			if (rooms) {
				navigate({ to: '/room', search: { roomId: rooms.id } });
			} else {
				// No rooms available, create one
				handleCreateRoom();
			}
		} catch (error) {
			console.error('Error finding game:', error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex flex-col min-h-screen bg-gray-50">
			<Navbar />
			<main className="flex-1">
				<div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
					{/* Hero Section */}
					<div className="text-center mb-12">
						<h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
							Welcome to Farkle Online
						</h1>
						<p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
							Join the fun and play the classic dice game with friends online!
						</p>
					</div>

					{/* Available Rooms Section */}
					{availableRooms.length > 0 && (
						<div className="mb-12">
							<h2 className="text-2xl font-bold text-gray-900 mb-4">Available Rooms</h2>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{availableRooms.map((room) => (
									<div
										key={room.id}
										className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
									>
										<div className="px-4 py-5 sm:p-6">
											<h3 className="text-lg font-medium text-gray-900">{room.name}</h3>
											<p className="mt-1 text-sm text-gray-500">
												Players: {room.current_players}/{room.max_players}
											</p>
											<button
												onClick={() => navigate({ to: '/room', search: { roomId: room.id } })}
												className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
											>
												Join Game
											</button>
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
									{loading ? 'Finding Game...' : 'Find Game'}
								</button>
							</div>
						</div>

						{/* Create Game */}
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="px-4 py-5 sm:p-6">
								<h3 className="text-lg font-medium text-gray-900">Create Game</h3>
								{showCreateRoom ? (
									<div className="mt-2">
										<input
											type="text"
											value={roomName}
											onChange={(e) => setRoomName(e.target.value)}
											placeholder="Enter room name"
											className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
										/>
										<div className="mt-3 flex space-x-2">
											<button
												onClick={handleCreateRoom}
												disabled={!roomName || loading}
												className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
											>
												{loading ? 'Creating...' : 'Create'}
											</button>
											<button
												onClick={() => setShowCreateRoom(false)}
												disabled={loading}
												className="flex-1 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
											>
												Cancel
											</button>
										</div>
									</div>
								) : (
									<>
										<p className="mt-2 text-sm text-gray-500">
											Create a new game room and invite friends
										</p>
										<button
											onClick={() => setShowCreateRoom(true)}
											className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
										>
											Create Room
										</button>
									</>
								)}
							</div>
						</div>

						{/* Profile & Settings */}
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="px-4 py-5 sm:p-6">
								<h3 className="text-lg font-medium text-gray-900">Profile & Settings</h3>
								<p className="mt-2 text-sm text-gray-500">
									View your stats and customize game settings
								</p>
								<button
									className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
								>
									View Profile
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
										<dt className="text-sm font-medium text-gray-500">Objective</dt>
										<dd className="mt-1 text-sm text-gray-900">
											Be the first player to score 10,000 points by rolling dice and making strategic decisions.
										</dd>
									</div>
									<div>
										<dt className="text-sm font-medium text-gray-500">Scoring</dt>
										<dd className="mt-1 text-sm text-gray-900">
											• Single 1: 100 points<br />
											• Single 5: 50 points<br />
											• Three of a kind: Value × 100 (1s are worth 1000)<br />
											• Three pairs: 750 points<br />
											• Straight (1-6): 1000 points
										</dd>
									</div>
								</dl>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
};
