import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import type { FunctionComponent } from "../common/types";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";

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
	const navigate = useNavigate();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [friends, setFriends] = useState<Friend[]>([]);
	const [invites, setInvites] = useState<FriendInvite[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
		null
	);

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

	useEffect(() => {
		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
		};
	}, [debounceTimer]);

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
			toast.error("Failed to load friends");
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
			toast.error("Failed to load friend invites");
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
			toast.error("Failed to search users");
		} finally {
			setIsSearching(false);
		}
	};

	const handleSearchInput = (
		event: React.ChangeEvent<HTMLInputElement>
	): void => {
		const value = event.target.value;
		setSearchQuery(value);

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		if (value.trim()) {
			const timer = setTimeout(() => {
				void searchUsers();
			}, 500);
			setDebounceTimer(timer);
		} else {
			setSearchResults([]);
		}
	};

	const handleSearch = (event: React.FormEvent): void => {
		event.preventDefault();
		if (searchQuery.trim()) {
			void searchUsers();
		}
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
			toast.success("Friend request sent successfully!");
		} catch (error) {
			console.error("Error sending friend invite:", error);
			toast.error("Failed to send friend request");
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
			toast.success("Friend request accepted!");
		} catch (error) {
			console.error("Error accepting friend invite:", error);
			toast.error("Failed to accept friend request");
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
			toast.success("Friend request rejected");
		} catch (error) {
			console.error("Error rejecting friend invite:", error);
			toast.error("Failed to reject friend request");
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
			toast.success("Friend removed successfully");
		} catch (error) {
			console.error("Error removing friend:", error);
			toast.error("Failed to remove friend");
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
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
				<h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 pl-4">
					Friends
				</h1>

				{/* Combined Friends Section */}
				<div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
					<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
						Your Friends{" "}
						<span className="text-sm font-normal text-gray-500">
							({friends.length})
						</span>
					</h2>

					{/* Search Bar */}
					<form onSubmit={handleSearch} className="mb-6">
						<div className="flex gap-2">
							<input
								className="flex-1 min-w-0 px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
								placeholder="Search by username"
								type="text"
								value={searchQuery}
								onChange={handleSearchInput}
							/>
							<button
								className="w-32 px-4 sm:px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center justify-center"
								type="submit"
								disabled={isSearching}
							>
								{isSearching ? (
									<div className="flex items-center gap-2">
										<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
										<span className="hidden sm:inline">Searching...</span>
									</div>
								) : (
									<>
										<span className="hidden sm:inline">Search</span>
										<span className="sm:hidden">Find</span>
									</>
								)}
							</button>
						</div>
					</form>

					{/* Search Results */}
					{searchResults.length > 0 && (
						<div className="space-y-2 mb-6">
							<h3 className="text-sm font-medium text-gray-700 mb-3">
								Search Results
							</h3>
							{searchResults.map((result) => (
								<div
									key={result.id}
									className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200"
								>
									<div className="flex items-center gap-3">
										<img
											alt={`${result.username}'s avatar`}
											className="h-8 w-8 sm:h-10 sm:w-10 rounded-full"
											src={`/avatars/${result.avatar_name}.svg`}
										/>
										<span className="font-medium text-gray-900">
											{result.username}
										</span>
									</div>
									{result.is_friend ? (
										<span className="text-sm sm:text-base text-green-600 font-medium">
											Friends
										</span>
									) : result.has_pending_invite ? (
										<span className="text-sm sm:text-base text-yellow-600 font-medium">
											Pending
										</span>
									) : (
										<button
											className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
											onClick={() => void sendFriendInvite(result.id)}
										>
											Add
										</button>
									)}
								</div>
							))}
						</div>
					)}

					{searchQuery && searchResults.length === 0 && !isSearching && (
						<div className="text-center py-4 mb-6">
							<p className="text-gray-500">
								No users found matching "{searchQuery}"
							</p>
						</div>
					)}

					{/* Friends List */}
					<div className="space-y-2">
						<h3 className="text-sm font-medium text-gray-700 mb-3">
							Current Friends
						</h3>
						{friends.length === 0 ? (
							<div className="text-center py-8 sm:py-12 bg-gray-50 rounded-lg border border-gray-200">
								<svg
									className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
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
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
								{friends.map((friend) => (
									<div
										key={friend.id}
										className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200"
									>
										<div className="flex items-center gap-3">
											<img
												alt={`${friend.friend_profile.username}'s avatar`}
												className="h-8 w-8 sm:h-10 sm:w-10 rounded-full"
												src={`/avatars/${friend.friend_profile.avatar_name}.svg`}
											/>
											<span className="font-medium text-gray-900">
												{friend.friend_profile.username}
											</span>
										</div>
										<button
											className="text-red-600 hover:text-red-700 text-sm sm:text-base font-medium focus:outline-none"
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

				{/* Friend Requests Section */}
				{(invites.filter((invite) => invite.receiver_id === user?.id).length >
					0 ||
					invites.filter((invite) => invite.sender_id === user?.id).length >
						0) && (
					<div className="bg-white rounded-lg shadow p-4 sm:p-6">
						<h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
							Friend Requests
						</h2>

						{/* Received Requests */}
						{invites.filter((invite) => invite.receiver_id === user?.id)
							.length > 0 && (
							<div className="mb-6">
								<h3 className="text-sm font-medium text-gray-700 mb-3">
									Received Requests{" "}
									<span className="text-gray-500">
										(
										{
											invites.filter(
												(invite) => invite.receiver_id === user?.id
											).length
										}
										)
									</span>
								</h3>
								<div className="space-y-2">
									{invites
										.filter((invite) => invite.receiver_id === user?.id)
										.map((invite) => (
											<div
												key={invite.id}
												className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200"
											>
												<div className="flex items-center gap-3">
													<img
														alt={`${invite.sender.username}'s avatar`}
														className="h-8 w-8 sm:h-10 sm:w-10 rounded-full"
														src={`/avatars/${invite.sender.avatar_name}.svg`}
													/>
													<span className="font-medium text-gray-900">
														{invite.sender.username}
													</span>
												</div>
												<div className="flex gap-2">
													<button
														className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
														onClick={() => void acceptInvite(invite.id)}
													>
														Accept
													</button>
													<button
														className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
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
							<div>
								<h3 className="text-sm font-medium text-gray-700 mb-3">
									Sent Requests{" "}
									<span className="text-gray-500">
										(
										{
											invites.filter((invite) => invite.sender_id === user?.id)
												.length
										}
										)
									</span>
								</h3>
								<div className="space-y-2">
									{invites
										.filter((invite) => invite.sender_id === user?.id)
										.map((invite) => (
											<div
												key={invite.id}
												className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200"
											>
												<div className="flex items-center gap-3">
													<img
														alt={`${invite.receiver.username}'s avatar`}
														className="h-8 w-8 sm:h-10 sm:w-10 rounded-full"
														src={`/avatars/${invite.receiver.avatar_name}.svg`}
													/>
													<span className="font-medium text-gray-900">
														{invite.receiver.username}
													</span>
												</div>
												<span className="text-sm sm:text-base text-yellow-600 font-medium px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-50 rounded-lg">
													Pending
												</span>
											</div>
										))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
