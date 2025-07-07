import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";

import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import type { FunctionComponent } from "../common/types";
import { useNotifications } from "../contexts/NotificationContext";
import {
	AvatarBuilder,
	type AvatarOptions,
	type AvatarBuilderRef,
} from "../components/AvatarBuilder";
import { useAvatarUpload } from "../hooks/useAvatarUpload";

interface Profile {
	id: string;
	username: string;
	avatarName: string;
	createdAt: string;
	hasChangedUsername: boolean;
	fcmToken: string | null;
}

interface DatabaseProfile {
	id: string;
	username: string;
	avatar_name: string;
	created_at: string;
	has_changed_username: boolean;
	fcm_token: string | null;
}

// Loading spinner component
function LoadingSpinner(): JSX.Element {
	return (
		<div className="flex justify-center items-center">
			<div className="loading loading-spinner loading-lg text-primary"></div>
		</div>
	);
}

export const Profile = (): FunctionComponent => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const avatarBuilderRef = useRef<AvatarBuilderRef>(null);
	const { uploadAvatar, uploadStatus, isUploading } = useAvatarUpload();
	const {
		isSubscribed,
		error: notificationError,
		handleSubscribe,
		handleUnsubscribe,
		browserPermission,
		checkBrowserPermission,
	} = useNotifications();
	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [newUsername, setNewUsername] = useState("");
	const [error, setError] = useState("");
	const [isSelectingAvatar, setIsSelectingAvatar] = useState(false);
	const [avatarOptions, setAvatarOptions] = useState<AvatarOptions | undefined>(
		undefined
	);

	const fetchProfile = async (userId: string): Promise<void> => {
		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", userId)
				.single();

			if (error) throw error;

			const dbProfile = data as DatabaseProfile;
			const formattedProfile: Profile = {
				id: dbProfile.id,
				username: dbProfile.username,
				avatarName: dbProfile.avatar_name,
				createdAt: dbProfile.created_at,
				hasChangedUsername: dbProfile.has_changed_username,
				fcmToken: dbProfile.fcm_token,
			};

			setProfile(formattedProfile);
		} catch (error) {
			console.error("Error fetching profile:", error);
		} finally {
			setLoading(false);
		}
	};

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
			await fetchProfile(user.id);
		};

		void checkAuth();
	}, [navigate]);

	const handleUsernameUpdate = async (): Promise<void> => {
		if (!user || !newUsername.trim() || !profile?.id) return;

		try {
			setError("");
			const { error } = await supabase
				.from("profiles")
				.update({
					username: newUsername.trim(),
					has_changed_username: true,
				})
				.eq("id", profile.id);

			if (error) throw error;

			setProfile((previous) =>
				previous
					? {
							...previous,
							username: newUsername.trim(),
							hasChangedUsername: true,
						}
					: null
			);
			setIsEditing(false);
		} catch (error) {
			console.error("Error updating username:", error);

			setError(
				error instanceof Error ? error.message : "Failed to update username"
			);
		}
	};

	const handleAvatarSave = async (): Promise<void> => {
		if (!user || !avatarOptions) return;

		try {
			setError("");

			// Upload the avatar
			const avatarUrl = await uploadAvatar(avatarBuilderRef, user.id);

			if (!avatarUrl) {
				throw new Error("Failed to upload avatar");
			}

			// Update the profile with the new avatar URL
			await supabase
				.from("profiles")
				.update({ avatar_name: avatarUrl })
				.eq("id", user.id);

			queryClient.invalidateQueries({ queryKey: ["user", "profile", user.id] });
			setProfile((previous) =>
				previous ? { ...previous, avatarName: avatarUrl } : null
			);
			setIsSelectingAvatar(false);
		} catch (error) {
			console.error("Error updating avatar:", error);
			setError(
				error instanceof Error ? error.message : "Failed to update avatar"
			);
		}
	};

	// Handle body scroll lock for modal
	useEffect(() => {
		if (isSelectingAvatar) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}

		// Cleanup on unmount
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isSelectingAvatar]);

	const handleNotificationToggle = async (): Promise<void> => {
		if (isSubscribed) {
			await handleUnsubscribe();
		} else {
			await handleSubscribe();
		}
	};

	// Function to get browser permission status text
	const getBrowserPermissionText = (): string => {
		switch (browserPermission) {
			case "granted":
				return "Allowed";
			case "denied":
				return "Blocked";
			case "default":
				return "Not set";
			default:
				return "Unknown";
		}
	};

	// Function to get browser permission status color
	const getBrowserPermissionColor = (): string => {
		switch (browserPermission) {
			case "granted":
				return "badge-success";
			case "denied":
				return "badge-error";
			case "default":
				return "badge-warning";
			default:
				return "badge-neutral";
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
				<LoadingSpinner />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 p-4 py-8">
			<div className="container mx-auto max-w-4xl space-y-6">
				{/* Profile Information Card */}
				<div className="card bg-base-100 shadow-2xl">
					<div className="card-body">
						<h2 className="card-title text-2xl mb-6">Profile Information</h2>

						{/* Avatar Section */}
						<div className="flex items-center gap-6 mb-8">
							<div className="avatar">
								<div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
									<img
										alt="Profile"
										src={profile?.avatarName || "/avatars/default.svg"}
										onError={(e) => {
											const target = e.target as HTMLImageElement;
											target.src = "/avatars/default.svg";
										}}
									/>
								</div>
							</div>
							<div className="flex-1">
								<button
									className="btn btn-outline btn-primary"
									onClick={() => setIsSelectingAvatar(true)}
									disabled={isUploading}
								>
									{isUploading ? "Updating..." : "Change Avatar"}
								</button>
							</div>
						</div>

						{/* Profile Details */}
						<div className="space-y-4">
							{/* Username */}
							<div className="form-control">
								<label className="label" htmlFor="username">
									<span className="label-text">Username</span>
								</label>
								{isEditing ? (
									<div className="flex gap-2">
										<input
											id="username"
											className="input input-bordered input-primary flex-1"
											placeholder="Enter new username"
											type="text"
											value={newUsername}
											onChange={(event) => setNewUsername(event.target.value)}
										/>
										<button
											className="btn btn-primary"
											onClick={handleUsernameUpdate}
										>
											Save
										</button>
										<button
											className="btn btn-outline"
											onClick={() => setIsEditing(false)}
										>
											Cancel
										</button>
									</div>
								) : (
									<div className="flex items-center gap-3">
										<span className="text-base-content">
											{profile?.username}
										</span>
										{!profile?.hasChangedUsername && (
											<button
												className="btn btn-outline btn-primary btn-sm"
												onClick={() => {
													setNewUsername(profile?.username || "");
													setIsEditing(true);
												}}
											>
												Change
											</button>
										)}
									</div>
								)}
							</div>

							{/* Email */}
							<div className="form-control">
								<label className="label" htmlFor="email">
									<span className="label-text">Email</span>
								</label>
								<div
									className="input input-bordered bg-base-200 flex items-center px-4"
									id="email"
								>
									{user?.email}
								</div>
							</div>

							{/* Account Created */}
							<div className="form-control">
								<label className="label" htmlFor="created">
									<span className="label-text">Account Created</span>
								</label>
								<div
									className="input input-bordered bg-base-200 flex items-center px-4"
									id="created"
								>
									{new Date(profile?.createdAt || "").toLocaleDateString()}
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Notification Settings */}
				<div className="card bg-base-100 shadow-2xl">
					<div className="card-body">
						<h3 className="card-title text-xl mb-4">Notification Settings</h3>

						<div className="space-y-4">
							{/* Browser Permission Status */}
							<div className="form-control">
								<label className="label" htmlFor="browser-notifications">
									<span className="label-text">Browser notifications</span>
								</label>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div
											className={`badge ${getBrowserPermissionColor()}`}
											id="browser-notifications"
										>
											{getBrowserPermissionText()}
										</div>
									</div>
									<button
										className="btn btn-outline btn-primary btn-sm"
										onClick={() => checkBrowserPermission()}
									>
										Refresh
									</button>
								</div>
							</div>

							{/* App Notification Status */}
							<div className="form-control">
								<label className="label" htmlFor="app-notifications">
									<span className="label-text">App notifications</span>
								</label>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div
											className={`badge ${isSubscribed ? "badge-success" : "badge-neutral"}`}
											id="app-notifications"
										>
											{isSubscribed ? "Enabled" : "Disabled"}
										</div>
									</div>
									<button
										className={`btn btn-sm ${isSubscribed ? "btn-outline btn-error" : "btn-primary"}`}
										onClick={() => void handleNotificationToggle()}
									>
										{isSubscribed ? "Disable" : "Enable"}
									</button>
								</div>
							</div>

							{/* Error Messages */}
							{notificationError && (
								<div className="alert alert-error">
									<span>{notificationError}</span>
								</div>
							)}

							{browserPermission === "denied" && (
								<div className="alert alert-warning">
									<span>
										Browser notifications are blocked. Please enable them in
										your browser settings to receive notifications.
									</span>
								</div>
							)}

							<div className="text-sm text-base-content/70">
								Receive notifications about important updates and events.
							</div>
						</div>
					</div>
				</div>

				{/* Avatar Builder Modal */}
				{isSelectingAvatar &&
					profile &&
					createPortal(
						<div className="modal modal-open fixed inset-0 z-[9999] bg-black bg-opacity-50">
							<div className="modal-box relative w-11/12 max-w-5xl max-h-[90vh] mx-auto my-8 overflow-y-auto bg-base-100">
								<div className="mb-4">
									<h3 className="font-bold text-lg">Customize Your Avatar</h3>
									<p className="text-sm text-base-content/70">
										Create a unique avatar that represents you
									</p>
								</div>

								<div className="max-h-[calc(90vh-12rem)] overflow-y-auto">
									<AvatarBuilder
										ref={avatarBuilderRef}
										initialOptions={avatarOptions}
										onAvatarChange={setAvatarOptions}
									/>
								</div>

								<div className="modal-action sticky bottom-0 bg-base-100 pt-4 mt-4 border-t border-base-300">
									<button
										className="btn btn-outline"
										onClick={() => setIsSelectingAvatar(false)}
										disabled={isUploading}
									>
										Cancel
									</button>
									<button
										className="btn btn-primary"
										onClick={() => void handleAvatarSave()}
										disabled={!avatarOptions || isUploading}
									>
										{isUploading ? <LoadingSpinner /> : "Save Avatar"}
									</button>
								</div>
							</div>
						</div>,
						document.body
					)}

				{/* Upload Status */}
				{uploadStatus && (
					<div className="alert alert-info">
						<div className="flex items-center">
							<span className="loading loading-spinner loading-sm mr-2"></span>
							<span>{uploadStatus}</span>
						</div>
					</div>
				)}

				{/* Error Alert */}
				{error && (
					<div className="alert alert-error mb-4">
						<span>{error}</span>
					</div>
				)}
			</div>
		</div>
	);
};
