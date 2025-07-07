import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import type { FunctionComponent } from "../common/types";
import { supabase } from "../lib/supabaseClient";
import {
	AvatarBuilder,
	type AvatarOptions,
	type AvatarBuilderRef,
} from "../components/AvatarBuilder";
import { useAvatarUpload } from "../hooks/useAvatarUpload";

interface OnboardingData {
	username: string;
	avatarOptions?: AvatarOptions;
	preferences: {
		notifications: boolean;
		newsletter: boolean;
	};
}

// Loading spinner component
function LoadingSpinner(): JSX.Element {
	return (
		<div className="flex justify-center items-center">
			<div className="loading loading-spinner loading-lg text-primary"></div>
		</div>
	);
}

// update the user profile where the id is the user id and the data is the data to update
const updateUserProfile = async (
	id: string,
	data: Partial<{
		username: string;
		avatar_name?: string;
		onboarding_step?: number;
		onboarding_completed: boolean;
	}>
): Promise<void> => {
	const { error } = await supabase.from("profiles").update(data).eq("id", id);
	if (error) throw error;
};

export const Onboarding = (): FunctionComponent => {
	const context = useRouteContext({ from: "/app/onboarding" });
	const router = useRouter();
	const avatarBuilderRef = useRef<AvatarBuilderRef>(null);
	const { uploadAvatar, uploadStatus, isUploading } = useAvatarUpload();
	const usernameInputRef = useRef<HTMLInputElement>(null);
	const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
		null
	);
	const [checkingUsername, setCheckingUsername] = useState(false);
	const [usernameError, setUsernameError] = useState<string>("");
	const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Current step (1, 2, or 3)
	const [currentStep, setCurrentStep] = useState(
		context.auth.profile?.onboarding_step || 1
	);
	const [isLoading, setIsLoading] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Form data
	const [data, setData] = useState<OnboardingData>({
		username: context.auth.profile?.username || "",
		avatarOptions: undefined,
		preferences: {
			notifications: true,
			newsletter: false,
		},
	});

	const currentUsername = context.auth.profile?.username || "";

	// Autofocus username input on first step
	useEffect(() => {
		if (currentStep === 1 && usernameInputRef.current) {
			usernameInputRef.current.focus();
		}
	}, [currentStep]);

	// Debounced Supabase username check
	useEffect(() => {
		if (currentStep !== 1) return;
		const trimmed = data.username.trim();
		if (!trimmed || trimmed.length < 3) {
			setUsernameAvailable(null);
			setCheckingUsername(false);
			setUsernameError("");
			return;
		}
		// If input matches current username, treat as available
		if (trimmed === currentUsername) {
			setUsernameAvailable(true);
			setCheckingUsername(false);
			setUsernameError("");
			return;
		}
		if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
		debounceTimeout.current = setTimeout(async () => {
			setCheckingUsername(true);
			setUsernameError("");
			// Check username availability
			const { data: profile, error } = await supabase
				.from("profiles")
				.select("id")
				.eq("username", trimmed)
				.maybeSingle();
			if (!error && profile) {
				setUsernameAvailable(false);
				setUsernameError("This username is already taken.");
			} else {
				setUsernameAvailable(true);
				if (error) {
					setUsernameError("Error checking username");
				} else {
					setUsernameError("");
				}
			}
			setCheckingUsername(false);
		}, 500);
		return () => {
			if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
		};
	}, [data.username, currentStep, currentUsername]);

	// Validation functions
	const validateStep1 = (): boolean => {
		const newErrors: Record<string, string> = {};

		if (!data.username.trim()) {
			newErrors["username"] = "Username is required";
		} else if (data.username.length < 3) {
			newErrors["username"] = "Username must be at least 3 characters";
		} else if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
			newErrors["username"] =
				"Username can only contain letters, numbers, and underscores";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const validateStep2 = (): boolean => {
		return !!data.avatarOptions;
	};

	// Navigation functions
	const handleNext = async (): Promise<void> => {
		setErrors({});
		setIsLoading(true);

		try {
			if (currentStep === 1) {
				if (!validateStep1()) {
					setIsLoading(false);
					return;
				}
				console.log("📝 Updating profile for step 1");
				await updateUserProfile(context.auth.user!.id, {
					username: data.username,
					onboarding_step: 2,
				});
				setCurrentStep((previous: number) => previous + 1);
			}

			if (currentStep === 2) {
				if (!validateStep2()) {
					setErrors({
						avatar: "Please customize your avatar before continuing",
					});
					setIsLoading(false);
					return;
				}

				console.log("🎨 Uploading avatar and updating profile for step 2");
				// Upload avatar to Supabase
				const avatarUrl = await uploadAvatar(
					avatarBuilderRef,
					context.auth.user!.id
				);

				await updateUserProfile(context.auth.user!.id, {
					username: data.username,
					avatar_name: avatarUrl || "default",
					onboarding_step: 3,
				});
				setCurrentStep((previous: number) => previous + 1);
			}

			if (currentStep === 3) {
				console.log("🏁 Completing onboarding - updating profile");
				// Final step - save data and complete onboarding
				await updateUserProfile(context.auth.user!.id, {
					onboarding_completed: true,
				});

				console.log("🔄 Refetching profile from context");
				// Wait for the auth context to refetch the profile
				await context.auth.refetchProfile();

				console.log("✅ Profile refetch complete - checking profile state");
				console.log("Current profile state:", context.auth.profile);

				// Check if profile is updated, if not wait a bit
				if (context.auth.profile?.onboarding_completed) {
					console.log(
						"🎉 Profile updated immediately - navigating to dashboard"
					);
					void router.navigate({ to: "/app/dashboard" });
				} else {
					console.log("⏳ Profile not yet updated, waiting 100ms...");
					// Wait a bit for React state to update
					await new Promise<void>((resolve) => {
						setTimeout(() => resolve(), 100);
					});
					console.log("🔄 After delay - profile state:", context.auth.profile);

					if (context.auth.profile?.onboarding_completed) {
						console.log(
							"✅ Profile updated after delay - navigating to dashboard"
						);
						void router.navigate({ to: "/app/dashboard" });
					} else {
						console.log(
							"❌ Profile still not updated - forcing navigation anyway"
						);
						// Force navigation - the route guard should handle it
						void router.navigate({ to: "/app/dashboard" });
					}
				}
			}
		} catch (error) {
			console.error("❌ Error in handleNext:", error);
			setErrors({ general: "Something went wrong. Please try again." });
		} finally {
			setIsLoading(false);
		}
	};

	const handleBack = (): void => {
		if (currentStep > 1) {
			void updateUserProfile(context.auth.user!.id, {
				onboarding_step: currentStep - 1,
			}).then(() => {
				setCurrentStep((previous: number) => previous - 1);
			});
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20">
			<div className={`container mx-auto py-4`}>
				{/* Progress Steps */}
				<div className="card bg-base-100 shadow-2xl mb-4">
					<div className="card-body p-4">
						<ul className="steps  w-full">
							<li className={`step ${currentStep >= 1 ? "step-primary" : ""}`}>
								Personal
							</li>
							<li className={`step ${currentStep >= 2 ? "step-primary" : ""}`}>
								Avatar
							</li>
							<li className={`step ${currentStep >= 3 ? "step-primary" : ""}`}>
								Preferences
							</li>
						</ul>
					</div>
				</div>
				{/* Error Message */}
				{errors["general"] && (
					<div className="alert alert-error mb-4 flex justify-center">
						<span>{errors["general"]}</span>
					</div>
				)}

				{errors["avatar"] && (
					<div className="alert alert-error mb-4 flex justify-center">
						<span>{errors["avatar"]}</span>
					</div>
				)}

				{/* Upload Status */}
				{uploadStatus && (
					<div className="alert alert-info mb-4 flex justify-center">
						<div className="flex items-center">
							<span className="loading loading-spinner loading-sm mr-2"></span>
							<span>{uploadStatus}</span>
						</div>
					</div>
				)}
				{/* Step Content */}
				<div className="mb-6">
					{currentStep === 1 && (
						<div className="card bg-base-100 shadow-2xl max-w-lg mx-auto">
							<div className="card-body">
								<div className="text-center mb-4">
									<h2 className="card-title text-2xl justify-center">
										What should we call you?
									</h2>
								</div>

								<div className="form-control w-full">
									<label className="label">
										<span className="label-text">
											Choose a username that suits you best
										</span>
									</label>
									<input
										ref={usernameInputRef}
										type="text"
										placeholder="Enter your username"
										maxLength={20}
										value={data.username}
										className={`input input-bordered input-primary w-full ${
											errors["username"] ? "input-error" : ""
										}`}
										onChange={(event) => {
											const value = event.target.value;
											setData((previous) => ({
												...previous,
												username: value,
											}));
											// Clear feedback and show checking if input is long enough
											if (value.trim().length >= 3) {
												setUsernameAvailable(null);
												setUsernameError("");
												setCheckingUsername(true);
											} else {
												setUsernameAvailable(null);
												setUsernameError("");
												setCheckingUsername(false);
											}
										}}
									/>
									{errors["username"] && (
										<label className="label">
											<span className="label-text-alt text-error">
												{errors["username"]}
											</span>
										</label>
									)}
									{/* Username check feedback */}
									{data.username.length >= 3 && (
										<div className="mt-2 min-h-[1.5rem]">
											{checkingUsername ? (
												<span className="text-info text-sm flex items-center gap-1">
													<span className="loading loading-spinner loading-xs"></span>
													Checking username...
												</span>
											) : data.username.trim() === currentUsername ? (
												<span className="text-info text-sm">
													This is your current username
												</span>
											) : usernameAvailable === false ? (
												<span className="text-error text-sm">
													{usernameError || "This username is already taken."}
												</span>
											) : usernameAvailable === true && !usernameError ? (
												<span className="text-success text-sm">
													This username is available!
												</span>
											) : usernameError && usernameAvailable !== false ? (
												<span className="text-error text-sm">
													{usernameError}
												</span>
											) : null}
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{currentStep === 2 && (
						<div className="card bg-base-100 shadow-2xl">
							<div className="card-body">
								<div className="text-center mb-2">
									<h2 className="card-title text-2xl justify-center mb-2">
										Choose your avatar
									</h2>
								</div>

								<AvatarBuilder
									ref={avatarBuilderRef}
									initialOptions={data.avatarOptions}
									onAvatarChange={(options) => {
										setData((previous) => ({
											...previous,
											avatarOptions: options,
										}));
									}}
								/>
							</div>
						</div>
					)}

					{currentStep === 3 && (
						<div className="card bg-base-100 shadow-2xl">
							<div className="card-body">
								<div className="text-center mb-6">
									<h2 className="card-title text-2xl justify-center mb-2">
										Almost done!
									</h2>
									<p className="text-base-content/70">
										Set your preferences and finish setup
									</p>
								</div>

								<div className="bg-base-200 rounded-lg p-4 mb-6">
									<div className="flex items-center space-x-3">
										<div className="avatar placeholder">
											<div className="w-12 rounded-full bg-base-300">
												<span>{data.avatarOptions ? "🎨" : "👤"}</span>
											</div>
										</div>
										<div>
											<h3 className="font-semibold">{data.username}</h3>
											<p className="text-sm text-base-content/70">
												Ready to get started!
											</p>
										</div>
									</div>
								</div>

								<div className="space-y-4">
									<div className="form-control">
										<label className="label cursor-pointer justify-between">
											<span className="label-text">Email notifications</span>
											<input
												type="checkbox"
												className="checkbox checkbox-primary"
												checked={data.preferences.notifications}
												onChange={(event) => {
													setData((previous) => ({
														...previous,
														preferences: {
															...previous.preferences,
															notifications: event.target.checked,
														},
													}));
												}}
											/>
										</label>
									</div>

									<div className="form-control">
										<label className="label cursor-pointer justify-between">
											<span className="label-text">Newsletter updates</span>
											<input
												type="checkbox"
												className="checkbox checkbox-primary"
												checked={data.preferences.newsletter}
												onChange={(event) => {
													setData((previous) => ({
														...previous,
														preferences: {
															...previous.preferences,
															newsletter: event.target.checked,
														},
													}));
												}}
											/>
										</label>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Navigation Buttons */}
				<div className="card bg-base-100 shadow-2xl">
					<div className="card-body flex flex-row justify-between items-center">
						<button
							className={`btn btn-outline ${currentStep === 1 ? "invisible" : ""}`}
							disabled={isLoading || isUploading}
							onClick={handleBack}
						>
							Back
						</button>

						<button
							className={`btn btn-primary ${isLoading || isUploading ? "loading" : ""}`}
							disabled={
								isLoading ||
								isUploading ||
								(currentStep === 1 &&
									(!data.username.trim() ||
										data.username.trim().length < 3 ||
										checkingUsername ||
										(data.username.trim() !== currentUsername &&
											usernameAvailable !== true)))
							}
							onClick={() => void handleNext()}
						>
							{currentStep === 3 ? "Finish" : "Next"}
							{(isLoading || isUploading) && (
								<span className="ml-2">
									{isLoading || isUploading ? <LoadingSpinner /> : ""}
								</span>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
