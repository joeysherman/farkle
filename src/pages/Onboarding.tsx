import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import type { FunctionComponent } from "../common/types";
import { supabase } from "../lib/supabaseClient";
import {
	AvatarBuilder,
	type AvatarOptions,
	type AvatarBuilderRef,
} from "../components/AvatarBuilder";

interface OnboardingData {
	username: string;
	avatarOptions?: AvatarOptions;
	preferences: {
		notifications: boolean;
		newsletter: boolean;
	};
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

	// Current step (1, 2, or 3)
	const [currentStep, setCurrentStep] = useState(
		context.auth.profile?.onboarding_step || 1
	);
	const [isLoading, setIsLoading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<string>("");
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

	// Upload avatar to Supabase storage
	const uploadAvatar = async (): Promise<string | null> => {
		if (!avatarBuilderRef.current || !context.auth.user?.id) {
			return null;
		}

		try {
			setUploadStatus("Generating your avatar...");

			// Generate the avatar blob
			const blob = await avatarBuilderRef.current.generateAvatarBlob();
			if (!blob) {
				throw new Error("Failed to generate avatar image");
			}

			setUploadStatus("Uploading avatar to cloud storage...");

			// Create a unique filename
			const fileName = `avatar-${context.auth.user.id}-${Date.now()}.png`;
			const filePath = `avatars/${fileName}`;

			// Upload to Supabase storage
			const { error: uploadError } = await supabase.storage
				.from("avatars")
				.upload(filePath, blob, {
					contentType: "image/png",
					upsert: true,
				});

			if (uploadError) {
				throw uploadError;
			}

			setUploadStatus("Finalizing avatar setup...");

			// Get the public URL
			const { data: urlData } = supabase.storage
				.from("avatars")
				.getPublicUrl(filePath);

			setUploadStatus("");
			console.log("urlData", urlData);
			return urlData.publicUrl;
		} catch (error) {
			setUploadStatus("");
			console.error("Error uploading avatar:", error);
			throw error;
		}
	};

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
		setUploadStatus("");
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
				const avatarUrl = await uploadAvatar();

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
					await new Promise((resolve) => setTimeout(resolve, 100));
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
			setUploadStatus("");
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

	// Step content components
	const renderStep1 = (): JSX.Element => (
		<div className="card bg-base-100 shadow-xl max-w-md mx-auto">
			<div className="card-body">
				<div className="text-center mb-6">
					<h2 className="card-title text-xl justify-center mb-2">
						What should we call you?
					</h2>
					<p className="text-base-content/70 text-sm">
						Choose a username that others will see
					</p>
				</div>

				<div className="form-control w-full">
					<label className="label">
						<span className="label-text font-medium">Username</span>
					</label>
					<input
						className={`input input-bordered w-full ${errors["username"] ? "input-error" : ""}`}
						maxLength={20}
						placeholder="Enter your username"
						type="text"
						value={data.username}
						onChange={(event) => {
							setData((previous) => ({
								...previous,
								username: event.target.value,
							}));
						}}
					/>
					{errors["username"] && (
						<label className="label">
							<span className="label-text-alt text-error">
								{errors["username"]}
							</span>
						</label>
					)}
				</div>
			</div>
		</div>
	);

	const renderStep2 = (): JSX.Element => (
		<div className="w-full max-w-5xl mx-auto">
			<div className="text-center mb-6">
				<h2 className="text-2xl font-bold mb-2">Choose your avatar</h2>
				<p className="text-base-content/70">
					Pick an avatar that represents you
				</p>
			</div>

			<AvatarBuilder
				ref={avatarBuilderRef}
				initialOptions={data.avatarOptions}
				onAvatarChange={(options) => {
					setData((previous) => ({ ...previous, avatarOptions: options }));
				}}
			/>
		</div>
	);

	const renderStep3 = (): JSX.Element => (
		<div className="card bg-base-100 shadow-xl max-w-md mx-auto">
			<div className="card-body">
				<div className="text-center mb-6">
					<h2 className="card-title text-xl justify-center mb-2">
						Almost done!
					</h2>
					<p className="text-base-content/70 text-sm">
						Set your preferences and finish setup
					</p>
				</div>

				<div className="bg-base-200 rounded-lg p-4 mb-6">
					<div className="flex items-center space-x-3">
						<div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center">
							{data.avatarOptions ? "🎨" : "👤"}
						</div>
						<div>
							<h3 className="font-semibold">{data.username}</h3>
							<p className="text-xs text-base-content/60">
								Ready to get started!
							</p>
						</div>
					</div>
				</div>

				<div className="space-y-3">
					<div className="form-control">
						<label className="label cursor-pointer">
							<span className="label-text font-medium">
								Email notifications
							</span>
							<input
								checked={data.preferences.notifications}
								className="checkbox checkbox-primary"
								type="checkbox"
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
						<label className="label cursor-pointer">
							<span className="label-text font-medium">Newsletter updates</span>
							<input
								checked={data.preferences.newsletter}
								className="checkbox checkbox-primary"
								type="checkbox"
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
	);

	return (
		<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 py-8 px-4">
			<div
				className={`mx-auto ${currentStep === 2 ? "max-w-6xl" : "max-w-lg"}`}
			>
				{/* Progress Steps */}
				<div className="mb-8 flex justify-center">
					<ul className="steps w-full max-w-lg mx-auto">
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

				{/* Step Content */}
				<div className="mb-6">
					{currentStep === 1 && renderStep1()}
					{currentStep === 2 && renderStep2()}
					{currentStep === 3 && renderStep3()}
				</div>

				{/* Error Message */}
				{errors["general"] && (
					<div className="alert alert-error max-w-md mx-auto mb-6">
						<span>{errors["general"]}</span>
					</div>
				)}

				{errors["avatar"] && (
					<div className="alert alert-error max-w-md mx-auto mb-6">
						<span>{errors["avatar"]}</span>
					</div>
				)}

				{/* Upload Status */}
				{uploadStatus && (
					<div className="alert alert-info max-w-md mx-auto mb-6">
						<div className="flex items-center">
							<span className="loading loading-spinner loading-sm mr-2"></span>
							<span>{uploadStatus}</span>
						</div>
					</div>
				)}

				{/* Navigation Buttons */}
				<div className="flex justify-between items-center max-w-md mx-auto">
					<button
						className={`btn btn-outline ${currentStep === 1 ? "invisible" : ""}`}
						disabled={isLoading}
						onClick={handleBack}
					>
						Back
					</button>

					<button
						className={`btn btn-primary ${isLoading ? "loading" : ""}`}
						disabled={isLoading}
						onClick={() => void handleNext()}
					>
						{currentStep === 3 ? "Finish" : "Next"}
						{isLoading && currentStep === 2 && (
							<span className="ml-2">
								{uploadStatus ? "" : "Processing..."}
							</span>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};
