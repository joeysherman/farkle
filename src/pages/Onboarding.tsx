import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabaseClient";
import { Stepper } from "../components/Stepper";
import type { User } from "@supabase/supabase-js";
import type { FunctionComponent } from "../common/types";

type OnboardingStep = "personalInfo" | "accountInfo" | "confirmation";

interface OnboardingState {
	username: string;
	avatarName: string;
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

			if (profile?.onboardingCompleted) {
				void navigate({ to: "/" });
				return;
			}

			// Set current step from profile if it exists
			if (profile?.onboardingStep) {
				setCurrentStep(profile.onboardingStep);
			}

			setLoading(false);
		};

		void checkAuth();
	}, [navigate]);

	const updateProfile = async (
		updates: Partial<{
			username: string;
			avatarName: string;
			onboardingStep: OnboardingStep;
			onboardingCompleted: boolean;
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
					onboardingStep: "accountInfo",
				});
				setCurrentStep("accountInfo");
			} else if (currentStep === "accountInfo") {
				await updateProfile({
					avatarName: state.avatarName,
					onboardingStep: "confirmation",
				});
				setCurrentStep("confirmation");
			} else if (currentStep === "confirmation") {
				await updateProfile({
					onboardingCompleted: true,
				});
				void navigate({ to: "/" });
			}
		} catch (error) {
			console.error("Error:", error);
			setError(error instanceof Error ? error.message : "An error occurred");
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
		<div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto">
				<div className="bg-white shadow sm:rounded-lg">
					<div className="px-4 py-5 sm:p-6">
						{/* Progress Steps */}
						<div className="mb-8">
							<Stepper
								currentStep={STEPS.findIndex((step) => step.id === currentStep)}
								steps={stepperSteps}
							/>
						</div>

						{/* Step Content */}
						<div>
							{currentStep === "personalInfo" && (
								<div>
									<h3 className="text-lg font-medium text-gray-900 mb-4">
										Enter your personal information
									</h3>
									<input
										className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
										placeholder="Enter username"
										type="text"
										value={state.username}
										onChange={(event) => {
											setState((previous) => ({
												...previous,
												username: event.target.value,
											}));
										}}
									/>
								</div>
							)}

							{currentStep === "accountInfo" && (
								<div>
									<h3 className="text-lg font-medium text-gray-900 mb-4">
										Choose your avatar
									</h3>
									<div className="grid grid-cols-3 gap-4">
										{AVAILABLE_AVATARS.map((avatarName) => (
											<button
												key={avatarName}
												className={`relative rounded-lg p-2 flex items-center justify-center ${
													state.avatarName === avatarName
														? "ring-2 ring-blue-500"
														: "hover:bg-gray-50"
												}`}
												onClick={() => {
													setState((previous) => ({
														...previous,
														avatarName,
													}));
												}}
											>
												<img
													alt={`Avatar ${avatarName}`}
													className="h-16 w-16 rounded-full"
													src={`/avatars/${avatarName}.svg`}
												/>
											</button>
										))}
									</div>
								</div>
							)}

							{currentStep === "confirmation" && (
								<div>
									<h3 className="text-lg font-medium text-gray-900 mb-4">
										Almost done!
									</h3>
									<p className="text-gray-600">
										Your profile has been set up. Click finish to start playing!
									</p>
								</div>
							)}

							{error && (
								<div className="mt-4 text-sm text-red-600">{error}</div>
							)}

							<div className="mt-6 flex justify-end">
								<button
									className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
									onClick={() => {
										void handleNext();
									}}
								>
									{currentStep === "confirmation" ? "Finish" : "Next"}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
