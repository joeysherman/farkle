import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-hot-toast";

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
			<div className="loading loading-spinner loading-lg text-accent"></div>
		</div>
	);
}

export const Profile = (): FunctionComponent => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const search = useSearch({ from: "/app/profile" });
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
	const [userNotFound, setUserNotFound] = useState(false);
	const [friendshipStatus, setFriendshipStatus] = useState<
		"none" | "friends" | "pending" | "received"
	>("none");
	const [isLoadingFriendship, setIsLoadingFriendship] = useState(false);

	// Check if we're viewing someone else's profile
	const viewingOtherId = search?.id;
	const isViewingOwnProfile = !viewingOtherId;

	const fetchProfile = async (userId: string): Promise<void> => {
		try {
			setUserNotFound(false);
			const { data, error } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", userId)
				.single();

			if (error) {
				if (error.code === "PGRST116") {
					// No rows returned - user not found
					setUserNotFound(true);
					setProfile(null);
				} else {
					throw error;
				}
				return;
			}

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
			setError("Failed to load profile");
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

			// Fetch the profile for the user we want to view
			const userIdToFetch = viewingOtherId || user.id;
			await fetchProfile(userIdToFetch);

			// Check friendship status if viewing someone else's profile
			if (viewingOtherId) {
				await checkFriendshipStatus(user.id, viewingOtherId);
			}
		};

		void checkAuth();
	}, [navigate, viewingOtherId]);

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

	const checkFriendshipStatus = async (
		currentUserId: string,
		targetUserId: string
	): Promise<void> => {
		try {
			setIsLoadingFriendship(true);

			// Check if they are already friends
			const { data: friendData, error: friendError } = await supabase
				.from("friends")
				.select("*")
				.or(
					`and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`
				)
				.eq("status", "accepted");

			if (friendError) throw friendError;

			if (friendData && friendData.length > 0) {
				setFriendshipStatus("friends");
				return;
			}

			// Check for pending invites
			const { data: inviteData, error: inviteError } = await supabase
				.from("friend_invites")
				.select("*")
				.or(
					`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`
				)
				.eq("status", "pending");

			if (inviteError) throw inviteError;

			if (inviteData && inviteData.length > 0) {
				const invite = inviteData[0];
				if (invite.sender_id === currentUserId) {
					setFriendshipStatus("pending");
				} else {
					setFriendshipStatus("received");
				}
				return;
			}

			setFriendshipStatus("none");
		} catch (error) {
			console.error("Error checking friendship status:", error);
			setFriendshipStatus("none");
		} finally {
			setIsLoadingFriendship(false);
		}
	};

	const sendFriendInvite = async (): Promise<void> => {
		if (!user || !viewingOtherId) return;

		try {
			setIsLoadingFriendship(true);
			const { error } = await supabase.from("friend_invites").insert([
				{
					sender_id: user.id,
					receiver_id: viewingOtherId,
					status: "pending",
				},
			]);

			if (error) throw error;

			setFriendshipStatus("pending");
			toast.success("Friend request sent!");
		} catch (error) {
			console.error("Error sending friend invite:", error);
			toast.error("Failed to send friend request");
		} finally {
			setIsLoadingFriendship(false);
		}
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
			<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100 flex items-center justify-center p-4">
				<LoadingSpinner />
			</div>
		);
	}

	// User not found view
	if (userNotFound) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100 flex items-center justify-center p-4">
				<div className="card bg-base-100 shadow-md ring-1 ring-base-300 max-w-md w-full">
					<div className="card-body text-center">
						<h2 className="card-title text-2xl justify-center mb-4 text-neutral">
							User Not Found
						</h2>
						<p className="text-slate-500 text-md mb-6">
							The user you're looking for doesn't exist or may have been
							deleted.
						</p>
						<button
							className="btn btn-accent"
							onClick={() => navigate({ to: "/app/profile" })}
						>
							Go to My Profile
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Render different content based on whether we're viewing our own profile or someone else's
	return (
		<div className="container mx-auto pt-6">
			{/* Profile Information Card */}
			<div className="card bg-base-100 shadow-md ring-1 ring-base-300">
				<div className="card-body">
					<div className="flex items-center justify-between mb-6">
						<h2 className="card-title text-2xl text-neutral">
							{isViewingOwnProfile
								? "Profile Information"
								: `${profile?.username}'s Profile`}
						</h2>
						{!isViewingOwnProfile && (
							<button
								className="btn btn-outline btn-sm"
								onClick={() => navigate({ to: "/app/profile" })}
							>
								View My Profile
							</button>
						)}
					</div>

					{/* Avatar Section */}
					<div className="flex items-center gap-6 mb-8">
						<div className="avatar">
							<div className="w-24 rounded-full ring ring-accent ring-offset-base-100 ring-offset-2">
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
							{isViewingOwnProfile ? (
								<button
									className="btn btn-outline btn-accent"
									onClick={() => setIsSelectingAvatar(true)}
									disabled={isUploading}
								>
									{isUploading ? "Updating..." : "Change Avatar"}
								</button>
							) : (
								<div className="flex items-center gap-3">
									{isLoadingFriendship ? (
										<div className="loading loading-spinner loading-sm"></div>
									) : (
										<>
											{friendshipStatus === "friends" && (
												<div className="badge badge-success">Friends</div>
											)}
											{friendshipStatus === "pending" && (
												<div className="badge badge-warning">Pending</div>
											)}
											{friendshipStatus === "received" && (
												<div className="badge badge-neutral">
													Request Received
												</div>
											)}
											{friendshipStatus === "none" && (
												<button
													className="btn btn-accent btn-sm"
													onClick={() => void sendFriendInvite()}
												>
													Add Friend
												</button>
											)}
										</>
									)}
								</div>
							)}
						</div>
					</div>

					{/* Profile Details */}
					<div className="space-y-4">
						{/* Username */}
						<div className="form-control">
							<label className="label" htmlFor="username">
								<span className="label-text">Username</span>
							</label>
							{isEditing && isViewingOwnProfile ? (
								<div className="flex gap-2">
									<input
										id="username"
										className="input input-bordered flex-1"
										placeholder="Enter new username"
										type="text"
										value={newUsername}
										onChange={(event) => setNewUsername(event.target.value)}
									/>
									<button
										className="btn btn-accent"
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
									<span className="text-base-content">{profile?.username}</span>
									{!profile?.hasChangedUsername && isViewingOwnProfile && (
										<button
											className="btn btn-outline btn-accent btn-sm"
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

						{/* Email - only show for own profile */}
						{isViewingOwnProfile && (
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
						)}

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

			{/* Notification Settings - only show for own profile */}
			{isViewingOwnProfile && (
				<div className="card bg-base-100 shadow-md ring-1 ring-base-300 mt-6">
					<div className="card-body">
						<h3 className="card-title text-xl mb-4 text-neutral">
							Notification Settings
						</h3>

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
										className="btn btn-outline btn-accent btn-sm"
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
										className={`btn btn-sm ${isSubscribed ? "btn-outline btn-error" : "btn-accent"}`}
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
			)}

			{/* Avatar Builder Modal - only show for own profile */}
			{isSelectingAvatar &&
				profile &&
				isViewingOwnProfile &&
				createPortal(
					<div className="modal modal-open fixed inset-0 z-[9999] bg-black bg-opacity-50">
						<div className="modal-box relative w-11/12 max-w-5xl max-h-[90vh] mx-auto my-8 overflow-y-auto bg-base-100">
							<div className="mb-4">
								<h3 className="font-bold text-lg text-neutral">
									Customize Your Avatar
								</h3>
								<p className="text-sm text-slate-500">
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
									className="btn btn-accent"
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

			{/* Upload Status - only show for own profile */}
			{uploadStatus && isViewingOwnProfile && (
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
	);
};
