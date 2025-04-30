import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/layout/navbar/Navbar";
import { Toaster } from "react-hot-toast";
import type { User } from "@supabase/supabase-js";
import type { FunctionComponent } from "../common/types";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";

interface Friend {
	id: string;
	user_id: string;
	friend_id: string;
	status: "accepted" | "blocked";
	created_at: string;
	friend_profile: {
		id: string;
		username: string;
		avatar_name: string;
	};
}

interface FriendInvite {
	id: string;
	sender_id: string;
	receiver_id: string;
	status: "pending";
	created_at: string;
	sender: {
		id: string;
		username: string;
		avatar_name: string;
	};
	receiver: {
		id: string;
		username: string;
		avatar_name: string;
	};
}

interface SearchResult {
	id: string;
	username: string;
	avatar_name: string;
	is_friend: boolean;
	has_pending_invite: boolean;
}

export const Friends = (): FunctionComponent => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [friends, setFriends] = useState<Friend[]>([]);
	const [invites, setInvites] = useState<FriendInvite[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const checkAuth = async (): Promise<void> => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				void navigate({ to: "/signup" });
				return;
			}
			await fetchFriends();
			await fetchInvites();
		};

		void checkAuth();
	}, [navigate]);

	const fetchFriends = async (): Promise<void> => {
		try {
			setLoading(true);
			const { data, error } = await supabase
				.from("friends")
				.select(
					`
					id,
					user_id,
					friend_id,
					status,
					created_at
				`
				)
				.eq("user_id", user?.id)
				.eq("status", "accepted");

			if (error) throw error;

			// Get all friend IDs
			const friendIds = data?.map((friend) => friend.friend_id) || [];

			// Fetch profiles for all friends
			const { data: profiles, error: profilesError } = await supabase
				.from("profiles")
				.select(
					`
					id,
					username,
					avatar_name
				`
				)
				.in("id", friendIds);

			if (profilesError) throw profilesError;

			// Create a map of user IDs to profiles
			const profileMap = new Map();
			profiles?.forEach((profile) => {
				profileMap.set(profile.id, profile);
			});

			// Combine friends with profile data
			const friendsWithProfiles =
				data?.map((friend) => ({
					...friend,
					friend_profile: profileMap.get(friend.friend_id),
				})) || [];

			setFriends(friendsWithProfiles);
		} catch (error) {
			console.error("Error fetching friends:", error);
			setError("Failed to load friends");
		} finally {
			setLoading(false);
		}
	};

	const fetchInvites = async (): Promise<void> => {
		try {
			// Fetch received invites
			const { data: receivedInvites, error: receivedError } = await supabase
				.from("friend_invites")
				.select(
					`
					id,
					sender_id,
					receiver_id,
					status,
					created_at
				`
				)
				.eq("receiver_id", user?.id)
				.eq("status", "pending");

			if (receivedError) throw receivedError;

			// Fetch sent invites
			const { data: sentInvites, error: sentError } = await supabase
				.from("friend_invites")
				.select(
					`
					id,
					sender_id,
					receiver_id,
					status,
					created_at
				`
				)
				.eq("sender_id", user?.id)
				.eq("status", "pending");

			if (sentError) throw sentError;

			// Get all unique user IDs from invites
			const allInvites = [...(receivedInvites || []), ...(sentInvites || [])];
			const userIds = new Set<string>();

			allInvites.forEach((invite) => {
				userIds.add(invite.sender_id);
				userIds.add(invite.receiver_id);
			});

			// Fetch profiles for all users
			const { data: profiles, error: profilesError } = await supabase
				.from("profiles")
				.select(
					`
					id,
					username,
					avatar_name
				`
				)
				.in("id", Array.from(userIds));

			if (profilesError) throw profilesError;

			// Create a map of user IDs to profiles
			const profileMap = new Map();
			profiles?.forEach((profile) => {
				profileMap.set(profile.id, profile);
			});

			// Combine invites with profile data
			const invitesWithProfiles = allInvites.map((invite) => ({
				...invite,
				sender: profileMap.get(invite.sender_id),
				receiver: profileMap.get(invite.receiver_id),
			}));

			setInvites(invitesWithProfiles);
		} catch (error) {
			console.error("Error fetching invites:", error);
			setError("Failed to load friend invites");
		}
	};

	const searchUsers = async (): Promise<void> => {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			return;
		}

		try {
			setIsSearching(true);
			const { data, error } = await supabase
				.from("profiles")
				.select(
					`
          id,
          username,
          avatar_name
        `
				)
				.ilike("username", `%${searchQuery}%`)
				.neq("id", user?.id)
				.limit(10);

			if (error) throw error;

			// Check if users are already friends or have pending invites
			const userIds = data?.map((profile) => profile.id) || [];

			// Get friends
			const { data: friendsData } = await supabase
				.from("friends")
				.select("friend_id")
				.eq("user_id", user?.id)
				.in("friend_id", userIds);

			const friendIds = new Set(friendsData?.map((f) => f.friend_id) || []);

			// Get pending invites
			const { data: invitesData } = await supabase
				.from("friend_invites")
				.select("sender_id, receiver_id")
				.or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
				.in("sender_id", userIds)
				.in("receiver_id", userIds);

			const pendingInviteIds = new Set(
				invitesData?.map((i) =>
					i.sender_id === user?.id ? i.receiver_id : i.sender_id
				) || []
			);

			// Combine results
			const results =
				data?.map((profile) => ({
					...profile,
					is_friend: friendIds.has(profile.id),
					has_pending_invite: pendingInviteIds.has(profile.id),
				})) || [];

			setSearchResults(results);
		} catch (error) {
			console.error("Error searching users:", error);
			setError("Failed to search users");
		} finally {
			setIsSearching(false);
		}
	};

	const handleSearch = (e: React.FormEvent): void => {
		e.preventDefault();
		void searchUsers();
	};

	const sendFriendInvite = async (userId: string): Promise<void> => {
		try {
			const { error } = await supabase.rpc("send_friend_invite", {
				p_receiver_id: userId,
			});

			if (error) throw error;

			// Update search results
			setSearchResults((prev) =>
				prev.map((result) =>
					result.id === userId
						? { ...result, has_pending_invite: true }
						: result
				)
			);
		} catch (error) {
			console.error("Error sending friend invite:", error);
			setError("Failed to send friend invite");
		}
	};

	const acceptInvite = async (inviteId: string): Promise<void> => {
		try {
			const { error } = await supabase.rpc("accept_friend_invite", {
				p_invite_id: inviteId,
			});

			if (error) throw error;

			// Refresh friends and invites
			await fetchFriends();
			await fetchInvites();
		} catch (error) {
			console.error("Error accepting friend invite:", error);
			setError("Failed to accept friend invite");
		}
	};

	const rejectInvite = async (inviteId: string): Promise<void> => {
		try {
			const { error } = await supabase.rpc("reject_friend_invite", {
				p_invite_id: inviteId,
			});

			if (error) throw error;

			// Refresh invites
			await fetchInvites();
		} catch (error) {
			console.error("Error rejecting friend invite:", error);
			setError("Failed to reject friend invite");
		}
	};

	const removeFriend = async (friendId: string): Promise<void> => {
		try {
			const { error } = await supabase.rpc("remove_friend", {
				p_friend_id: friendId,
			});

			if (error) throw error;

			// Refresh friends
			await fetchFriends();
		} catch (error) {
			console.error("Error removing friend:", error);
			setError("Failed to remove friend");
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading friends...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<Toaster position="bottom-center" />
			<Navbar />
			<div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8 pt-20">
				<h1 className="text-3xl font-bold text-gray-900 mb-8">Friends</h1>

				{/* Search Section */}
				<div className="bg-white rounded-lg shadow mb-6 p-6">
					<h2 className="text-xl font-semibold text-gray-900 mb-4">
						Find Friends
					</h2>
					<form onSubmit={handleSearch} className="mb-4">
						<div className="flex gap-2">
							<input
								className="flex-1 min-w-0 px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
								onChange={(event) => {
									setSearchQuery(event.target.value);
								}}
								placeholder="Search by username"
								type="text"
								value={searchQuery}
							/>
							<button
								className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
								type="submit"
								disabled={isSearching}
							>
								{isSearching ? (
									<div className="flex items-center gap-2">
										<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
										<span>Searching...</span>
									</div>
								) : (
									"Search"
								)}
							</button>
						</div>
					</form>

					{searchResults.length > 0 && (
						<div className="space-y-3">
							{searchResults.map((result) => (
								<div
									key={result.id}
									className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
								>
									<div className="flex items-center gap-3">
										<img
											alt={`${result.username}'s avatar`}
											className="h-10 w-10 rounded-full"
											src={`/avatars/${result.avatar_name}.svg`}
										/>
										<span className="font-medium text-gray-900">
											{result.username}
										</span>
									</div>
									{result.is_friend ? (
										<span className="text-green-600 font-medium">Friends</span>
									) : result.has_pending_invite ? (
										<span className="text-yellow-600 font-medium">
											Invite Sent
										</span>
									) : (
										<button
											className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
											onClick={() => void sendFriendInvite(result.id)}
										>
											Add Friend
										</button>
									)}
								</div>
							))}
						</div>
					)}

					{searchQuery && searchResults.length === 0 && !isSearching && (
						<div className="text-center py-8">
							<p className="text-gray-500">
								No users found matching "{searchQuery}"
							</p>
						</div>
					)}
				</div>

				{/* Friend Requests Section */}
				<div className="space-y-6">
					{/* Received Requests */}
					{invites.filter((invite) => invite.receiver_id === user?.id).length >
						0 && (
						<div className="bg-white rounded-lg shadow p-6">
							<h2 className="text-xl font-semibold text-gray-900 mb-4">
								Friend Requests{" "}
								<span className="text-sm font-normal text-gray-500">
									(
									{
										invites.filter((invite) => invite.receiver_id === user?.id)
											.length
									}
									)
								</span>
							</h2>
							<div className="space-y-3">
								{invites
									.filter((invite) => invite.receiver_id === user?.id)
									.map((invite) => (
										<div
											key={invite.id}
											className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
										>
											<div className="flex items-center gap-3">
												<img
													alt={`${invite.sender.username}'s avatar`}
													className="h-10 w-10 rounded-full"
													src={`/avatars/${invite.sender.avatar_name}.svg`}
												/>
												<span className="font-medium text-gray-900">
													{invite.sender.username}
												</span>
											</div>
											<div className="flex gap-2">
												<button
													className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
													onClick={() => void acceptInvite(invite.id)}
												>
													Accept
												</button>
												<button
													className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
													onClick={() => void rejectInvite(invite.id)}
												>
													Reject
												</button>
											</div>
										</div>
									))}
							</div>
						</div>
					)}

					{/* Sent Requests */}
					{invites.filter((invite) => invite.sender_id === user?.id).length >
						0 && (
						<div className="bg-white rounded-lg shadow p-6">
							<h2 className="text-xl font-semibold text-gray-900 mb-4">
								Sent Requests{" "}
								<span className="text-sm font-normal text-gray-500">
									(
									{
										invites.filter((invite) => invite.sender_id === user?.id)
											.length
									}
									)
								</span>
							</h2>
							<div className="space-y-3">
								{invites
									.filter((invite) => invite.sender_id === user?.id)
									.map((invite) => (
										<div
											key={invite.id}
											className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
										>
											<div className="flex items-center gap-3">
												<img
													alt={`${invite.receiver.username}'s avatar`}
													className="h-10 w-10 rounded-full"
													src={`/avatars/${invite.receiver.avatar_name}.svg`}
												/>
												<span className="font-medium text-gray-900">
													{invite.receiver.username}
												</span>
											</div>
											<span className="text-yellow-600 font-medium px-4 py-2 bg-yellow-50 rounded-lg">
												Pending
											</span>
										</div>
									))}
							</div>
						</div>
					)}

					{/* Friends List */}
					<div className="bg-white rounded-lg shadow p-6">
						<h2 className="text-xl font-semibold text-gray-900 mb-4">
							Your Friends{" "}
							<span className="text-sm font-normal text-gray-500">
								({friends.length})
							</span>
						</h2>

						{friends.length === 0 ? (
							<div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
								<svg
									className="mx-auto h-12 w-12 text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
									/>
								</svg>
								<h3 className="mt-2 text-sm font-medium text-gray-900">
									No friends yet
								</h3>
								<p className="mt-1 text-sm text-gray-500">
									Search for users to add them as friends.
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{friends.map((friend) => (
									<div
										key={friend.id}
										className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
									>
										<div className="flex items-center gap-3">
											<img
												alt={`${friend.friend_profile.username}'s avatar`}
												className="h-10 w-10 rounded-full"
												src={`/avatars/${friend.friend_profile.avatar_name}.svg`}
											/>
											<span className="font-medium text-gray-900">
												{friend.friend_profile.username}
											</span>
										</div>
										<button
											className="text-red-600 hover:text-red-700 font-medium focus:outline-none"
											onClick={() => void removeFriend(friend.friend_id)}
										>
											Remove
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{error && (
					<div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
						<p className="text-sm text-red-600">{error}</p>
					</div>
				)}
			</div>
		</div>
	);
};
