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
	RealtimePresenceState,
} from "@supabase/supabase-js";
import { TurnActions } from "./TurnActions";
import { PlayersList } from "../features/PlayersList";
import { RoomControls } from "../features/RoomControls";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GameActions } from "./GameActions";
import { useUser } from "../services/user";
import { InviteModal } from "../features/InviteModal";
import { RoomSettingsDialog } from "../features/RoomSettingsDialog";

export interface GameRoom {
	id: string;
	name: string;
	created_by: string;
	max_players: number;
	current_players: number;
	status: "waiting" | "in_progress" | "completed";
	invite_code: string;
	table_model?: "boxing_ring" | "coliseum" | "poker_table";
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
	diceStates: Array<{ number: number; isScoringNumber: boolean }>;
	isSpinning: boolean;
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
	scoring_dice: Array<number>;
	score: number;
	turn_action_outcome: "bust" | "bank" | "continue" | null;
	available_dice: number;
	created_at: string;
}

function getScoringDice(
	dice_values: number[],
	scoring_dice: number[]
): { number: number; isScoringNumber: boolean }[] {
	// scoring_dice is the dice that were kept from the dice_values array
	// walk the dice_values array and output the dice states with number and isScoringNumber
	// then walk the scoring_dice array and set the isScoringNumber to true for the first
	// occurrence of the dice value in the dice_values array where isScoringNumber is false
	// example:
	// dice_values = [4, 2, 6, 2, 6, 5]
	// scoring_dice = [5]
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

	// Iterate over scoring_dice and update the first occurrence in diceStates
	scoring_dice.forEach((kept) => {
		for (let dice of diceStates) {
			if (dice.number === kept && !dice.isScoringNumber) {
				dice.isScoringNumber = true;
				break; // Stop after the first occurrence
			}
		}
	});

	return diceStates;
}

const updateTurnActions = async (
	data: number[],
	currentTurnActionId: string
) => {
	const { error } = await supabase.rpc("select_dice", {
		turn_action_id: currentTurnActionId,
		dice: data,
	});
	if (error) {
		console.error("Error updating turn actions:", error);
	}
};

export function Room(): JSX.Element {
	const navigate = useNavigate();
	const search = useSearch({ from: RoomRoute.id });
	const roomId = search.roomId;

	const [user, setUser] = useState<User | null>(null);
	const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

	const [room, setRoom] = useState<GameRoom | null>(null);
	const [players, setPlayers] = useState<Array<GamePlayer>>([]);
	const [gameState, setGameState] = useState<GameState | null>(null);
	const [currentTurn, setCurrentTurn] = useState<GameTurn | null>(null);
	const [showSettingsDialog, setShowSettingsDialog] = useState(false);

	const [isCurrentPlayerTurn, setIsCurrentPlayerTurn] = useState(false);

	const [turnActions, setTurnActions] = useState<Array<TurnAction>>([]);
	const [isSpinning, setIsSpinning] = useState(false);

	const { mutate: handleTurnAction, isPending } = useHandleTurnAction();

	const [copied, setCopied] = useState(false);
	const [showInviteModal, setShowInviteModal] = useState(false);

	const [localUsername, setLocalUsername] = useState("");
	const [countdown, setCountdown] = useState(5);

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

	// update the turn_actions.selected_dice with the indices in supabase

	// update the turn_actions

	// ref for the game room subscription
	const gameRoomSubscriptionRef = useRef<RealtimeChannel | null>(null);
	// ref for the game state subscription
	const gameStateSubscriptionRef = useRef<RealtimeChannel | null>(null);
	// ref for the action subscription
	const actionSubscriptionRef = useRef<RealtimeChannel | null>(null);
	// ref for the players subscription
	const playerSubscriptionRef = useRef<RealtimeChannel | null>(null);

	const [showSidebar, setShowSidebar] = useState(false);

	// ref for presence subscription
	const presenceSubscriptionRef = useRef<RealtimeChannel | null>(null);

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

	const handleJoinWithCode = async (code: string, username: string) => {
		try {
			if (!username.trim() && !user) {
				setError("Please enter a username");
				return;
			}

			let userId = user?.id;

			// If no user, create an anonymous one
			if (!userId) {
				// First sign up the user
				const { data: signUpData, error: signUpError } =
					await supabase.auth.signUp({
						email: `${nanoid(10)}@anonymous.farkle.com`,
						password: nanoid(12),
					});

				if (signUpError) {
					console.error("Sign up error:", signUpError);
					throw new Error("Failed to create anonymous user");
				}

				if (!signUpData.user?.id) {
					throw new Error("No user ID returned from sign up");
				}

				userId = signUpData.user.id;

				// Wait a moment for the auth to propagate
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Create profile for anonymous user
				const { error: profileError } = await supabase.from("profiles").insert([
					{
						id: userId,
						username: username,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				]);

				if (profileError) {
					console.error("Profile creation error:", profileError);
					throw new Error("Failed to create user profile");
				}

				// Set the user in state
				setUser(signUpData.user);
			}

			// Verify the invite code and join the game
			const { error: joinError } = await supabase.rpc("join_game", {
				room_id: roomId,
				code: code,
			});

			if (joinError) {
				console.error("Join game error:", joinError);
				throw new Error(joinError.message);
			}

			// Reload the room data after joining
			const { data: roomData, error: roomError } = await supabase
				.from("game_rooms")
				.select("*")
				.eq("id", roomId)
				.single();

			if (roomError) {
				console.error("Room fetch error:", roomError);
				throw new Error("Failed to fetch room data");
			}
			debugger;
			setRoom(roomData);

			// Fetch updated players list
			const { data: playersData, error: playersError } = await supabase
				.from("game_players")
				.select("*")
				.eq("game_id", roomId)
				.order("player_order", { ascending: true });

			if (playersError) {
				console.error("Players fetch error:", playersError);
				throw new Error("Failed to fetch players data");
			}

			setPlayers(playersData || []);
			setShowInviteModal(false);
			setError(null); // Clear any existing errors
		} catch (err) {
			console.error("Join game error:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to join game. Please try again."
			);
		}
	};

	// find the player in the players array that has the same user_id as the user.id
	// then if the gameState.current_player_id is the same as the player.id, set the isCurrentPlayerTurn to true
	useEffect(() => {
		const player = players.find((player) => player.user_id === user?.id);
		if (player && gameState?.current_player_id === player.id) {
			setIsCurrentPlayerTurn(true);
		} else {
			setIsCurrentPlayerTurn(false);
		}
	}, [players, gameState, user]);

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
			const {
				data: roomData,
				error: roomError,
				...rest
			} = await supabase
				.from("game_rooms")
				.select("*")
				.eq("id", roomId)
				.single();

			if (roomError) throw roomError;
			if (!roomData) {
				setError("Room not found");
				return;
			}
			debugger;
			setRoom(roomData as GameRoom);

			// Show settings dialog if user is the creator and table_model is not set
			if (roomData.created_by === user?.id && roomData?.status === "settings") {
				setShowSettingsDialog(true);
			}
		};

		void fetchRoom();
	}, [roomId, user]);

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
				.maybeSingle();

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
			// get the latest action
			const latestAction = actionsData[actionsData.length - 1];
			// get the selected_dice from the latest action
			const selectedDice = latestAction?.selected_dice;

			// if there are selected dice, set the selectedDiceIndices to the selected_dice
			if (selectedDice) {
				setSelectedDiceIndices(selectedDice);
			}

			// if there are actions, set the dice states to the dice values of the last action
			if (actionsData?.length > 0) {
				const scoringDice = getScoringDice(
					actionsData[actionsData.length - 1].dice_values,
					actionsData[actionsData.length - 1].scoring_dice
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
		if (user && players?.length > 0 && !showInviteModal) {
			const isPlayer = players?.some((player) => player.user_id === user?.id);
			if (!isPlayer) {
				setShowInviteModal(true);
			}
		}
	}, [user, players, showInviteModal]);

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

							// set the selectedDiceIndices to empty array
							setSelectedDiceIndices([]);
							// wait 1 second, then stop the spin, then update the turn actions and dice states
							setTimeout(() => {
								setIsSpinning(false);
								// add the new action to the turn actions
								setTurnActions((previous) => {
									return [...previous, newAction];
								});
								// update the dice states
								// newAction.dice_values is an array of the rolled dice
								// newAction.scoring_dice is an array of the dice that were kept from the previous action

								const scoringDice = getScoringDice(
									newAction.dice_values,
									newAction.scoring_dice
								);

								setDiceStates((previous) => {
									// for each previous diceState, map the placement over to the scoringDiceWithPlacement.placement at the same index
									const newDiceStates = scoringDice.map((dice, index) => {
										// set the dice.placement to the previous[index].placement

										return {
											...dice,
											placement: index + 1,
										};
									});
									return newDiceStates;
								});
								// set the selectedDiceIndices to the selected_dice from the newAction
							}, 1000);
						}
					)
					// listen for the update event on the turn_actions table
					// where the selected_dice changes
					.on<TurnAction>(
						"postgres_changes" as any,
						{
							event: "UPDATE",
							schema: "public",
							table: "turn_actions",
							filter: `turn_id=eq.${currentTurn.id}`,
						},
						(payload) => {
							const updatedAction = payload.new as TurnAction;

							// if updatedAction.outcome is continue, then we don't do anything
							if (updatedAction.outcome === "continue") {
								return;
							}

							// replace the turn action where the id is the same as the payload.new.id
							setTurnActions((previous) =>
								previous.map((action) =>
									action.id === updatedAction.id ? updatedAction : action
								)
							);

							// set the selectedDiceIndices with the payload.new.selected_dice
							// if it exists and is an array
							if (
								payload.new.selected_dice &&
								Array.isArray(payload.new.selected_dice)
							) {
								setSelectedDiceIndices(payload.new.selected_dice);
							}
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
	}, [currentTurn, turnActions, diceStates, selectedDiceIndices]);

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

	// react to the game_players changes
	useEffect(() => {
		if (!playerSubscriptionRef.current && roomId) {
			playerSubscriptionRef.current = supabase
				.channel("player_changes")
				.on(
					"postgres_changes",
					{
						select: "score",
						event: "UPDATE",
						schema: "public",
						table: "game_players",
						filter: `game_id=eq.${roomId}`,
					},
					(payload) => {
						// find the player in the players array that has the same id
						// as the payload.new.id and replace the data with the payload.new
						setPlayers((previous) => {
							const playerIndex = previous.findIndex(
								(player) => player.id === payload.new.id
							);
							if (playerIndex !== -1) {
								previous[playerIndex] = payload.new as GamePlayer;
							}
							return previous;
						});
					}
				)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "game_players",
						filter: `game_id=eq.${roomId}`,
					},
					(payload) => {
						setPlayers((previous) => [...previous, payload.new as GamePlayer]);
					}
				)
				.subscribe();
		}
		return () => {
			if (playerSubscriptionRef.current) {
				console.log("unsubscribing from players changes");
				playerSubscriptionRef.current.unsubscribe();
				playerSubscriptionRef.current = null;
			}
		};
	}, [roomId]);

	// react to the game_players changes
	useEffect(() => {
		if (!gameRoomSubscriptionRef.current && roomId) {
			gameRoomSubscriptionRef.current = supabase
				.channel("game_room_changes")
				.on(
					"postgres_changes",
					{
						select: "*",
						event: "UPDATE",
						schema: "public",
						table: "game_rooms",
						filter: `id=eq.${roomId}`,
					},
					(payload) => {
						// find the player in the players array that has the same id
						// as the payload.new.id and replace the data with the payload.new
						debugger;
						setRoom(payload.new as GameRoom);
					}
				)
				.subscribe();
		}
		return () => {
			if (gameRoomSubscriptionRef.current) {
				console.log("unsubscribing from game room changes");
				gameRoomSubscriptionRef.current.unsubscribe();
				gameRoomSubscriptionRef.current = null;
			}
		};
	}, [roomId]);

	// Setup presence subscription
	useEffect(() => {
		if (user && roomId && !presenceSubscriptionRef.current) {
			// Create a presence subscription for this room
			// Create a presence subscription for this room
			const presenceChannel = supabase.channel(`room:${roomId}`, {
				config: {
					presence: {
						key: user.id,
					},
				},
			});

			// Handle presence state changes
			presenceChannel
				.on("presence", { event: "sync" }, () => {
					const state = presenceChannel.presenceState();
					console.log("Presence state:", state);
					// always make sure it's a new object
					// update the game_players table to set is_active to true for each key in the state which is the user_id

					const keys = Object.keys(state);
					// keys.forEach((key) => {
					//
					// 	supabase
					// 		.from("game_players")
					// 		.update({ is_active: true })
					// 		.eq("user_id", key);
					// });
					setOnlineUsers(Object.assign({}, state));
				})
				.on("presence", { event: "join" }, async ({ key, newPresences }) => {
					console.log("User joined:", key, newPresences);
					await supabase
						.from("game_players")
						.update({ is_active: true })
						.eq("user_id", key);
					// setOnlineUsers((prev) => ({
					// 	...prev,
					// 	[key]: newPresences[0],
					// }));
				})
				.on("presence", { event: "leave" }, async ({ key }) => {
					console.log("User left:", key);
					// setOnlineUsers((prev) => {
					// 	const newState = { ...prev };
					// 	delete newState[key];
					// 	return newState;
					// });

					await supabase
						.from("game_players")
						.update({ is_active: false })
						.eq("user_id", key);
				});

			// Subscribe to the channel and track presence
			presenceChannel.subscribe(async (status) => {
				if (status === "SUBSCRIBED") {
					console.log("tracking presence");
					await presenceChannel.track({
						user_id: user.id,
						online_at: new Date().toISOString(),
					});
				}
			});

			presenceSubscriptionRef.current = presenceChannel;
		}
		// Cleanup function
		return async () => {
			if (presenceSubscriptionRef.current) {
				console.log("unsubscribing from presence");
				await presenceSubscriptionRef.current.untrack();

				presenceSubscriptionRef.current = null;
			}
		};
	}, [user, roomId]);

	const copyInviteLink = async (): Promise<void> => {
		const url = `${window.location.origin}/room?roomId=${roomId}`;
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => {
			setCopied(false);
		}, 2000);
	};

	// Add roll handler
	const handleRoll = async (numberDice: number = 6): Promise<void> => {
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
		} catch (error_) {
			console.error("Roll error:", error_);
			setError(
				error_ instanceof Error ? error_.message : "Failed to roll dice"
			);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="flex items-center justify-center h-[calc(100vh-64px)]">
					<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin"></div>
				</div>
			</div>
		);
	}

	// Show invite modal for users who need to join
	if (showInviteModal) {
		debugger;
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="flex items-center justify-center h-[calc(100vh-64px)]">
					<InviteModal
						room={room}
						user={user}
						roomId={roomId}
						localUsername={localUsername}
						setLocalUsername={setLocalUsername}
						handleJoinWithCode={handleJoinWithCode}
						copyInviteLink={copyInviteLink}
						copied={copied}
						onClose={() => setShowInviteModal(false)}
					/>
				</div>
			</div>
		);
	}

	return (
		<main className="max-w-[1600px] mx-auto h-[calc(100vh-104px)] sm:h-[calc(100vh-64px)] overflow-hidden">
			{showSettingsDialog && (
				<RoomSettingsDialog
					roomId={roomId}
					onClose={() => setShowSettingsDialog(false)}
				/>
			)}
			<div className="flex flex-col md:flex-row md:space-x-4 h-full">
				{/* Left Column - Room Details (Hidden on mobile) */}
				<div className="hidden md:relative md:block md:w-1/4 md:h-full">
					<div className="h-full flex flex-col bg-white shadow-lg md:shadow-none">
						{room && user && (
							<RoomHeader room={room} user={user}>
								<div className="hidden md:block">
									<RoomControls
										room={room}
										user={user}
										onStartGame={handleStartGame}
										onEndGame={handleEndGame}
										onShowInvite={() => setShowInviteModal(true)}
									/>
								</div>
							</RoomHeader>
						)}
						<div className="flex-1 overflow-y-auto p-4">
							{players && gameState && user && room && onlineUsers && (
								<PlayersList
									players={players}
									gameState={gameState}
									user={user}
									room={room}
									onlineUsers={onlineUsers}
									turnSummary={
										players.length > 0 &&
										turnActions &&
										gameState?.current_player_id &&
										room?.status === "in_progress" ? (
											<MobileTurnSummary
												room={room}
												isCurrentPlayerTurn={isCurrentPlayerTurn}
												players={players}
												currentPlayer={players.find(
													(player) => player.id === gameState.current_player_id
												)}
												turnActions={turnActions}
												gameState={gameState}
											/>
										) : room?.status === "rebuttal" &&
										  room?.winner_id &&
										  players?.length > 0 ? (
											<MobileShowWinner room={room} players={players} />
										) : null
									}
								/>
							)}
						</div>
					</div>
				</div>

				{/* Right Column - Game Canvas */}
				<div className="flex-1 flex flex-col h-[calc(100vh-104px)] md:h-full md:w-3/4">
					<div className="flex-1 relative">
						{/* Game Controls Overlay */}
						<div className="absolute top-0 left-0 right-0 z-10 p-2">
							<div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1">
								<div className="flex flex-col">
									{/* Mobile Room Controls and Players List */}
									<div className="md:hidden">
										{room && user && (
											<div className="flex flex-col gap-3">
												{/* Mobile Room Controls */}
												{room?.status === "waiting" && (
													<RoomControls
														room={room}
														user={user}
														onStartGame={handleStartGame}
														onEndGame={handleEndGame}
														onShowInvite={() => setShowInviteModal(true)}
													/>
												)}
												{/* Mobile Players List */}
												<div className="rounded-lg p-1">
													{players &&
														gameState &&
														user &&
														room &&
														onlineUsers && (
															<PlayersList
																players={players}
																gameState={gameState}
																user={user}
																room={room}
																onlineUsers={onlineUsers}
																turnSummary={
																	players.length > 0 &&
																	turnActions &&
																	gameState?.current_player_id &&
																	room?.status === "in_progress" ? (
																		<MobileTurnSummary
																			room={room}
																			isCurrentPlayerTurn={isCurrentPlayerTurn}
																			players={players}
																			currentPlayer={players.find(
																				(player) =>
																					player.id ===
																					gameState.current_player_id
																			)}
																			turnActions={turnActions}
																			gameState={gameState}
																		/>
																	) : room?.status === "rebuttal" &&
																	  room?.winner_id &&
																	  players?.length > 0 ? (
																		<MobileShowWinner
																			room={room}
																			players={players}
																		/>
																	) : null
																}
															/>
														)}
												</div>
											</div>
										)}
									</div>

									{/* Turn Summary Section */}
									<div className="flex flex-col gap-3">
										{room?.status === "rebuttal" &&
											room?.winner_id &&
											players?.length > 0 && (
												<div className="flex-1">
													<ShowWinner room={room} players={players} />
												</div>
											)}
										{players.length > 0 &&
											turnActions &&
											gameState?.current_player_id &&
											room?.status === "in_progress" && (
												<div className="hidden md:block">
													<TurnSummary
														room={room}
														isCurrentPlayerTurn={isCurrentPlayerTurn}
														players={players}
														currentPlayer={players.find(
															(player) =>
																player.id === gameState.current_player_id
														)}
														turnActions={turnActions}
														gameState={gameState}
													/>
												</div>
											)}
									</div>

									{/* Turn Actions History */}
									{room?.status === "in_progress" && (
										<div className="px-1">
											<TurnActions
												isCurrentPlayerTurn={isCurrentPlayerTurn}
												turnActions={turnActions}
												room={room}
											/>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Absolute section at the bottom of the screen for the GameActions */}
						<div className="absolute bottom-0 left-0 right-0 z-10 px-2">
							<div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md">
								<div className="flex flex-col">
									{/* Game Actions */}
									<div className="flex items-center justify-center">
										{gameState &&
											user &&
											players &&
											turnActions &&
											(room?.status === "in_progress" ||
												room?.status === "rebuttal") && (
												<GameActions
													gameState={gameState}
													user={user}
													players={players}
													isPending={isPending || isSpinning}
													turnActions={turnActions}
													selectedDiceIndices={selectedDiceIndices}
													onTurnAction={(keptDice, outcome) => {
														const latestAction =
															turnActions[turnActions.length - 1];
														if (!latestAction) return;
														let leftOverDice = [];
														if (outcome === "continue") {
															if (selectedDiceIndices.length > 0) {
																leftOverDice = diceStates.filter(
																	(dice) =>
																		!selectedDiceIndices.includes(
																			dice.placement - 1
																		)
																);
															} else {
																leftOverDice = diceStates.filter(
																	(dice) => !dice.isScoringNumber
																);
															}
															setDiceStates(leftOverDice);
															startSpin();
														} else {
															setDiceStates([]);
														}
														handleTurnAction({
															roomId: roomId,
															outcome,
															keptDice,
														});
													}}
													onRoll={() => {
														setDiceStates([
															{
																number: 6,
																placement: 1,
																isScoringNumber: true,
															},
															{
																number: 2,
																placement: 2,
																isScoringNumber: false,
															},
															{
																number: 3,
																placement: 3,
																isScoringNumber: false,
															},
															{
																number: 4,
																placement: 4,
																isScoringNumber: false,
															},
															{
																number: 5,
																placement: 5,
																isScoringNumber: false,
															},
															{
																number: 6,
																placement: 6,
																isScoringNumber: true,
															},
														]);
														if (!isSpinning) {
															startSpin();
														}
														handleRoll();
														setSelectedDiceIndices([]);
													}}
													setSelectedDiceIndices={() => {}}
												/>
											)}
									</div>
								</div>
							</div>
						</div>

						{/* Game Scene */}
						<div className="h-full">
							{room &&
								(room?.status === "waiting" ||
									room?.status === "in_progress") && (
									<GameScene
										isCurrentPlayerTurn={isCurrentPlayerTurn}
										diceStates={diceStates}
										isSpinning={isSpinning}
										selectedDiceIndices={selectedDiceIndices}
										setSelectedDiceIndices={(e) => {
											updateTurnActions(
												e,
												turnActions[turnActions.length - 1]?.id
											);
										}}
										tableModel={room?.table_model || "boxing_ring"}
									/>
								)}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}

const useHandleTurnAction = () => {
	return useMutation({
		mutationFn: async (props) => {
			const { roomId, outcome } = props;

			const { error } = await supabase.rpc("process_turn_action", {
				p_game_id: roomId,
				p_outcome: outcome,
			});
			return data;
		},
	});
};

function RoomHeader({
	room,
	user,
	children,
}: {
	room: GameRoom;
	user: User;
	children: React.ReactNode;
}) {
	let status = "";
	if (room?.status === "waiting") {
		status = "Waiting";
	} else if (room?.status === "in_progress") {
		status = "In Progress";
	} else if (room?.status === "completed") {
		status = "Completed";
	} else if (room?.status === "rebuttal") {
		status = "Rebuttal";
	}

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
							room?.status === "waiting"
								? "bg-yellow-100 text-yellow-800"
								: room?.status === "in_progress"
									? "bg-green-100 text-green-800"
									: "bg-gray-100 text-gray-800"
						}`}
					>
						{status}
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
	room,
	players,
	currentPlayer,
	turnActions,
	gameState,
	isCurrentPlayerTurn,
}: {
	room: GameRoom;
	currentPlayer: GamePlayer;
	turnActions: TurnAction[];
	players: GamePlayer[];
	gameState: GameState;
	isCurrentPlayerTurn: boolean;
}) {
	const { data: userData, isLoading: userLoading } = useUser(
		currentPlayer.user_id
	);
	// Calculate total score for the current turn
	const currentTurnScore = turnActions.reduce(
		(total, action) => total + action.score,
		0
	);

	// get the latest turn action if there are any
	const latestTurnAction = turnActions[turnActions.length - 1];
	const isFarkle = latestTurnAction?.score === 0;

	if (userLoading || !userData) {
		return <div>Loading...</div>;
	}

	return (
		<div className="bg-gray-50/90 backdrop-blur-sm rounded-lg px-2 py-2 sm:px-4 sm:py-3 shadow-sm">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 sm:gap-3">
					<div className="relative">
						<img
							alt="User avatar"
							className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white shadow-sm"
							src={`/avatars/${userData?.avatar_name || "default"}.svg`}
						/>
						{isCurrentPlayerTurn && (
							<div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full border-2 border-white" />
						)}
					</div>
					<div>
						<div className="flex items-center gap-1 sm:gap-2">
							<p className="text-sm sm:text-base font-semibold text-gray-900">
								{userData?.username}
							</p>
							<span className="text-xs sm:text-sm font-medium text-gray-600">
								• Score: {currentPlayer.score}
							</span>
						</div>
						<div className="flex items-center gap-1 sm:gap-2">
							<span className="text-xs sm:text-sm font-medium text-gray-600">
								{room?.status === "rebuttal"
									? "Rebuttal"
									: `Turn ${gameState.current_turn_number}`}
							</span>
							{turnActions.length > 0 && (
								<span className="text-xs text-gray-500">
									• Roll {turnActions.length}
								</span>
							)}
						</div>
					</div>
				</div>
				{turnActions.length > 0 && (
					<div className="flex flex-col items-end">
						<p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
							Roll Score
						</p>
						{isFarkle ? (
							<p className="text-base sm:text-lg font-bold text-red-600">
								Farkle!
							</p>
						) : (
							<p className="text-base sm:text-lg font-bold text-green-600">
								+{currentTurnScore}
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// Create a mobile version of the TurnSummary component
function MobileTurnSummary({
	room,
	players,
	currentPlayer,
	turnActions,
	gameState,
	isCurrentPlayerTurn,
}: {
	room: GameRoom;
	currentPlayer: GamePlayer;
	turnActions: TurnAction[];
	players: GamePlayer[];
	gameState: GameState;
	isCurrentPlayerTurn: boolean;
}) {
	const { data: userData, isLoading: userLoading } = useUser(
		currentPlayer.user_id
	);
	// Calculate total score for the current turn
	const currentTurnScore = turnActions.reduce(
		(total, action) => total + action.score,
		0
	);

	// get the latest turn action if there are any
	const latestTurnAction = turnActions[turnActions.length - 1];
	const isFarkle = latestTurnAction?.score === 0;

	if (userLoading || !userData) {
		return <div>Loading...</div>;
	}

	return (
		<div className="flex items-center justify-between w-full">
			<div className="flex items-center gap-2">
				<div className="relative">
					<img
						alt="User avatar"
						className="w-7 h-7 rounded-full border-2 border-white shadow-sm"
						src={`/avatars/${userData?.avatar_name || "default"}.svg`}
					/>
					{isCurrentPlayerTurn && (
						<div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
					)}
				</div>
				<div>
					<div className="flex items-center gap-1">
						<p className="text-sm font-semibold text-gray-900">
							{userData?.username}
						</p>
						<span className="text-xs font-medium text-gray-600">
							• Score: {currentPlayer.score}
						</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="text-xs font-medium text-gray-600">
							{room?.status === "rebuttal"
								? "Rebuttal"
								: `Turn ${gameState.current_turn_number}`}
						</span>
						{turnActions.length > 0 && (
							<span className="text-xs text-gray-500">
								• Roll {turnActions.length}
							</span>
						)}
					</div>
				</div>
			</div>
			{turnActions.length > 0 && (
				<div className="flex flex-col items-end">
					<p className="text-xs text-gray-500 uppercase tracking-wide">
						Roll Score
					</p>
					{isFarkle ? (
						<p className="text-sm font-bold text-red-600">Farkle!</p>
					) : (
						<p className="text-sm font-bold text-green-600">
							+{currentTurnScore}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

function CurrentPlayerTurn({ currentPlayer }: { currentPlayer: GamePlayer }) {
	// show the current player's name and the number of rolls they have made
	// show the current player's avatar

	return (
		<div className="flex items-center gap-2">
			<img
				alt="User avatar"
				className="w-8 h-8 rounded-full"
				src={`/avatars/${currentPlayer?.avatar_name || "default"}.svg`}
			/>
			<p className="text-sm font-medium">{currentPlayer?.username}</p>
		</div>
	);
}

function ShowWinner({
	room,
	players,
}: {
	room: GameRoom;
	players: Array<GamePlayer>;
}) {
	const winner = players.find((player) => player.user_id === room.winner_id);
	const { data: userData, isLoading: userLoading } = useUser(winner?.user_id);

	if (!winner || userLoading) {
		return null;
	}

	return (
		<div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg p-3 shadow-sm border border-amber-200">
			<div className="flex items-center gap-3">
				<div className="relative flex-shrink-0">
					<div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-20"></div>
					<img
						alt={`${userData?.username}'s avatar`}
						className="w-10 h-10 rounded-full border-2 border-amber-500 shadow relative z-10"
						src={`/avatars/${userData?.avatar_name || "default"}.svg`}
					/>
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<h3 className="text-base font-semibold text-gray-900 truncate">
							{userData?.username}
						</h3>
						<svg
							className="w-4 h-4 text-amber-500 flex-shrink-0"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
						</svg>
					</div>
					<p className="text-sm font-medium text-amber-600">
						Score: {winner.score}
					</p>
				</div>
			</div>
		</div>
	);
}

// Mobile version of ShowWinner
function MobileShowWinner({
	room,
	players,
}: {
	room: GameRoom;
	players: Array<GamePlayer>;
}) {
	const winner = players.find((player) => player.user_id === room.winner_id);
	const { data: userData, isLoading: userLoading } = useUser(winner?.user_id);

	if (!winner || userLoading) {
		return null;
	}

	return (
		<div className="flex items-center justify-between w-full">
			<div className="flex items-center gap-2">
				<div className="relative">
					<img
						alt={`${userData?.username}'s avatar`}
						className="w-7 h-7 rounded-full border-2 border-amber-500 shadow"
						src={`/avatars/${userData?.avatar_name || "default"}.svg`}
					/>
					<svg
						className="w-3 h-3 text-amber-500 absolute -top-1 -right-1"
						fill="currentColor"
						viewBox="0 0 24 24"
					>
						<path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
					</svg>
				</div>
				<div>
					<div className="flex items-center gap-1">
						<h3 className="text-sm font-semibold text-gray-900 truncate">
							{userData?.username}
						</h3>
					</div>
					<p className="text-xs font-medium text-amber-600">
						Winner • Score: {winner.score}
					</p>
				</div>
			</div>
		</div>
	);
}
