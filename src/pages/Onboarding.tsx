import type { User } from "@supabase/supabase-js";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import type { FunctionComponent } from "../common/types";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

type OnboardingStep = "personalInfo" | "accountInfo" | "confirmation";

const AVAILABLE_AVATARS = [
	"default",
	"avatar_1",
	"avatar_2",
	"avatar_3",
	"avatar_4",
	"avatar_5",
] as const;

export type AvatarName = (typeof AVAILABLE_AVATARS)[number];

interface OnboardingState {
	username: string;
	avatarName: AvatarName;
}

interface DatabaseProfile {
	id: string;
	username: string | null;
	avatar_name: string;
	onboarding_step: OnboardingStep | null;
	onboarding_completed: boolean;
}

interface SupabaseResponse<T> {
	data: T | null;
	error: Error | null;
}

const STEPS = [
	{ label: "Personal Info", id: "personalInfo" },
	{ label: "Account Info", id: "accountInfo" },
	{ label: "Confirmation", id: "confirmation" },
] as const;

// Keyboard-navigable Avatar Selector for onboarding
interface OnboardingAvatarSelectorProps {
	currentAvatar: AvatarName;
	onSelect: (avatarName: AvatarName) => void;
}

const OnboardingAvatarSelector = ({
	currentAvatar,
	onSelect,
}: OnboardingAvatarSelectorProps): JSX.Element => {
	const [selectedIndex, setSelectedIndex] = useState(() =>
		AVAILABLE_AVATARS.findIndex((avatar) => avatar === currentAvatar)
	);
	const containerRef = useRef<HTMLDivElement>(null);

	// Update selectedIndex when currentAvatar changes
	useEffect(() => {
		const index = AVAILABLE_AVATARS.findIndex(
			(avatar) => avatar === currentAvatar
		);
		setSelectedIndex(index);
	}, [currentAvatar]);

	// Handle keyboard navigation
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			switch (event.key) {
				case "ArrowLeft":
					event.preventDefault();
					setSelectedIndex((prev) => {
						const newIndex = prev > 0 ? prev - 1 : AVAILABLE_AVATARS.length - 1;
						onSelect(AVAILABLE_AVATARS[newIndex]);
						return newIndex;
					});
					break;
				case "ArrowRight":
					event.preventDefault();
					setSelectedIndex((prev) => {
						const newIndex = prev < AVAILABLE_AVATARS.length - 1 ? prev + 1 : 0;
						onSelect(AVAILABLE_AVATARS[newIndex]);
						return newIndex;
					});
					break;
				case "ArrowUp":
					event.preventDefault();
					setSelectedIndex((prev) => {
						const cols = 3; // 3 columns in mobile, adjust as needed
						const newIndex = prev - cols >= 0 ? prev - cols : prev;
						onSelect(AVAILABLE_AVATARS[newIndex]);
						return newIndex;
					});
					break;
				case "ArrowDown":
					event.preventDefault();
					setSelectedIndex((prev) => {
						const cols = 3;
						const newIndex =
							prev + cols < AVAILABLE_AVATARS.length ? prev + cols : prev;
						onSelect(AVAILABLE_AVATARS[newIndex]);
						return newIndex;
					});
					break;
				case " ":
					event.preventDefault();
					onSelect(AVAILABLE_AVATARS[selectedIndex]);
					break;
			}
		};

		if (containerRef.current) {
			containerRef.current.addEventListener("keydown", handleKeyDown);
			containerRef.current.focus();
		}

		return () => {
			if (containerRef.current) {
				containerRef.current.removeEventListener("keydown", handleKeyDown);
			}
		};
	}, [selectedIndex, onSelect]);

	return (
		<div
			ref={containerRef}
			tabIndex={0}
			className="bg-white rounded-lg p-6 max-w-2xl w-full mx-auto outline-none"
		>
			<div className="mb-4">
				<h3 className="text-lg font-medium text-gray-900 mb-2">
					Select Avatar
				</h3>
				<p className="text-sm text-gray-500">
					Use arrow keys to navigate, Enter to select
				</p>
			</div>
			<div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
				{AVAILABLE_AVATARS.map((avatarName, index) => (
					<button
						key={avatarName}
						onClick={() => {
							setSelectedIndex(index);
							onSelect(avatarName);
						}}
						className={`relative rounded-lg p-2 flex items-center justify-center transition-all ${
							index === selectedIndex
								? "ring-2 ring-indigo-500 bg-indigo-50"
								: currentAvatar === avatarName
									? "ring-2 ring-gray-300"
									: "hover:bg-gray-50"
						}`}
					>
						<img
							alt={`Avatar ${avatarName}`}
							src={`/avatars/${avatarName}.svg`}
							className="w-16 h-16 rounded-full"
						/>
					</button>
				))}
			</div>
		</div>
	);
};

export const Onboarding = (): FunctionComponent => {
	const navigate = useNavigate();
	const { user: authUser, profile: authProfile, isAuthChecking } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [currentStep, setCurrentStep] =
		useState<OnboardingStep>("personalInfo");
	const [error, setError] = useState("");
	const [state, setState] = useState<OnboardingState>({
		username: "",
		avatarName: "default",
	});
	const [usernameAvailable, setUsernameAvailable] = useState(false);
	const [checkingUsername, setCheckingUsername] = useState(false);
	const [isCurrentUsername, setIsCurrentUsername] = useState(false);
	const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

	const slideVariants = {
		enter: (direction: number) => ({
			x: direction > 0 ? 300 : -300,
			opacity: 0,
		}),
		center: {
			zIndex: 1,
			x: 0,
			opacity: 1,
		},
		exit: (direction: number) => ({
			zIndex: 0,
			x: direction < 0 ? 300 : -300,
			opacity: 0,
		}),
	};

	const [[page, direction], setPage] = useState([0, 0]);

	const paginate = (newDirection: number) => {
		setPage([page + newDirection, newDirection]);
	};

	const getStepStatus = (
		step: (typeof STEPS)[number],
		currentStep: OnboardingStep
	): "completed" | "current" | "upcoming" => {
		const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
		const stepIndex = STEPS.findIndex((s) => s.id === step.id);
		if (currentIndex > stepIndex) return "completed";
		if (step.id === currentStep) return "current";
		return "upcoming";
	};

	// Load existing profile data on mount - use AuthContext instead of separate auth check
	useEffect(() => {
		const loadProfileData = async (): Promise<void> => {
			// Wait for auth checking to complete
			if (isAuthChecking) return;

			// If not authenticated, redirect to signup
			if (!authUser) {
				void navigate({ to: "/signup" });
				return;
			}

			// If onboarding is already completed, redirect to dashboard
			if (authProfile?.onboarding_completed) {
				void navigate({ to: "/app/dashboard" });
				return;
			}

			// Load existing data from profile if it exists
			if (authProfile) {
				// Fetch full profile data for onboarding
				try {
					const { data: fullProfile }: SupabaseResponse<DatabaseProfile> =
						await supabase
							.from("profiles")
							.select("*")
							.eq("id", authUser.id)
							.single();

					if (fullProfile) {
						setState({
							username: fullProfile.username || "",
							avatarName: (fullProfile.avatar_name as AvatarName) || "default",
						});

						if (fullProfile.onboarding_step) {
							setCurrentStep(fullProfile.onboarding_step);
						}
					}
				} catch (error) {
					console.error("Error loading profile data:", error);
				}
			}

			setLoading(false);
		};

		void loadProfileData();
	}, [isAuthChecking, authUser, authProfile, navigate]);

	// Update page when step changes
	useEffect(() => {
		setPage([STEPS.findIndex((step) => step.id === currentStep), 0]);
	}, [currentStep]);

	// Username availability checking
	useEffect(() => {
		if (currentStep !== "personalInfo") return;
		if (!state.username.trim()) {
			setUsernameAvailable(false);
			setCheckingUsername(false);
			setIsCurrentUsername(false);
			return;
		}
		if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
		debounceTimeout.current = setTimeout(async () => {
			setCheckingUsername(true);

			// First check if this is the user's current username
			let currentUsernameCheck = false;
			if (authProfile) {
				try {
					const { data: currentProfile } = await supabase
						.from("profiles")
						.select("username")
						.eq("id", authUser?.id || "")
						.single();
					currentUsernameCheck =
						currentProfile?.username === state.username.trim();
				} catch (error) {
					console.error("Error checking current username:", error);
				}
			}

			if (currentUsernameCheck) {
				setUsernameAvailable(true);
				setIsCurrentUsername(true);
				setError("");
				setCheckingUsername(false);
				return;
			}

			// Check username availability (exclude current user)
			const { data, error } = await supabase
				.from("profiles")
				.select("id")
				.eq("username", state.username.trim())
				.neq("id", authUser?.id || "")
				.maybeSingle();
			if (!error && data) {
				setUsernameAvailable(false);
				setIsCurrentUsername(false);
				setError("Username is already taken");
			} else {
				setUsernameAvailable(true);
				setIsCurrentUsername(false);
				if (error) {
					setError("Error checking username");
				} else {
					setError("");
				}
			}
			setCheckingUsername(false);
		}, 500);
		return () => {
			if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
		};
	}, [state.username, currentStep, authUser?.id, authProfile]);

	// Save progress to database
	const saveProgress = async (
		updates: Partial<{
			username: string;
			avatar_name: string;
			onboarding_step: OnboardingStep;
			onboarding_completed: boolean;
		}>
	): Promise<boolean> => {
		if (!authUser) return false;

		try {
			setSaving(true);
			const { error: updateError } = await supabase
				.from("profiles")
				.upsert({
					id: authUser.id,
					...updates,
				})
				.select();

			if (updateError) throw updateError;
			return true;
		} catch (error) {
			console.error("Error saving progress:", error);
			setError(error instanceof Error ? error.message : "An error occurred");
			return false;
		} finally {
			setSaving(false);
		}
	};

	const handleNext = async (): Promise<void> => {
		try {
			setError("");

			if (currentStep === "personalInfo") {
				if (!state.username.trim()) {
					setError("Username is required");
					return;
				}
				if (!usernameAvailable || checkingUsername) {
					setError(
						"Please wait for username validation or choose a different username"
					);
					return;
				}

				// Save username and move to next step
				const success = await saveProgress({
					username: state.username.trim(),
					onboarding_step: "accountInfo",
				});

				if (success) {
					setCurrentStep("accountInfo");
				}
			} else if (currentStep === "accountInfo") {
				// Save avatar and move to confirmation
				const success = await saveProgress({
					avatar_name: state.avatarName,
					onboarding_step: "confirmation",
				});

				if (success) {
					setCurrentStep("confirmation");
				}
			} else if (currentStep === "confirmation") {
				// Complete onboarding
				const success = await saveProgress({
					onboarding_completed: true,
				});

				if (success) {
					void navigate({ to: "/app/dashboard" });
				}
			}
		} catch (error) {
			console.error("Error:", error);
			setError(error instanceof Error ? error.message : "An error occurred");
		}
	};

	const handleBack = async (): Promise<void> => {
		try {
			setError("");
			if (currentStep === "accountInfo") {
				// Save current progress and go back
				await saveProgress({
					avatar_name: state.avatarName,
					onboarding_step: "personalInfo",
				});
				setCurrentStep("personalInfo");
			} else if (currentStep === "confirmation") {
				// Save that we're going back to account info step
				await saveProgress({
					onboarding_step: "accountInfo",
				});
				setCurrentStep("accountInfo");
			}
		} catch (error) {
			console.error("Error:", error);
			setError(error instanceof Error ? error.message : "An error occurred");
		}
	};

	const isNextEnabled =
		!saving &&
		(currentStep === "personalInfo"
			? state.username.trim() &&
				usernameAvailable &&
				!checkingUsername &&
				!error
			: true);

	if (loading || isAuthChecking) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-600 font-medium">
						{isAuthChecking
							? "Verifying your account..."
							: "Loading your onboarding..."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className="min-h-screen bg-gray-100 p-4 sm:px-6 lg:px-8"
			tabIndex={-1}
			onKeyDown={(event) => {
				if (event.key === "Enter" && isNextEnabled) {
					event.preventDefault();
					void handleNext();
				}
			}}
		>
			<div className="max-w-3xl mx-auto">
				<div className="bg-white shadow sm:rounded-lg overflow-hidden">
					<div className="px-4 py-5 sm:p-6">
						{/* Progress Steps */}
						<ul className="steps steps-horizontal w-full mb-8">
							<li
								className={`step${currentStep === "personalInfo" ? " step-primary" : currentStep !== "personalInfo" ? " step-primary" : ""}`}
							>
								Username
							</li>
							<li
								className={`step${currentStep === "accountInfo" || currentStep === "confirmation" ? " step-primary" : ""}`}
							>
								Avatar
							</li>
							<li
								className={`step${currentStep === "confirmation" ? " step-primary" : ""}`}
							>
								Tutorial
							</li>
						</ul>

						{/* Step Content */}
						<div className="relative min-h-[400px] overflow-hidden">
							<AnimatePresence initial={false} mode="wait" custom={direction}>
								<motion.div
									key={currentStep}
									custom={direction}
									variants={slideVariants}
									initial="enter"
									animate="center"
									exit="exit"
									transition={{
										x: { type: "spring", stiffness: 300, damping: 30 },
										opacity: { duration: 0.2 },
									}}
									className="w-full absolute inset-0 px-4"
								>
									{currentStep === "personalInfo" && (
										<div className="space-y-4">
											<h3 className="text-2xl font-bold text-gray-900 mb-2">
												What should we call you?
											</h3>
											<input
												ref={(input) => {
													if (currentStep === "personalInfo" && input)
														input.focus();
												}}
												className={`input input-bordered input-lg w-full${error ? " input-error" : ""}`}
												placeholder="Enter your username"
												type="text"
												value={state.username}
												onChange={(event) => {
													setState((previous) => ({
														...previous,
														username: event.target.value,
													}));
													if (error) setError("");
													setUsernameAvailable(false);
													setCheckingUsername(true);
												}}
											/>
											{checkingUsername && state.username.trim() && (
												<div className="flex items-center text-info text-base mt-1 text-left gap-1">
													<span className="loading loading-spinner loading-xs"></span>
													Checking username...
												</div>
											)}
											{!checkingUsername && error && (
												<div className="text-error text-base mt-1 text-left">
													{error}
												</div>
											)}
											{!checkingUsername &&
												!error &&
												state.username.trim() &&
												usernameAvailable && (
													<div className="flex items-center text-success text-base mt-1 text-left gap-1">
														<svg
															xmlns="http://www.w3.org/2000/svg"
															className="h-5 w-5 inline-block"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
															strokeWidth={2}
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																d="M5 13l4 4L19 7"
															/>
														</svg>
														{isCurrentUsername
															? "This is your current username"
															: "Username is available"}
													</div>
												)}
										</div>
									)}

									{currentStep === "accountInfo" && (
										<div className="space-y-4">
											<h3 className="text-2xl font-semibold text-gray-900">
												Choose your avatar
											</h3>
											<OnboardingAvatarSelector
												currentAvatar={state.avatarName}
												onSelect={(avatarName) => {
													setState((previous) => ({
														...previous,
														avatarName,
													}));
												}}
											/>
										</div>
									)}

									{currentStep === "confirmation" && (
										<div
											className="space-y-4"
											tabIndex={0}
											ref={(div) => {
												if (currentStep === "confirmation" && div) {
													div.focus();
												}
											}}
										>
											<h3 className="text-2xl font-semibold text-gray-900">
												Almost done!
											</h3>
											<div className="bg-gray-50 rounded-lg p-6 space-y-4">
												<div className="flex items-center space-x-4">
													<img
														alt="Your avatar"
														src={`/avatars/${state.avatarName}.svg`}
														className="w-16 h-16 rounded-full"
													/>
													<div>
														<h4 className="text-lg font-medium text-gray-900">
															{state.username}
														</h4>
														<p className="text-sm text-gray-500">
															Ready to start playing!
														</p>
													</div>
												</div>
											</div>
											<p className="text-lg text-gray-600">
												Your profile has been set up. Click finish to start
												playing!
											</p>
											<p className="text-sm text-gray-500 italic">
												Press Enter to continue or click the Finish button
												below.
											</p>
										</div>
									)}
								</motion.div>
							</AnimatePresence>
						</div>

						{/* Navigation Buttons */}
						<div className="bottom-0 left-0 right-0 mt-6 flex justify-between px-4">
							{currentStep !== "personalInfo" && (
								<button
									className="btn btn-outline"
									onClick={() => {
										paginate(-1);
										void handleBack();
									}}
									disabled={saving}
								>
									Back
								</button>
							)}
							<button
								className={`btn btn-primary${currentStep === "personalInfo" ? " ml-auto" : ""} ${saving ? "loading" : ""}`}
								onClick={() => {
									paginate(1);
									void handleNext();
								}}
								disabled={!isNextEnabled}
							>
								{saving
									? "Saving..."
									: currentStep === "confirmation"
										? "Finish"
										: "Next"}
							</button>
						</div>

						{error && (
							<div className="mt-4 text-sm text-red-600 text-center">
								{error}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
