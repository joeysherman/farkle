import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import type { FunctionComponent } from "../common/types";
import { supabase } from "../lib/supabaseClient";

interface OnboardingData {
	username: string;
	avatar: string;
	preferences: {
		notifications: boolean;
		newsletter: boolean;
	};
}

// Available avatars
const AVATARS = [
	{ id: "default", name: "Default", src: "/avatars/default.svg" },
	{ id: "avatar_1", name: "Avatar 1", src: "/avatars/avatar_1.svg" },
	{ id: "avatar_2", name: "Avatar 2", src: "/avatars/avatar_2.svg" },
	{ id: "avatar_3", name: "Avatar 3", src: "/avatars/avatar_3.svg" },
	{ id: "avatar_4", name: "Avatar 4", src: "/avatars/avatar_4.svg" },
	{ id: "avatar_5", name: "Avatar 5", src: "/avatars/avatar_5.svg" },
];

// update the user profile where the id is the user id and the data is the data to update
const updateUserProfile = async (
	id: string,
	data: OnboardingData
): Promise<void> => {
	const { error } = await supabase.from("profiles").update(data).eq("id", id);
	if (error) throw error;
};

export const Onboarding = (): FunctionComponent => {
	const navigate = useNavigate();
	const context = useRouteContext({ from: "/app/onboarding" });

	// Current step (1, 2, or 3)
	const [currentStep, setCurrentStep] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Form data
	const [data, setData] = useState<OnboardingData>({
		username: context.auth.profile?.username ?? "",
		avatar: context.auth.profile?.avatar_name ?? "default",
		preferences: {
			notifications: true,
			newsletter: false,
		},
	});

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
		return !!data.avatar;
	};

	const handleFinish = async (): Promise<void> => {
		setIsLoading(true);
		try {
			// Save to database
			const { error } = await supabase.from("profiles").upsert({
				id: context.auth.user?.id,
				username: data.username,
				avatar_name: data.avatar,
				onboarding_completed: true,
			});

			if (error) throw error;

			// Navigate to dashboard
			void navigate({ to: "/app/dashboard" });
		} catch (error) {
			console.error("Error completing onboarding:", error);
			setErrors({ general: "Failed to save your data. Please try again." });
		} finally {
			setIsLoading(false);
		}
	};

	// Navigation functions
	const handleNext = async (): Promise<void> => {
		setErrors({});

		// update the user profile with the new data
		await updateUserProfile(context.auth.user?.id, {
			username: data.username,
			avatar_name: data.avatar,

			onboarding_completed: true,
		});

		if (currentStep === 1 && !validateStep1()) {
			return;
		}

		if (currentStep === 2 && !validateStep2()) {
			return;
		}

		if (currentStep === 3) {
			// Final step - save data and complete onboarding
			await handleFinish();
			return;
		}

		setCurrentStep((previous) => previous + 1);
	};

	const handleBack = (): void => {
		if (currentStep > 1) {
			setCurrentStep((previous) => previous - 1);
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
		<div className="card bg-base-100 shadow-xl max-w-md mx-auto">
			<div className="card-body">
				<div className="text-center mb-6">
					<h2 className="card-title text-xl justify-center mb-2">
						Choose your avatar
					</h2>
					<p className="text-base-content/70 text-sm">
						Pick an avatar that represents you
					</p>
				</div>

				<div className="grid grid-cols-3 gap-3">
					{AVATARS.map((avatar) => (
						<button
							key={avatar.id}
							className={`btn btn-outline h-16 w-16 p-1 ${
								data.avatar === avatar.id ? "btn-primary" : ""
							}`}
							onClick={() => {
								setData((previous) => ({ ...previous, avatar: avatar.id }));
							}}
						>
							<img
								alt={avatar.name}
								className="w-full h-full rounded-full object-cover"
								src={avatar.src}
							/>
						</button>
					))}
				</div>
			</div>
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
						<img
							alt="Your avatar"
							className="w-12 h-12 rounded-full"
							src={AVATARS.find((a) => a.id === data.avatar)?.src}
						/>
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
			<div className="max-w-lg mx-auto">
				{/* Progress Steps */}
				<div className="mb-8">
					<ul className="steps w-full">
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
					</button>
				</div>
			</div>
		</div>
	);
};
