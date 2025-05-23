import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { supabase } from "../lib/supabaseClient";
import { BoxingRing } from "../_game/BoxingRing";
import { Coliseum } from "../_game/Coliseum";
import { PokerTable } from "../_game/PokerTable";
import { PerspectiveCamera } from "@react-three/drei";

interface Friend {
	id: string;
	username: string;
	avatar_name: string;
	isInvited?: boolean;
	inviteStatus?: "pending" | "accepted" | "declined";
}

interface RoomSettingsDialogProps {
	roomId: string;
	onClose: () => void;
	currentStep: number;
}

const cameraPresets = {
	boxing_ring: {
		position: [0, 6, 0],
		scale: [1, 1, 1],
		cameraPosition: [0, 15, 30],
		fov: 20,
		minDistance: 120,
		maxDistance: 120,
	},
	coliseum: {
		position: [0, -3, 0],
		scale: [1, 1, 1],
		cameraPosition: [0, -3, 0],
		fov: 20,
		minDistance: 120,
		maxDistance: 120,
	},
	poker_table: {
		position: [0, 10, 0],
		scale: [1, 1, 1],
		cameraPosition: [0, 0, 0],
		fov: 20,
		minDistance: 140,
		maxDistance: 140,
	},
};

function ModelPreview({
	model,
}: {
	model: "boxing_ring" | "coliseum" | "poker_table";
}): JSX.Element {
	return (
		<Canvas>
			<PerspectiveCamera makeDefault fov={cameraPresets[model].fov} />
			<ambientLight intensity={0.5} />
			<pointLight position={[-50, 100, -50]} />
			<directionalLight
				castShadow
				intensity={2}
				position={[-50, 100, -50]}
				shadow-camera-bottom={-20}
				shadow-camera-left={-20}
				shadow-camera-right={20}
				shadow-camera-top={20}
			/>
			{model === "boxing_ring" ? (
				<group
					position={cameraPresets[model].position}
					scale={cameraPresets[model].scale}
				>
					<BoxingRing />
				</group>
			) : model === "coliseum" ? (
				<group
					position={cameraPresets[model].position}
					scale={cameraPresets[model].scale}
				>
					<Coliseum />
				</group>
			) : (
				<group position={cameraPresets[model].position}>
					<PokerTable />
				</group>
			)}
			<OrbitControls
				autoRotate
				autoRotateSpeed={1}
				enablePan={false}
				enableZoom={false}
				maxPolarAngle={Math.PI / 2.5}
				minPolarAngle={Math.PI / 3}
				maxDistance={cameraPresets[model].maxDistance}
				minDistance={cameraPresets[model].minDistance}
			/>
		</Canvas>
	);
}

export function RoomSettingsDialog({
	roomId,
	onClose,
	currentStep,
}: RoomSettingsDialogProps): JSX.Element {
	const [selectedModel, setSelectedModel] = useState<
		"boxing_ring" | "coliseum" | "poker_table"
	>("boxing_ring");
	const [isSaving, setIsSaving] = useState(false);
	const [friends, setFriends] = useState<Array<Friend>>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
	const [step, setStep] = useState(currentStep || 1);
	const [addingBot, setAddingBot] = useState(false);
	const [botAddedFeedback, setBotAddedFeedback] = useState<string | null>(null);
	const [botPlayers, setBotPlayers] = useState<
		Array<{ id: string; difficulty: string }>
	>([]);

	useEffect(() => {
		setStep(currentStep || 1);
	}, [currentStep]);

	useEffect(() => {
		if (step === 2) {
			void loadFriends();
		} else if (step === 3) {
			void loadBotPlayers();
		}
	}, [step]);

	const loadBotPlayers = async (): Promise<void> => {
		try {
			setIsLoading(true);
			const { data: botData, error } = await supabase
				.from("bot_players")
				.select("id, difficulty")
				.eq("game_id", roomId);

			if (error) throw error;
			setBotPlayers(botData || []);
		} catch (error) {
			console.error("Error loading bot players:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const loadFriends = async (): Promise<void> => {
		try {
			setIsLoading(true);
			const { data: user } = await supabase.auth.getUser();
			if (!user.user) return;

			// Get friends list
			const { data: friendsData, error: friendsError } = await supabase
				.from("friends")
				.select("friend_id")
				.eq("user_id", user.user.id)
				.eq("status", "accepted");

			if (friendsError) throw friendsError;

			const friendIds = friendsData.map((f) => f.friend_id);

			if (friendIds.length > 0) {
				// Get existing invites for this room
				const { data: existingInvites, error: invitesError } = await supabase
					.from("game_invites")
					.select("receiver_id, status")
					.eq("game_id", roomId)
					.eq("sender_id", user.user.id)
					.in("receiver_id", friendIds);

				if (invitesError) throw invitesError;

				// Create a map of friend IDs to their invite status
				const inviteStatusMap = new Map(
					existingInvites?.map((invite) => [invite.receiver_id, invite.status])
				);

				// Get friend profiles
				const { data: profilesData, error: profilesError } = await supabase
					.from("profiles")
					.select("id, username, avatar_name")
					.in("id", friendIds);

				if (profilesError) throw profilesError;

				// Combine profile data with invite status
				const friendsWithInviteStatus = (profilesData || []).map((profile) => ({
					...profile,
					inviteStatus: inviteStatusMap.get(
						profile.id
					) as Friend["inviteStatus"],
					isInvited: inviteStatusMap.has(profile.id),
				}));

				setFriends(friendsWithInviteStatus);

				// Update invited friends set
				const newInvitedFriends = new Set(
					existingInvites
						?.filter((invite) => invite.status === "pending")
						.map((invite) => invite.receiver_id)
				);

				setInvitedFriends(newInvitedFriends);
			}
		} catch (error) {
			console.error("Error loading friends:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleInviteFriend = async (friendId: string): Promise<void> => {
		try {
			const { error } = await supabase.rpc("send_game_invite", {
				p_game_id: roomId,
				p_receiver_id: friendId,
			});

			if (error) throw error;

			// Update local state to show friend as invited
			setInvitedFriends((previous) => new Set([...previous, friendId]));

			// Update the friend's status in the friends array
			setFriends((previousFriends) =>
				previousFriends.map((friend) =>
					friend.id === friendId
						? { ...friend, inviteStatus: "pending", isInvited: true }
						: friend
				)
			);
		} catch (error) {
			console.error("Error inviting friend:", error);
		}
	};

	const handleAddBot = async (difficulty: string): Promise<void> => {
		try {
			setAddingBot(true);
			setBotAddedFeedback(null);

			const { error } = await supabase.rpc("add_bot_player", {
				p_game_id: roomId,
				p_difficulty: difficulty,
			});

			if (error) throw error;

			// Refresh the bot players list
			await loadBotPlayers();

			// Show success feedback
			setBotAddedFeedback(
				`${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} bot added successfully!`
			);

			// Clear feedback after 3 seconds
			setTimeout(() => {
				setBotAddedFeedback(null);
			}, 3000);
		} catch (error) {
			console.error("Error adding bot player:", error);
			setBotAddedFeedback("Failed to add bot player");
		} finally {
			setAddingBot(false);
		}
	};

	const handleSave = async (): Promise<void> => {
		try {
			setIsSaving(true);
			console.log("Attempting to update room:", roomId);
			const { data, error } = await supabase.rpc("update_room_settings", {
				p_room_id: roomId,
				p_value: selectedModel,
			});

			if (error) {
				console.error("Supabase error:", error);
				throw error;
			}

			console.log("Update successful:", data);
			// If we're on the final step, close the dialog
			if (step === 3) {
				onClose();
			} else {
				// Otherwise move to the next step
				setStep(step + 1);
			}
		} catch (error) {
			console.error("Error saving room settings:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleBack = (): void => {
		setStep(step - 1);
	};

	const handleModelSelect = (
		model: "boxing_ring" | "coliseum" | "poker_table"
	): void => {
		setSelectedModel(model);
	};

	const renderStep = (): JSX.Element => {
		switch (step) {
			case 1:
				return (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{[
							{
								id: "boxing_ring",
								title: "Boxing Ring",
								description: "A classic boxing ring setting",
							},
							{
								id: "coliseum",
								title: "Coliseum",
								description: "An epic Roman coliseum arena",
							},
							{
								id: "poker_table",
								title: "Poker Table",
								description: "A classic casino poker table",
							},
						].map((option) => (
							<button
								key={option.id}
								className={`group p-4 rounded-lg border-2 transition-all active:scale-95 ${
									selectedModel === option.id
										? "border-indigo-500 bg-indigo-50"
										: "border-gray-200 hover:border-indigo-200"
								}`}
								onClick={(): void => {
									handleModelSelect(
										option.id as "boxing_ring" | "coliseum" | "poker_table"
									);
								}}
							>
								<div className="aspect-[4/3] bg-gray-100 rounded-lg mb-3 overflow-hidden shadow-sm group-hover:shadow transition-shadow">
									<ModelPreview
										model={
											option.id as "boxing_ring" | "coliseum" | "poker_table"
										}
									/>
								</div>
								<p className="text-base font-medium text-gray-900">
									{option.title}
								</p>
								<p className="text-sm text-gray-500 mt-1">
									{option.description}
								</p>
							</button>
						))}
					</div>
				);
			case 2:
				return (
					<div className="space-y-4">
						<div className="text-sm text-gray-500">
							Invite your friends to join the game
						</div>
						{isLoading ? (
							<div className="flex items-center justify-center py-8">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
							</div>
						) : friends.length === 0 ? (
							<div className="text-center py-8 text-gray-500">
								No friends found. Add some friends to invite them to your game!
							</div>
						) : (
							<div className="grid grid-cols-1 gap-3">
								{friends.map((friend) => (
									<div
										key={friend.id}
										className="flex items-center justify-between p-4 bg-white border rounded-lg"
									>
										<div className="flex items-center space-x-3">
											<div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
												<span className="text-lg font-medium text-gray-600">
													{friend.username?.[0].toUpperCase() || "?"}
												</span>
											</div>
											<div>
												<div className="font-medium">{friend.username}</div>
												<div className="text-sm text-gray-500">
													{friend.avatar_name}
												</div>
											</div>
										</div>
										<button
											className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
												friend.inviteStatus === "pending"
													? "bg-gray-100 text-gray-400 cursor-not-allowed"
													: friend.inviteStatus === "accepted"
														? "bg-green-100 text-green-700 cursor-not-allowed"
														: friend.inviteStatus === "declined"
															? "bg-red-100 text-red-700 cursor-not-allowed"
															: "bg-indigo-600 text-white hover:bg-indigo-700"
											}`}
											disabled={friend.inviteStatus !== undefined}
											onClick={(): Promise<void> =>
												handleInviteFriend(friend.id)
											}
										>
											{friend.inviteStatus === "pending"
												? "Invite Pending"
												: friend.inviteStatus === "accepted"
													? "Already Joined"
													: friend.inviteStatus === "declined"
														? "Invite Declined"
														: "Invite"}
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				);
			case 3:
				return (
					<div className="space-y-4">
						<div className="text-sm text-gray-500">
							Add bot players to your game
						</div>

						{botAddedFeedback && (
							<div
								className={`p-3 rounded-md text-sm ${
									botAddedFeedback.includes("Failed")
										? "bg-red-100 text-red-700"
										: "bg-green-100 text-green-700"
								}`}
							>
								{botAddedFeedback}
							</div>
						)}

						{isLoading ? (
							<div className="flex items-center justify-center py-8">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
							</div>
						) : (
							<>
								{botPlayers.length > 0 && (
									<div className="mb-4">
										<h3 className="text-md font-medium text-gray-700 mb-2">
											Current Bot Players
										</h3>
										<div className="grid grid-cols-1 gap-2">
											{botPlayers.map((bot) => (
												<div
													key={bot.id}
													className="flex items-center gap-2 p-3 bg-gray-50 rounded-md"
												>
													<div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
														<span className="text-base font-medium text-gray-600">
															🤖
														</span>
													</div>
													<span className="text-sm font-medium capitalize">
														{bot.difficulty} Bot
													</span>
												</div>
											))}
										</div>
									</div>
								)}

								<h3 className="text-md font-medium text-gray-700 mb-2">
									Add New Bot
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
									{["easy", "medium", "hard"].map((difficulty) => (
										<button
											key={difficulty}
											className="flex flex-col items-center p-4 bg-white border rounded-lg hover:border-indigo-200 transition-colors"
											onClick={() => handleAddBot(difficulty)}
											disabled={addingBot}
										>
											<div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mb-2">
												<span className="text-lg font-medium text-gray-600">
													🤖
												</span>
											</div>
											<div className="font-medium capitalize">{difficulty}</div>
											<div className="text-xs text-gray-500 text-center mt-1">
												{difficulty === "easy"
													? "Conservative play style"
													: difficulty === "medium"
														? "Balanced play style"
														: "Aggressive play style"}
											</div>
										</button>
									))}
								</div>
							</>
						)}
					</div>
				);
			default:
				return <div>Invalid step</div>;
		}
	};

	const getStepTitle = (): string => {
		switch (step) {
			case 1:
				return "Select game table";
			case 2:
				return "Invite friends";
			case 3:
				return "Add bot players";
			default:
				return "";
		}
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 md:p-6">
			<div className="bg-white rounded-lg w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl overflow-y-auto flex flex-col">
				<div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 md:px-6 z-10">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-xl md:text-2xl font-bold text-gray-900">
								{getStepTitle()}
							</h2>
							<p className="text-sm text-gray-500 mt-1">Step {step} of 3</p>
						</div>
						<button
							className="p-2 hover:bg-gray-100 rounded-full transition-colors"
							aria-label="Close dialog"
							onClick={onClose}
						>
							<svg
								className="w-5 h-5 text-gray-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M6 18L18 6M6 6l12 12"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
								/>
							</svg>
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					<div className="p-4 md:p-6">{renderStep()}</div>
				</div>

				<div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 md:p-6">
					<div className="flex justify-between gap-3">
						{step > 1 && (
							<button
								className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
								onClick={handleBack}
							>
								Back
							</button>
						)}
						<button
							className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							disabled={isSaving}
							onClick={handleSave}
						>
							{isSaving ? "Saving..." : step === 3 ? "Finish" : "Continue"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
