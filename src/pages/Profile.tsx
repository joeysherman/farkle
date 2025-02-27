import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/layout/navbar/Navbar";
import type { User } from "@supabase/supabase-js";
import type { FunctionComponent } from "../common/types";

const AVAILABLE_AVATARS = [
	"default",
	// "avatar1",
	// "avatar2",
	// "avatar3",
	// "avatar4",
	// "avatar5",
] as const;

type AvatarName = (typeof AVAILABLE_AVATARS)[number];

interface Profile {
	id: string;
	username: string;
	avatarName: AvatarName;
	createdAt: string;
	hasChangedUsername: boolean;
}

interface DatabaseProfile {
	id: string;
	username: string;
	avatar_name: AvatarName;
	created_at: string;
	has_changed_username: boolean;
}

export const Profile = (): FunctionComponent => {
	const navigate = useNavigate();
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

		try {
			setError("");
			const { error: updateError } = await supabase
				.from("profiles")
				.update({ avatar_name: avatarName })
				.eq("id", user.id);

			if (updateError) throw updateError;

			setProfile((previous) => (previous ? { ...previous, avatarName } : null));
			setIsSelectingAvatar(false);
		} catch (error) {
			console.error("Error updating avatar:", error);
			setError(
				error instanceof Error ? error.message : "Failed to update avatar"
			);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading profile...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100">
			<Navbar />
			<div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
				<div className="bg-white shadow sm:rounded-lg">
					<div className="px-4 py-5 sm:p-6">
						<h3 className="text-lg font-medium leading-6 text-gray-900">
							Profile Information
						</h3>

						{/* Avatar Section */}
						<div className="mt-6 flex items-center">
							<div className="flex-shrink-0">
								<div className="relative">
									<img
										alt="Profile"
										className="h-24 w-24 rounded-full object-cover"
										src={`/avatars/${profile?.avatarName}.svg`}
									/>
									<button
										className="absolute bottom-0 right-0 bg-indigo-600 rounded-full p-2 cursor-pointer hover:bg-indigo-700"
										onClick={() => setIsSelectingAvatar(true)}
									>
										<svg
											className="h-4 w-4 text-white"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
											/>
											<path
												d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
											/>
										</svg>
									</button>
								</div>
							</div>

							{/* Profile Details */}
							<div className="ml-6">
								<div className="mb-4">
									<label className="block text-sm font-medium text-gray-700">
										Username
									</label>
									{isEditing ? (
										<div className="mt-1 flex rounded-md shadow-sm">
											<input
												className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
												onChange={(event) => {
													setNewUsername(event.target.value);
												}}
												placeholder="Enter new username"
												type="text"
												value={newUsername}
											/>
											<button
												className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
												onClick={handleUsernameUpdate}
											>
												Save
											</button>
											<button
												className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
												onClick={() => {
													setIsEditing(false);
												}}
											>
												Cancel
											</button>
										</div>
									) : (
										<div className="mt-1 flex items-center">
											<span className="text-gray-900">{profile?.username}</span>
											{!profile?.hasChangedUsername && (
												<button
													className="ml-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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

								<div className="mb-4">
									<label className="block text-sm font-medium text-gray-700">
										Email
									</label>
									<div className="mt-1 text-gray-900">{user?.email}</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700">
										Account Created
									</label>
									<div className="mt-1 text-gray-900">
										{new Date(profile?.createdAt || "").toLocaleDateString()}
									</div>
								</div>
							</div>
						</div>

						{/* Avatar Selection Modal */}
						{isSelectingAvatar && (
							<div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
								<div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
									<div className="flex justify-between items-center mb-4">
										<h3 className="text-lg font-medium text-gray-900">
											Select Avatar
										</h3>
										<button
											className="text-gray-400 hover:text-gray-500"
											onClick={() => setIsSelectingAvatar(false)}
										>
											<span className="sr-only">Close</span>
											<svg
												className="h-6 w-6"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</button>
									</div>
									<div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
										{AVAILABLE_AVATARS.map((avatarName) => (
											<button
												key={avatarName}
												className={`relative rounded-lg p-2 flex items-center justify-center ${
													profile?.avatarName === avatarName
														? "ring-2 ring-indigo-500"
														: "hover:bg-gray-50"
												}`}
												onClick={() => handleAvatarSelect(avatarName)}
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
							</div>
						)}

						{error && <div className="mt-4 text-sm text-red-600">{error}</div>}
					</div>
				</div>
			</div>
		</div>
	);
};
