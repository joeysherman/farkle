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
import { useMutation, useQuery } from "@tanstack/react-query";
import { GameActions } from "./GameActions";
import { useUser } from "../services/user";
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

	const [room, setRoom] = useState<GameRoom | null>(null);
	const [players, setPlayers] = useState<Array<GamePlayer>>([]);
	const [gameState, setGameState] = useState<GameState | null>(null);
	const [currentTurn, setCurrentTurn] = useState<GameTurn | null>(null);

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

	const copyInviteLink = async () => {
		const url = `${window.location.origin}/room?roomId=${roomId}`;
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Invite Modal Component
	const InviteModal = () => {
		const codeInputRef = useRef<HTMLInputElement>(null);
		const joinButtonRef = useRef<HTMLButtonElement>(null);
		const [code, setCode] = useState("");
		const [isValid, setIsValid] = useState(false);

		// Add effect to handle auto-redirect when game is in progress
		useEffect(() => {
			if (room?.status === "in_progress") {
				const timer = setInterval(() => {
					setCountdown((prev) => {
						if (prev <= 1) {
							navigate({ to: "/" });
							return 0;
						}
						return prev - 1;
					});
				}, 1000);
				return () => clearInterval(timer);
			}
		}, [room?.status, navigate]);

		// Handle code paste
		const handleCodePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
			console.log("Paste event triggered");
			event.preventDefault();
			const pastedText = event.clipboardData.getData("text");
			console.log("Pasted text:", pastedText);
			// Only allow digits and limit to 6 characters
			const digitsOnly = pastedText.replace(/\D/g, "").slice(0, 6);
			console.log("Digits only:", digitsOnly);
			setCode(digitsOnly);
			setIsValid(digitsOnly.length === 6);
		};

		// Handle code changes
		const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
			console.log("Change event triggered");
			const value = event.target.value;
			console.log("Input value:", value);
			// Only allow digits and limit to 6 characters
			const digitsOnly = value.replace(/\D/g, "").slice(0, 6);
			console.log("Digits only:", digitsOnly);
			setCode(digitsOnly);
			setIsValid(digitsOnly.length === 6);
		};

		// Auto-join when code is 6 digits
		useEffect(() => {
			console.log("Code changed:", code);
			if (code.length === 6) {
				console.log("Attempting to join with code:", code);
				void handleJoinWithCode(code, localUsername);
			}
		}, [code]);

		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
				<div className="bg-white rounded-lg p-6 max-w-md w-full">
					{user && room?.created_by === user.id ? (
						<>
							<h3 className="text-lg font-medium mb-4">
								Invite Players to {room?.name}
							</h3>
							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-700">
										Room Code
									</label>
									<input
										readOnly
										type="text"
										value={room?.invite_code}
										className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 bg-gray-50"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700">
										Room URL
									</label>
									<div className="mt-1 flex rounded-md shadow-sm">
										<input
											readOnly
											type="text"
											value={`${window.location.origin}/room?roomId=${roomId}`}
											className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 bg-gray-50"
										/>
										<button
											className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
											onClick={copyInviteLink}
										>
											{copied ? "Copied!" : "Copy"}
										</button>
									</div>
								</div>
							</div>
						</>
					) : room?.status === "in_progress" ? (
						<>
							<h3 className="text-lg font-medium mb-4 text-red-600">
								Game Already Started
							</h3>
							<p className="text-gray-600 mb-4">
								You cannot join at this time.
							</p>
							<p className="text-2xl font-bold text-indigo-600 text-center mb-4">
								Redirecting in {countdown}
							</p>
							<button
								className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
								onClick={() => navigate({ to: "/" })}
							>
								Go Back
							</button>
						</>
					) : (
						<>
							<h3 className="text-lg font-medium mb-4">
								Join {room?.name || "Game"}
							</h3>
							<div className="space-y-4">
								{!user && (
									<div>
										<label className="block text-sm font-medium text-gray-700">
											Username
										</label>
										<input
											className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300"
											onChange={(event) => setLocalUsername(event.target.value)}
											placeholder="Enter your username"
											type="text"
											value={localUsername}
										/>
									</div>
								)}
								<div>
									<label className="block text-sm font-medium text-gray-700">
										Room Code
									</label>
									<input
										className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300"
										inputMode="numeric"
										maxLength={6}
										onChange={handleCodeChange}
										onPaste={handleCodePaste}
										pattern="[0-9]*"
										placeholder="Enter 6-digit code"
										ref={codeInputRef}
										type="text"
										value={code}
									/>
								</div>
								<button
									className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={!isValid}
									onClick={() => void handleJoinWithCode(code, localUsername)}
									ref={joinButtonRef}
								>
									Join Game
								</button>
							</div>
						</>
					)}
				</div>
			</div>
		);
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
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="flex items-center justify-center h-[calc(100vh-64px)]">
					<InviteModal />
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<Navbar />
			<main className="max-w-[1600px] mx-auto h-[calc(100vh-48px)] sm:h-[calc(100vh-64px)]">
				<div className="flex flex-col md:flex-row md:space-x-4 h-full">
					{/* Mobile Game Info Bar */}
					<div className="md:hidden flex items-center justify-between px-2 py-1 bg-white shadow-sm">
						<div className="flex items-center space-x-2">
							<button
								onClick={() => setShowSidebar(!showSidebar)}
								className="p-1 rounded-md hover:bg-gray-100"
							>
								<svg
									className="w-6 h-6 text-gray-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 6h16M4 12h16M4 18h16"
									/>
								</svg>
							</button>
							<span className="font-medium text-sm text-gray-900">
								{room?.name}
							</span>
						</div>
						<div className="flex items-center">
							<span className="text-sm text-gray-600">
								{room?.current_players}/{room?.max_players}
							</span>
						</div>
					</div>

					{/* Left Column - Room Details (Hidden on mobile unless toggled) */}
					<div
						className={`${showSidebar ? "fixed inset-0 z-40 bg-white" : "hidden"} md:relative md:block md:w-1/4 md:h-full`}
					>
						<div className="h-full flex flex-col bg-white shadow-lg md:shadow-none">
							{showSidebar && (
								<div className="md:hidden flex items-center justify-between p-4 border-b">
									<h2 className="text-lg font-semibold">Game Details</h2>
									<button
										onClick={() => setShowSidebar(false)}
										className="p-1 rounded-md hover:bg-gray-100"
									>
										<svg
											className="w-6 h-6 text-gray-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</div>
							)}
							{room && user && (
								<RoomHeader room={room} user={user}>
									<RoomControls
										room={room}
										user={user}
										onStartGame={handleStartGame}
										onEndGame={handleEndGame}
										onShowInvite={() => setShowInviteModal(true)}
									/>
								</RoomHeader>
							)}
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
					<div className="flex-1 flex flex-col h-[calc(100vh-84px)] md:h-full md:w-3/4">
						<div className="flex-1 relative">
							{/* Game Controls Overlay */}
							<div className="absolute top-0 left-0 right-0 z-10 p-2">
								<div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-2">
									<div className="flex justify-between gap-4 flex-col md:flex-row">
										{/* Turn Summary Section */}
										<div className="flex-1">
											{players.length > 0 &&
												turnActions &&
												gameState?.current_player_id && (
													<TurnSummary
														isCurrentPlayerTurn={isCurrentPlayerTurn}
														players={players}
														currentPlayer={players.find(
															(player) =>
																player.id === gameState.current_player_id
														)}
														turnActions={turnActions}
														gameState={gameState}
													/>
												)}
											{/* Desktop Game Actions - Now in top section */}
											<div className="flex items-center gap-4 flex-1">
												{gameState &&
													user &&
													players &&
													turnActions &&
													room?.status === "in_progress" && (
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
																const leftOverDice = diceStates.filter(
																	(dice) => !dice.isScoringNumber
																);
																if (outcome === "continue") {
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
																setSelectedDiceIndices([]);
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

										{/* Turn Actions History - Now in top section */}
										<div className="md:block flex-1">
											<TurnActions
												isCurrentPlayerTurn={isCurrentPlayerTurn}
												turnActions={turnActions}
												room={room}
											/>
										</div>
									</div>

									{/* Mobile Game Actions - Keep this for mobile view */}
									{/* <div className="md:hidden mt-2">
										{gameState &&
											user &&
											players &&
											turnActions &&
											room?.status === "in_progress" && (
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
														const leftOverDice = diceStates.filter(
															(dice) => !dice.isScoringNumber
														);
														if (outcome === "continue") {
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
														setSelectedDiceIndices([]);
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
									</div> */}
								</div>
							</div>

							{/* Game Scene */}
							<div className="h-full">
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
								/>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
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
	currentPlayer,
	turnActions,
	gameState,
	isCurrentPlayerTurn,
}: {
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
		<div className="bg-gray-50 rounded-lg px-4 py-3 shadow-sm">
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-3">
					<div className="relative">
						<img
							alt="User avatar"
							className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
							src={`/avatars/${userData?.avatar_name || "default"}.svg`}
						/>
						{isCurrentPlayerTurn && (
							<div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
						)}
					</div>
					<div>
						<p className="text-base font-semibold text-gray-900">
							{userData?.username}
						</p>
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium text-gray-600">
								Turn {gameState.current_turn_number}
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
							<p className="text-lg font-bold text-red-600">Farkle!</p>
						) : (
							<p className="text-lg font-bold text-green-600">
								+{currentTurnScore}
							</p>
						)}
					</div>
				)}
			</div>
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
