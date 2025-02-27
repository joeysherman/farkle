import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import type { FunctionComponent } from "../common/types";

type OnboardingStep = "username" | "avatar" | "preferences";

interface OnboardingState {
	username: string;
	avatarName: string;
}

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
	const [currentStep, setCurrentStep] = useState<OnboardingStep>("username");
	const [error, setError] = useState("");
	const [state, setState] = useState<OnboardingState>({
		username: "",
		avatarName: "default",
	});

	useEffect(() => {
		const checkAuth = async (): Promise<void> => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				void navigate({ to: "/signup" });
				return;
			}
			setUser(user);

			// Check if user already has a profile
			const { data: profile } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", user.id)
				.single();

			if (profile?.onboarding_completed) {
				void navigate({ to: "/" });
				return;
			}

			// Set current step from profile if it exists
			if (profile?.onboarding_step) {
				setCurrentStep(profile.onboarding_step as OnboardingStep);
			}

			setLoading(false);
		};

		void checkAuth();
	}, [navigate]);

	const updateProfile = async (
		updates: Partial<OnboardingState & { onboarding_step: OnboardingStep }>
	): Promise<void> => {
		if (!user) return;

		try {
			const { error } = await supabase
				.from("profiles")
				.upsert({
					id: user.id,
					...updates,
				})
				.select();

			if (error) throw error;
		} catch (error) {
			console.error("Error updating profile:", error);
			setError(error instanceof Error ? error.message : "An error occurred");
		}
	};

	const handleNext = async (): Promise<void> => {
		try {
			setError("");

			if (currentStep === "username") {
				if (!state.username.trim()) {
					setError("Username is required");
					return;
				}

				await updateProfile({
					username: state.username.trim(),
					onboarding_step: "avatar",
				});
				setCurrentStep("avatar");
			} else if (currentStep === "avatar") {
				await updateProfile({
					avatar_name: state.avatarName,
					onboarding_step: "preferences",
				});
				setCurrentStep("preferences");
			} else if (currentStep === "preferences") {
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

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading... onboarding</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md mx-auto">
				<div className="bg-white shadow sm:rounded-lg">
					<div className="px-4 py-5 sm:p-6">
						{/* Progress Steps */}
						<nav aria-label="Progress" className="mb-8">
							<ol role="list" className="flex items-center justify-between">
								{["username", "avatar", "preferences"].map((step, index) => (
									<li
										key={step}
										className={`relative ${index !== 2 ? "pr-8 sm:pr-20" : ""}`}
									>
										<div
											className="absolute inset-0 flex items-center"
											aria-hidden="true"
										>
											<div
												className={`h-0.5 w-full ${
													index <
													["username", "avatar", "preferences"].indexOf(
														currentStep
													)
														? "bg-indigo-600"
														: "bg-gray-200"
												}`}
											></div>
										</div>
										<div
											className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
												step === currentStep
													? "bg-white border-2 border-indigo-600"
													: index <
														  ["username", "avatar", "preferences"].indexOf(
																currentStep
														  )
														? "bg-indigo-600"
														: "bg-gray-200"
											}`}
										>
											<span
												className={`${
													step === currentStep
														? "text-indigo-600"
														: index <
															  ["username", "avatar", "preferences"].indexOf(
																	currentStep
															  )
															? "text-white"
															: "text-gray-500"
												}`}
											>
												{index + 1}
											</span>
										</div>
									</li>
								))}
							</ol>
						</nav>

						{/* Step Content */}
						<div>
							{currentStep === "username" && (
								<div>
									<h3 className="text-lg font-medium text-gray-900 mb-4">
										Choose your username
									</h3>
									<input
										type="text"
										className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
										placeholder="Enter username"
										value={state.username}
										onChange={(e) =>
											setState((prev) => ({
												...prev,
												username: e.target.value,
											}))
										}
									/>
								</div>
							)}

							{currentStep === "avatar" && (
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
														? "ring-2 ring-indigo-500"
														: "hover:bg-gray-50"
												}`}
												onClick={() =>
													setState((prev) => ({
														...prev,
														avatarName,
													}))
												}
											>
												<img
													alt={`Avatar ${avatarName}`}
													className="w-16 h-16 rounded-full"
													src={`/avatars/${avatarName}.svg`}
												/>
											</button>
										))}
									</div>
								</div>
							)}

							{currentStep === "preferences" && (
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
									className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
									onClick={() => void handleNext()}
								>
									{currentStep === "preferences" ? "Finish" : "Next"}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
