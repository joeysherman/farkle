import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AvatarSelector, type AvatarName } from "../components/AvatarSelector";
import { supabase } from "../lib/supabaseClient";

import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import type { FunctionComponent } from "../common/types";
import { useNotifications } from "../contexts/NotificationContext";

const AVAILABLE_AVATARS = [
	"default",
	"avatar_1",
	"avatar_2",
	"avatar_3",
	"avatar_4",
	"avatar_5",
	"avatar_6",
] as const;

interface Profile {
	id: string;
	username: string;
	avatarName: AvatarName;
	createdAt: string;
	hasChangedUsername: boolean;
	fcmToken: string | null;
}

interface DatabaseProfile {
	id: string;
	username: string;
	avatar_name: AvatarName;
	created_at: string;
	has_changed_username: boolean;
	fcm_token: string | null;
}

export const Profile = (): FunctionComponent => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
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

	const handleAvatarSelect = async (avatarName: AvatarName): Promise<void> => {
		if (!user) return;

		await supabase
			.from("profiles")
			.update({ avatar_name: avatarName })
			.eq("id", user.id);
		queryClient.invalidateQueries({ queryKey: ["user", "profile", user.id] });
		setProfile((previous) => (previous ? { ...previous, avatarName } : null));
		setIsSelectingAvatar(false);
	};

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
			<div className="min-h-screen bg-base-200 flex items-center justify-center">
				<div className="text-center">
					<span className="loading loading-spinner loading-lg"></span>
					<p className="mt-4 text-base-content/70">Loading profile...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="card bg-base-100 shadow-xl">
				<div className="card-body">
					<h2 className="card-title text-2xl mb-6">Profile Information</h2>

					{/* Avatar Section */}
					<div className="flex items-center gap-6 mb-8">
						<div className="avatar">
							<div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
								<img
									alt="Profile"
									src={`${profile?.avatarName || "default"}`}
								/>
							</div>
						</div>
						<div className="flex-1 space-y-4">
							<button
								className="btn btn-outline btn-sm"
								onClick={() => setIsSelectingAvatar(true)}
							>
								Change Avatar
							</button>
						</div>
					</div>

					{/* Profile Details */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Username */}
						<div className="form-control">
							<label className="label">
								<span className="label-text font-medium">Username</span>
							</label>
							{isEditing ? (
								<div className="flex gap-2">
									<input
										className="input input-bordered flex-1"
										placeholder="Enter new username"
										type="text"
										value={newUsername}
										onChange={(event) => setNewUsername(event.target.value)}
									/>
									<button
										className="btn btn-primary btn-sm"
										onClick={handleUsernameUpdate}
									>
										Save
									</button>
									<button
										className="btn btn-outline btn-sm"
										onClick={() => setIsEditing(false)}
									>
										Cancel
									</button>
								</div>
							) : (
								<div className="flex items-center gap-3">
									<span className="text-base-content">{profile?.username}</span>
									{!profile?.hasChangedUsername && (
										<button
											className="btn btn-outline btn-xs"
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
							<label className="label">
								<span className="label-text font-medium">Email</span>
							</label>
							<div className="text-base-content">{user?.email}</div>
						</div>

						{/* Account Created */}
						<div className="form-control">
							<label className="label">
								<span className="label-text font-medium">Account Created</span>
							</label>
							<div className="text-base-content">
								{new Date(profile?.createdAt || "").toLocaleDateString()}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Notification Settings */}
			<div className="card bg-base-100 shadow-xl">
				<div className="card-body">
					<h3 className="card-title text-xl mb-4">Notification Settings</h3>

					<div className="space-y-4">
						{/* Browser Permission Status */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="text-base-content">
									Browser notifications:
								</span>
								<div className={`badge ${getBrowserPermissionColor()}`}>
									{getBrowserPermissionText()}
								</div>
							</div>
							<button
								className="btn btn-outline btn-sm"
								onClick={() => checkBrowserPermission()}
							>
								Refresh
							</button>
						</div>

						{/* App Notification Status */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="text-base-content">App notifications:</span>
								<div
									className={`badge ${isSubscribed ? "badge-success" : "badge-neutral"}`}
								>
									{isSubscribed ? "Enabled" : "Disabled"}
								</div>
							</div>
							<button
								className={`btn btn-sm ${isSubscribed ? "btn-error" : "btn-primary"}`}
								onClick={() => void handleNotificationToggle()}
							>
								{isSubscribed ? "Disable" : "Enable"}
							</button>
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
									Browser notifications are blocked. Please enable them in your
									browser settings to receive notifications.
								</span>
							</div>
						)}

						<div className="text-sm text-base-content/70">
							Receive notifications about important updates and events.
						</div>
					</div>
				</div>
			</div>

			{/* Avatar Selection Modal */}
			{isSelectingAvatar && profile && (
				<div className="modal modal-open">
					<div className="modal-box">
						<AvatarSelector
							currentAvatar={profile.avatarName}
							onClose={() => setIsSelectingAvatar(false)}
							onSelect={handleAvatarSelect}
						/>
					</div>
				</div>
			)}

			{/* Error Alert */}
			{error && (
				<div className="alert alert-error">
					<span>{error}</span>
				</div>
			)}
		</div>
	);
};
