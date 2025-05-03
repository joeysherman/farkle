import type { User } from "@supabase/supabase-js";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import type { FunctionComponent } from "../common/types";
import { AvatarSelector, type AvatarName } from "../components/AvatarSelector";
import { supabase } from "../lib/supabaseClient";

type OnboardingStep = "personalInfo" | "accountInfo" | "confirmation";

interface OnboardingState {
	username: string;
	avatarName: AvatarName;
}

interface DatabaseProfile {
	id: string;
	username: string | null;
	avatarName: string;
	onboardingStep: OnboardingStep | null;
	onboardingCompleted: boolean;
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

const AVAILABLE_AVATARS = [
	"default",
	"avatar1",
	"avatar2",
	"avatar3",
	"avatar4",
	"avatar5",
] as const;

export const Onboarding = (): FunctionComponent => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState<User | null>(null);
	const [currentStep, setCurrentStep] =
		useState<OnboardingStep>("personalInfo");
	const [error, setError] = useState("");
	const [state, setState] = useState<OnboardingState>({
		username: "",
		avatarName: "default",
	});
	const [usernameAvailable, setUsernameAvailable] = useState(false);
	const [checkingUsername, setCheckingUsername] = useState(false);
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

	const stepperSteps = STEPS.map((step) => ({
		label: step.label,
		status: getStepStatus(step, currentStep),
	}));

	useEffect(() => {
		const checkAuth = async (): Promise<void> => {
			const {
				data: { user: authUser },
			} = await supabase.auth.getUser();
			if (!authUser) {
				void navigate({ to: "/signup" });
				return;
			}
			setUser(authUser);

			// Check if user already has a profile
			const { data: profile }: SupabaseResponse<DatabaseProfile> =
				await supabase
					.from("profiles")
					.select("*")
					.eq("id", authUser.id)
					.single();

			if (profile?.onboarding_completed) {
				void navigate({ to: "/" });
				return;
			}

			// Set current step from profile if it exists

			if (profile?.onboarding_step) {
				setCurrentStep(profile.onboarding_step);
			}

			setLoading(false);
		};

		void checkAuth();
	}, [navigate]);

	useEffect(() => {
		setPage([STEPS.findIndex((step) => step.id === currentStep), 0]);
	}, [currentStep]);

	useEffect(() => {
		if (currentStep !== "personalInfo") return;
		if (!state.username.trim()) {
			setUsernameAvailable(false);
			setCheckingUsername(false);
			return;
		}
		if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
		debounceTimeout.current = setTimeout(async () => {
			setCheckingUsername(true);
			// Check username availability
			const { data, error } = await supabase
				.from("profiles")
				.select("id")
				.eq("username", state.username.trim())
				.maybeSingle();
			if (!error && data) {
				setUsernameAvailable(false);
				setError("Username is already taken");
			} else {
				setUsernameAvailable(true);
				if (error) {
					setError("Error checking username");
				} else if (error === null && !data && error !== null) {
					setError("");
				} else if (error === null && !data) {
					setError("");
				}
			}
			setCheckingUsername(false);
		}, 500);
		return () => {
			if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.username, currentStep]);

	const updateProfile = async (
		updates: Partial<{
			username: string;
			avatar_name: string;
			onboarding_step: OnboardingStep;
			onboarding_completed: boolean;
		}>
	): Promise<void> => {
		if (!user) return;

		try {
			const { error: updateError } = await supabase
				.from("profiles")
				.upsert({
					id: user.id,
					...updates,
				})
				.select();

			if (updateError) throw updateError;
		} catch (error) {
			console.error("Error updating profile:", error);
			setError(error instanceof Error ? error.message : "An error occurred");
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

				await updateProfile({
					username: state.username.trim(),
					onboarding_step: "accountInfo",
				});
				setCurrentStep("accountInfo");
			} else if (currentStep === "accountInfo") {
				await updateProfile({
					avatar_name: state.avatarName,
					onboarding_step: "confirmation",
				});
				setCurrentStep("confirmation");
			} else if (currentStep === "confirmation") {
				await updateProfile({
					onboarding_completed: true,
				});
				void navigate({ to: "/" });
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
				await updateProfile({
					onboarding_step: "personalInfo",
				});
				setCurrentStep("personalInfo");
			} else if (currentStep === "confirmation") {
				await updateProfile({
					onboarding_step: "accountInfo",
				});
				setCurrentStep("accountInfo");
			}
		} catch (error) {
			console.error("Error:", error);
			setError(error instanceof Error ? error.message : "An error occurred");
		}
	};

	const handleKeyPress = (event: React.KeyboardEvent): void => {
		if (event.key === "Enter" && !error) {
			void handleNext();
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100 p-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto">
				<div className="bg-white shadow sm:rounded-lg overflow-hidden">
					<div className="px-4 py-5 sm:p-6">
						{/* Responsive daisyUI Steps */}
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
												placeholder="John Doe"
												type="text"
												value={state.username}
												onChange={(event) => {
													setState((previous) => ({
														...previous,
														username: event.target.value,
													}));
													if (error) setError("");
												}}
												onKeyDown={(event) => {
													if (
														event.key === "Enter" &&
														!error &&
														state.username.trim() &&
														usernameAvailable &&
														!checkingUsername
													) {
														event.preventDefault();
														void handleNext();
													}
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
														Username is available
													</div>
												)}
										</div>
									)}
									{currentStep === "accountInfo" && (
										<div className="space-y-4">
											<h3 className="text-2xl font-semibold text-gray-900">
												Choose your avatar
											</h3>
											<div
												tabIndex={0}
												onKeyDown={(event) => {
													if (event.key === "Enter" && !error) {
														event.preventDefault();
														void handleNext();
													}
												}}
											>
												<AvatarSelector
													currentAvatar={state.avatarName}
													showCloseButton={false}
													onSelect={(avatarName) => {
														setState((previous) => ({
															...previous,
															avatarName,
														}));
													}}
												/>
											</div>
										</div>
									)}
									{currentStep === "confirmation" && (
										<div className="space-y-4">
											<h3 className="text-2xl font-semibold text-gray-900">
												Almost done!
											</h3>
											<p className="text-lg text-gray-600">
												Your profile has been set up. Click finish to start
												playing!
											</p>
										</div>
									)}
								</motion.div>
							</AnimatePresence>
						</div>
						<div className="bottom-0 left-0 right-0 mt-6 flex justify-between px-4">
							{currentStep !== "personalInfo" && (
								<button
									className="btn btn-outline"
									onClick={() => {
										paginate(-1);
										void handleBack();
									}}
								>
									Back
								</button>
							)}
							<button
								className={`btn btn-primary${currentStep === "personalInfo" ? " ml-auto" : ""}`}
								onClick={() => {
									paginate(1);
									void handleNext();
								}}
								disabled={
									currentStep === "personalInfo" &&
									(!state.username.trim() ||
										!usernameAvailable ||
										checkingUsername)
								}
							>
								{currentStep === "confirmation" ? "Finish" : "Next"}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
