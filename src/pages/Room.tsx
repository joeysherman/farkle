import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/layout/navbar/Navbar";
import { Route as RoomRoute } from "../routes/room";
import { GameScene } from "../_game";
import { nanoid } from "nanoid";
import { generateRoomName } from "../utils/roomNames";
import type {
	RealtimePostgresChangesPayload,
	RealtimeChannel,
	User,
} from "@supabase/supabase-js";
import { TurnActions } from "./TurnActions";
import { PlayersList } from "../features/PlayersList";
import { RoomControls } from "../features/RoomControls";

export interface GameRoom {
	id: string;
	name: string;
	created_by: string;
	max_players: number;
	current_players: number;
	status: "waiting" | "in_progress" | "completed";
	invite_code: string;
}

export interface GamePlayer {
	id: string;
	user_id: string;
	player_order: number;
	score: number;
	is_active: boolean;
}

export interface GameState {
	game_id: string;
	current_turn_number: number;
	current_player_id: string;
	last_updated_at: string;
}

interface GameTurn {
	id: string;
	game_id: string;
	player_id: string;
	turn_number: number;
	started_at: string;
	ended_at: string | null;
	score_gained: number;
	is_farkle: boolean;
}

export interface TurnAction {
	id: string;
	turn_id: string;
	action_number: number;
	dice_values: Array<number>;
	kept_dice: Array<number>;
	score: number;
	turn_action_outcome: "bust" | "bank" | "continue" | null;
	available_dice: number;
	created_at: string;
}

// Game Actions Component
const GameActions: React.FC<{
	gameState: GameState | null;
	user: User | null;
	players: Array<GamePlayer>;
	turnActions: Array<TurnAction>;
	selectedDiceIndices: Array<number>;
	onTurnAction: (
		keptDice: Array<number>,
		outcome: "bust" | "bank" | "continue"
	) => Promise<void>;
	onRoll: (numberDice: number) => Promise<void>;
	setSelectedDiceIndices: React.Dispatch<React.SetStateAction<Array<number>>>;
}> = ({
	gameState,
	user,
	players,
	turnActions,
	selectedDiceIndices,
	onTurnAction,
	onRoll,
	setSelectedDiceIndices,
}) => {
	if (!gameState || !user) return null;

	const currentPlayer = players.find((p) => p.user_id === user.id);
	const isCurrentPlayerTurn = gameState.current_player_id === currentPlayer?.id;

	if (!isCurrentPlayerTurn) return null;

	const latestAction = turnActions[turnActions.length - 1];
	const isFarkle = latestAction?.score === 0;
	const canContinue = latestAction && !latestAction.turn_action_outcome;

	return (
		<div className="flex-none grid grid-cols-2 gap-6 py-2 px-4">
			{isFarkle && latestAction ? (
				<button
					className="col-span-2 w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-500 hover:bg-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					onClick={() => {
						if (latestAction?.kept_dice) {
							void onTurnAction(latestAction.kept_dice, "bust");
						}
					}}
				>
					End Turn
				</button>
			) : turnActions.length === 0 || latestAction?.turn_action_outcome ? (
				<button
					className="col-span-2 w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						e.target.blur();
						void onRoll(6);
					}}
				>
					Roll Dice
				</button>
			) : latestAction ? (
				<>
					<button
						className="w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
						disabled={!canContinue}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							e.target.blur();
							if (canContinue) {
								void onTurnAction(latestAction.kept_dice, "bank");
							}
						}}
					>
						Bank Score
					</button>
					<button
						className="w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
						disabled={
							!canContinue ||
							latestAction.score === 0 ||
							latestAction.available_dice <= 0
						}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							e.target.blur();
							if (canContinue) {
								const keptDice = selectedDiceIndices
									.map((index) => latestAction.dice_values[index])
									.filter(Boolean);
								const validScoringDice = latestAction.kept_dice;
								const allKeptDice = [...validScoringDice, ...keptDice];
								void onTurnAction(allKeptDice, "continue");
								setSelectedDiceIndices([]);
							}
						}}
					>
						{latestAction.available_dice === 0 &&
							latestAction.score > 0 &&
							"Hot Dice! Roll 6 dice"}
						{latestAction.available_dice > 0 &&
							latestAction.score > 0 &&
							`Roll ${latestAction.available_dice} dice`}
					</button>
				</>
			) : null}
		</div>
	);
};

function getScoringDice(
	dice_values: number[],
	kept_dice: number[]
): { number: number; isScoringNumber: boolean }[] {
	// kept_dice is the dice that were kept from the dice_values array
	// walk the dice_values array and output the dice states with number and isScoringNumber
	// then walk the kept_dice array and set the isScoringNumber to true for the first
	// occurrence of the dice value in the dice_values array where isScoringNumber is false
	// example:
	// dice_values = [4, 2, 6, 2, 6, 5]
	// kept_dice = [5]
	// output should be [
	// 	{ number: 4, isScoringNumber: false },
	// 	{ number: 2, isScoringNumber: false },
	// 	{ number: 6, isScoringNumber: false },
	// 	{ number: 2, isScoringNumber: false },
	// 	{ number: 6, isScoringNumber: false },
	// 	{ number: 5, isScoringNumber: true },
	// ]

	// Create an array of objects with number and isScoringNumber set to false
	const diceStates = dice_values.map((value) => ({
		number: value,
		isScoringNumber: false,
	}));

	// Iterate over kept_dice and update the first occurrence in diceStates
	kept_dice.forEach((kept) => {
		for (let dice of diceStates) {
			if (dice.number === kept && !dice.isScoringNumber) {
				dice.isScoringNumber = true;
				break; // Stop after the first occurrence
			}
		}
	});

	return diceStates;
}

export function Room(): JSX.Element {
	const navigate = useNavigate();
	const search = useSearch({ from: RoomRoute.id });
	const roomId = search.roomId;

	const [user, setUser] = useState<User | null>(null);

	const [room, setRoom] = useState<GameRoom | null>(null);
	const [players, setPlayers] = useState<Array<GamePlayer>>([]);
	const [gameState, setGameState] = useState<GameState | null>(null);
	const [currentTurn, setCurrentTurn] = useState<GameTurn | null>(null);
	const [turnActions, setTurnActions] = useState<Array<TurnAction>>([]);
	const [isSpinning, setIsSpinning] = useState(false);

	// Function to start dice spin
	const startSpin = (): void => {
		if (!isSpinning) {
			console.log("starting spin");
			setIsSpinning(true);
			setTimeout(() => {
				console.log("stopping spin");
				setIsSpinning(false);
			}, 2000);
		}
	};

	const [diceStates, setDiceStates] = useState([]);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedDiceIndices, setSelectedDiceIndices] = useState<Array<number>>(
		[]
	);

	// ref for the game state subscription
	const gameStateSubscriptionRef = useRef<RealtimeChannel | null>(null);
	// ref for the action subscription
	const actionSubscriptionRef = useRef<RealtimeChannel | null>(null);

	const handleStartGame = async () => {
		try {
			const { error } = await supabase.rpc("start_game", {
				room_id: roomId,
			});

			if (error) {
				console.error("Start game error:", error);
				setError("Failed to start game. Please try again.");
			}
		} catch (error_) {
			console.error("Start game error:", error_);
			setError(
				error_ instanceof Error
					? error_.message
					: "Failed to start game. Please try again."
			);
		}
	};

	const handleEndGame = async () => {
		try {
			const { error } = await supabase.rpc("end_game", {
				p_game_id: roomId,
			});

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
	// user
	useEffect(() => {
		const fetchUser = async () => {
			const {
				data: { user: authUser },
				error: authError,
			} = await supabase.auth.getUser();
			if (authError) {
				console.error("Auth error:", authError);
				return;
			}
			setUser(authUser);
		};
		void fetchUser();
	}, []);

	// room
	useEffect(() => {
		const fetchRoom = async () => {
			const { data: roomData, error: roomError } = await supabase
				.from("game_rooms")
				.select("*")
				.eq("id", roomId)
				.single();

			if (roomError) throw roomError;
			if (!roomData) {
				setError("Room not found");
				return;
			}
			setRoom(roomData as GameRoom);
		};

		void fetchRoom();
	}, []);

	// players
	useEffect(() => {
		const fetchPlayers = async () => {
			const { data: playersData, error: playersError } = await supabase
				.from("game_players")
				.select("*")
				.eq("game_id", roomId)
				.order("player_order", { ascending: true });

			if (playersError) throw playersError;
			if (!playersData) {
				setError("Players not found");
				return;
			}

			setPlayers(playersData as Array<GamePlayer>);
		};

		void fetchPlayers();
	}, []);

	// game state
	useEffect(() => {
		const fetchGameState = async () => {
			const { data: gameStateData, error: gameStateError } = await supabase
				.from("game_states")
				.select("*")
				.eq("game_id", roomId)
				.single();

			if (gameStateError) throw gameStateError;
			if (!gameStateData) {
				setError("Game state not found");
				return;
			}

			setGameState(gameStateData as GameState);
		};

		void fetchGameState();
	}, []);

	// fetch current turn based on the
	// gameState.current_turn id which is the id of the turn in the game_turns table
	useEffect(() => {
		const fetchCurrentTurn = async () => {
			// get the turn from the game_turns table based on the gameState.current_turn id
			const { data: turnData, error: turnError } = await supabase
				.from("game_turns")
				.select("*")
				.eq("id", gameState?.current_turn)
				.single();

			if (turnError) throw turnError;
			if (!turnData) {
				setError("Turn not found");
				return;
			}

			setCurrentTurn(turnData as GameTurn);
		};

		if (gameState?.current_turn) {
			void fetchCurrentTurn();
		}
	}, [gameState]);

	// turn actions
	useEffect(() => {
		const fetchTurnActions = async () => {
			const { data: actionsData, error: actionsError } = await supabase
				.from("turn_actions")
				.select("*")
				.eq("turn_id", currentTurn?.id)
				.order("action_number", { ascending: true });

			if (actionsError) throw actionsError;
			if (!actionsData) {
				setError("Turn actions not found");
				return;
			}
			setTurnActions(actionsData as Array<TurnAction>);

			// if there are actions, set the dice states to the dice values of the last action
			if (actionsData?.length > 0) {
				debugger;
				const scoringDice = getScoringDice(
					actionsData[actionsData.length - 1].dice_values,
					actionsData[actionsData.length - 1].kept_dice
				);
				// map over the scoringDice and set the key placement to the index + 1
				const scoringDiceWithPlacement = scoringDice.map((dice, index) => ({
					...dice,
					placement: index + 1,
				}));
				setDiceStates(scoringDiceWithPlacement);
			}
		};
		if (currentTurn?.id) {
			void fetchTurnActions();
		}
	}, [currentTurn]);

	useEffect(() => {
		// setup the action subscription if it's not already setup
		if (currentTurn?.id) {
			if (!actionSubscriptionRef.current) {
				actionSubscriptionRef.current = supabase
					.channel(`action_changes_${currentTurn.id}`)
					.on<TurnAction>(
						"postgres_changes" as any,
						{
							event: "INSERT",
							schema: "public",
							table: "turn_actions",
							filter: `turn_id=eq.${currentTurn.id}`,
						},
						(actionPayload: RealtimePostgresChangesPayload<TurnAction>) => {
							const newAction = actionPayload.new as TurnAction;
							if (!newAction) return;
							debugger;

							// wait 1 second, then stop the spin, then update the turn actions and dice states
							setTimeout(() => {
								setIsSpinning(false);
								// add the new action to the turn actions
								setTurnActions((previous) => [...previous, newAction]);
								// update the dice states
								// newAction.dice_values is an array of the rolled dice
								// newAction.kept_dice is an array of the dice that were kept from the previous action

								const scoringDice = getScoringDice(
									newAction.dice_values,
									newAction.kept_dice
								);

								debugger;
								setDiceStates((previous) => {
									// for each previous diceState, map the placement over to the scoringDiceWithPlacement.placement at the same index
									const newDiceStates = scoringDice.map((dice, index) => {
										// set the dice.placement to the previous[index].placement

										return {
											...dice,
											placement: previous[index]?.placement || index + 1,
										};
									});
									return newDiceStates;
								});
							}, 1000);
						}
					)
					.subscribe();
			}
		}
		return () => {
			if (actionSubscriptionRef.current) {
				console.log("unsubscribing from turn actions");
				actionSubscriptionRef.current.unsubscribe();
				actionSubscriptionRef.current = null;
			}
		};
	}, [currentTurn]);

	// game turn

	// react to the game state changes
	// if the game_state.current_turn changes, we need to update the current turn
	useEffect(() => {
		if (!gameStateSubscriptionRef.current && roomId) {
			gameStateSubscriptionRef.current = supabase
				.channel("game_state_changes")
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "game_states",
						filter: `game_id=eq.${roomId}`,
					},
					(payload) => {
						setGameState(payload.new as GameState);
					}
				)
				.subscribe();
		}
		return () => {
			if (gameStateSubscriptionRef.current) {
				console.log("unsubscribing from game state");
				gameStateSubscriptionRef.current.unsubscribe();
				gameStateSubscriptionRef.current = null;
			}
		};
	}, [roomId]);

	// Add the handleTurnAction function near other handlers
	const handleTurnAction = async (
		keptDice: Array<number>,
		outcome: "bust" | "bank" | "continue"
	) => {
		if (!roomId) return;

		try {
			const latestAction = turnActions[turnActions.length - 1];
			if (!latestAction) return;
			// filter out the diceStates where isScoringNumber is true
			const leftOverDice = diceStates.filter((dice) => !dice.isScoringNumber);

			const { error } = await supabase.rpc("process_turn_action", {
				p_game_id: roomId,
				p_outcome: outcome,
			});

			if (error) throw error;

			// Reset states if the turn is ending (bank or bust)
			if (outcome === "bank" || outcome === "bust") {
				setCurrentTurn(null);
				setTurnActions([]);
				setDiceStates([]);
				// setSelectedDiceIndices([]);
				// setDiceValues([
				// 	{ number: 1 },
				// 	{ number: 2 },
				// 	{ number: 3 },
				// 	{ number: 4 },
				// 	{ number: 5 },
				// 	{ number: 6 },
				// ]); // Reset dice values to initial state
			} else if (outcome === "continue") {
				// set the diceStates to the leftOverDice
				setDiceStates(leftOverDice);
				if (!isSpinning) {
					console.log("starting spin 1");
					startSpin();
				}
			}
		} catch (error_) {
			setError(
				error_ instanceof Error
					? error_.message
					: "Failed to process turn action"
			);
		}
	};

	// Add roll handler
	const handleRoll = async (numberDice: number = 6) => {
		try {
			const { data: rollResults, error } = await supabase.rpc("perform_roll", {
				p_game_id: roomId,
				p_num_dice: numberDice,
			});

			if (error) {
				console.error("Roll error:", error);
				setError(error.message);
				return;
			}

			console.log("Roll results:", rollResults);

			// Update dice values for the scene

			//setDiceValues(rollResults.map((value: number) => ({ number: value })));
			// Trigger the roll animation for each die
			// rollResults.forEach((value: number, index: number) => {
			// 	sceneRef.current?.roll(index, value);
			// });
		} catch (error_) {
			console.error("Roll error:", error_);
			setError(
				error_ instanceof Error ? error_.message : "Failed to roll dice"
			);
		}
	};

	// useEffect(() => {
	// 	const checkAuth = async () => {
	// 		const {
	// 			data: { user: authUser },
	// 			error: authError,
	// 		} = await supabase.auth.getUser();
	// 		if (authError) {
	// 			console.error("Auth error:", authError);
	// 			return;
	// 		}
	// 		setUser(authUser);

	// 		if (!roomId) {
	// 			setLoading(false);
	// 			return;
	// 		}

	// 		try {
	// 			// Fetch room details
	// 			const { data: roomData, error: roomError } = await supabase
	// 				.from("game_rooms")
	// 				.select("*")
	// 				.eq("id", roomId)
	// 				.single();

	// 			if (roomError) throw roomError;
	// 			if (!roomData) {
	// 				setError("Room not found");
	// 				return;
	// 			}

	// 			setRoom(roomData as GameRoom);

	// 			// Always fetch players in the room
	// 			const { data: playersData, error: playersError } = await supabase
	// 				.from("game_players")
	// 				.select("*")
	// 				.eq("game_id", roomId)
	// 				.order("player_order", { ascending: true });

	// 			if (playersError) throw playersError;
	// 			setPlayers((playersData as Array<GamePlayer>) || []);

	// 			// Check if user is already a player in the room or is the creator
	// 			const isCreator = authUser?.id === roomData.created_by;
	// 			const isPlayer = playersData?.some(
	// 				(player) => player.user_id === authUser?.id
	// 			);

	// 			// Only show invite modal if user is not a player and not the creator
	// 			if (!isCreator && !isPlayer) {
	// 				setShowInviteModal(true);
	// 			}

	// 			// Fetch game state if user is a player or creator
	// 			if (isPlayer || isCreator) {
	// 				const { data: gameStateData, error: gameStateError } = await supabase
	// 					.from("game_states")
	// 					.select("*")
	// 					.eq("game_id", roomId)
	// 					.single();

	// 				if (gameStateError && gameStateError.code !== "PGRST116")
	// 					throw gameStateError;
	// 				setGameState((gameStateData as GameState) || null);

	// 				// Fetch current turn and actions if game is in progress
	// 				if (
	// 					gameStateData &&
	// 					(roomData as GameRoom).status === "in_progress"
	// 				) {
	// 					const { data: turnData, error: turnError } = await supabase
	// 						.from("game_turns")
	// 						.select("*")
	// 						.eq("game_id", roomId)
	// 						.eq("turn_number", gameStateData.current_turn_number)
	// 						.single();

	// 					if (!turnError) {
	// 						setCurrentTurn(turnData as GameTurn);

	// 						if (turnData) {
	// 							const { data: actionsData } = await supabase
	// 								.from("turn_actions")
	// 								.select("*")
	// 								.eq("turn_id", turnData.id)
	// 								.order("action_number", { ascending: true });

	// 							if (actionsData) {
	// 								setTurnActions(actionsData as Array<TurnAction>);
	// 								// Set the dice values to the newest action
	// 								// if there are no actions, set the dice values to the initial state
	// 								if (actionsData.length > 0) {
	// 									setDiceValues(
	// 										actionsData[actionsData.length - 1].dice_values.map(
	// 											(value: number) => ({ number: value })
	// 										)
	// 									);
	// 								} else {
	// 									setDiceValues([
	// 										{ number: 1 },
	// 										{ number: 2 },
	// 										{ number: 3 },
	// 										{ number: 4 },
	// 										{ number: 5 },
	// 										{ number: 6 },
	// 									]);
	// 								}
	// 							}
	// 						}
	// 					}
	// 				}
	// 			}
	// 		} catch (error_) {
	// 			setError(
	// 				error_ instanceof Error ? error_.message : "An error occurred"
	// 			);
	// 		} finally {
	// 			setLoading(false);
	// 		}
	// 	};

	// 	void checkAuth();

	// 	if (roomId) {
	// 		// Set up real-time subscriptions
	// 		const roomSubscription = supabase
	// 			.channel("room_changes")
	// 			.on(
	// 				"postgres_changes",
	// 				{
	// 					event: "*",
	// 					schema: "public",
	// 					table: "game_rooms",
	// 					filter: `id=eq.${roomId}`,
	// 				},
	// 				(payload) => {
	// 					setRoom(payload.new as GameRoom);
	// 				}
	// 			)
	// 			.subscribe();

	// 		const playersSubscription = supabase
	// 			.channel("player_changes")
	// 			.on(
	// 				"postgres_changes",
	// 				{
	// 					event: "*",
	// 					schema: "public",
	// 					table: "game_players",
	// 					filter: `game_id=eq.${roomId}`,
	// 				},
	// 				() => {
	// 					// Refresh players list when there are changes
	// 					supabase
	// 						.from("game_players")
	// 						.select("*")
	// 						.eq("game_id", roomId)
	// 						.order("player_order", { ascending: true })
	// 						.then(({ data }) => {
	// 							if (data) setPlayers(data);
	// 						});
	// 				}
	// 			)
	// 			.subscribe();

	// 		const gameStateSubscription = supabase
	// 			.channel("game_state_changes")
	// 			.on(
	// 				"postgres_changes",
	// 				{
	// 					event: "*",
	// 					schema: "public",
	// 					table: "game_states",
	// 					filter: `game_id=eq.${roomId}`,
	// 				},
	// 				(payload) => {
	// 					setGameState(payload.new as GameState);
	// 				}
	// 			)
	// 			.subscribe();

	// 		return () => {
	// 			roomSubscription.unsubscribe();
	// 			playersSubscription.unsubscribe();
	// 			gameStateSubscription.unsubscribe();
	// 		};
	// 	}
	// }, [roomId, navigate]);

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50">
				<Navbar />
				<div className="flex items-center justify-center h-[calc(100vh-64px)]">
					<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<Navbar />
			<main className="max-w-[1600px] mx-auto h-[calc(100vh-64px)]">
				<div className="flex flex-col md:flex-row md:space-x-4 h-full p-2 sm:p-4">
					{/* Left Column - Room Details */}
					<div className="w-full h-[calc(50vh-64px)] md:h-full md:w-1/4 mb-4 md:mb-0 overflow-y-auto">
						<div className="bg-white shadow rounded-lg h-full flex flex-col">
							{/* Room Header */}
							{room && user && (
								<RoomHeader room={room} user={user}>
									<RoomControls
										room={room}
										user={user}
										onStartGame={handleStartGame}
										onEndGame={handleEndGame}
										//onShowInvite={() => setShowInviteModal(true)}
									/>
								</RoomHeader>
							)}

							{/* Players List */}
							<div className="flex-1 overflow-y-auto p-4">
								{players && gameState && user && room && (
									<PlayersList
										players={players}
										gameState={gameState}
										user={user}
										room={room}
									/>
								)}
							</div>
						</div>
					</div>

					{/* Right Column - Game Canvas */}
					<div className="w-full h-[calc(50vh-64px)] md:h-full md:w-3/4">
						<div className="bg-white shadow rounded-lg h-full flex flex-col">
							<div className="h-full p-2 flex flex-col">
								{players && turnActions && user && gameState && room && (
									<TurnSummary
										players={players}
										turnActions={turnActions}
										user={user}
										gameState={gameState}
										room={room}
									/>
								)}
								{gameState &&
									user &&
									players &&
									turnActions &&
									room?.status === "in_progress" && (
										<GameActions
											gameState={gameState}
											user={user}
											players={players}
											turnActions={turnActions}
											selectedDiceIndices={[]}
											onTurnAction={handleTurnAction}
											onRoll={() => {
												setDiceStates([
													{ number: 6, placement: 1, isScoringNumber: true },
													{ number: 2, placement: 2, isScoringNumber: false },
													{ number: 3, placement: 3, isScoringNumber: false },
													{ number: 4, placement: 4, isScoringNumber: false },
													{ number: 5, placement: 5, isScoringNumber: false },
													{ number: 6, placement: 6, isScoringNumber: true },
												]);

												if (!isSpinning) {
													console.log("starting spin 2");
													startSpin();
												}
												handleRoll();
											}}
											setSelectedDiceIndices={() => {}}
										/>
									)}

								<TurnActions turnActions={turnActions} room={room} />
								<div
									className="min-h-0 bg-gray-50 rounded-lg overflow-hidden"
									style={{ flex: "1.5 1 0%" }}
								>
									<GameScene
										diceStates={diceStates}
										isSpinning={isSpinning}
										selectedDiceIndices={selectedDiceIndices}
										setSelectedDiceIndices={setSelectedDiceIndices}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
function RoomHeader({
	room,
	user,
	children,
}: {
	room: GameRoom;
	user: User;
	children: React.ReactNode;
}) {
	return (
		<div className="p-4 border-b border-gray-200">
			<div className="flex flex-col justify-between gap-4">
				<div className="flex items-center space-x-3">
					<h2 className="text-2xl font-bold text-gray-900 truncate">
						{room.name}
					</h2>
				</div>
				<div className="flex items-center justify-between text-sm text-gray-500 gap-2">
					<span
						className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
							room.status === "waiting"
								? "bg-yellow-100 text-yellow-800"
								: room.status === "in_progress"
									? "bg-green-100 text-green-800"
									: "bg-gray-100 text-gray-800"
						}`}
					>
						{room.status === "waiting"
							? "Waiting"
							: room.status === "in_progress"
								? "In Progress"
								: "Completed"}
					</span>
					<span className="font-medium ml-1">
						Players: {room.current_players}/{room.max_players}
					</span>
				</div>
			</div>

			{children}
		</div>
	);
}

function TurnSummary({
	players,
	turnActions,
	user,
	gameState,
	room,
}: {
	turnActions: TurnAction[];
	user: User;
	gameState: GameState;
	room: GameRoom;
}) {
	// Calculate total score for the current turn
	const currentTurnScore = turnActions.reduce(
		(total, action) => total + action.score,
		0
	);

	// Get current player from the game state
	const isCurrentTurn = players.find(
		(player) => player.id === gameState.current_player_id
	);
	const isCurrentUser = players.find((player) => player.user_id === user.id);

	debugger;
	return (
		<div className="bg-gray-50 rounded-lg px-4 py-2">
			<div className="flex items-baseline mb-2">
				<div className="flex flex-col">
					<h3 className="text-lg font-semibold">
						Turn {gameState.current_turn_number}
					</h3>
					<div className="">
						<p className="text-sm text-gray-500 italic">
							Roll {turnActions.length}
						</p>
					</div>
				</div>
				<div className="ml-auto flex flex-col items-end">
					<p className="text-sm text-gray-500 italic">Roll Score:</p>
					<p className="text-xl font-bold text-green-600">
						+{currentTurnScore}
					</p>
				</div>
			</div>
		</div>
	);
}
