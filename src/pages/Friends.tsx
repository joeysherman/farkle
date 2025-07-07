import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import type { FunctionComponent } from "../common/types";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useFriendInvites } from "../components/layout/navbar/Navbar";
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

// Loading spinner component
function LoadingSpinner(): JSX.Element {
	return (
		<div className="flex justify-center items-center">
			<div className="loading loading-spinner loading-lg text-primary"></div>
		</div>
	);
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

	const {
		data: friendInvites = [],
		isLoading: isInvitesLoading,
		refetch: refetchFriendInvites,
	} = useFriendInvites(user?.id ?? "");
	const friendsSubscriptionRef = useRef<RealtimeChannel | null>(null);
	const friendInvitesSubscriptionRef = useRef<RealtimeChannel | null>(null);

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

	// Set up subscriptions for realtime updates
	// useEffect(() => {
	// 	if (user?.id) {
	// 		// Subscribe to friends updates
	// 		friendsSubscriptionRef.current = supabase
	// 			.channel("friends_changes")
	// 			.on(
	// 				"postgres_changes",
	// 				{
	// 					event: "INSERT",
	// 					schema: "public",
	// 					table: "friends",
	// 					filter: `user_id=eq.${user.id},status=eq.accepted`,
	// 				},
	// 				() => {
	// 					void fetchFriends();
	// 				}
	// 			)
	// 			.on(
	// 				"postgres_changes",
	// 				{
	// 					event: "DELETE",
	// 					schema: "public",
	// 					table: "friends",
	// 					filter: `user_id=eq.${user.id}`,
	// 				},
	// 				() => {
	// 					void fetchFriends();
	// 				}
	// 			)
	// 			.subscribe();

	// 		// Subscribe to friend invites updates
	// 		friendInvitesSubscriptionRef.current = supabase
	// 			.channel("friend_invites_changes")
	// 			.on(
	// 				"postgres_changes",
	// 				{
	// 					event: "INSERT",
	// 					schema: "public",
	// 					table: "friend_invites",
	// 					filter: `receiver_id=eq.${user.id}`,
	// 				},
	// 				() => {
	// 					void fetchInvites();
	// 				}
	// 			)
	// 			.on(
	// 				"postgres_changes",
	// 				{
	// 					event: "UPDATE",
	// 					schema: "public",
	// 					table: "friend_invites",
	// 					filter: `receiver_id=eq.${user.id}`,
	// 				},
	// 				() => {
	// 					void fetchInvites();
	// 				}
	// 			)
	// 			.on(
	// 				"postgres_changes",
	// 				{
	// 					event: "DELETE",
	// 					schema: "public",
	// 					table: "friend_invites",
	// 					filter: `receiver_id=eq.${user.id}`,
	// 				},
	// 				() => {
	// 					void fetchInvites();
	// 				}
	// 			)
	// 			.subscribe();

	// 		return () => {
	// 			if (friendsSubscriptionRef.current) {
	// 				void friendsSubscriptionRef.current.unsubscribe();
	// 				friendsSubscriptionRef.current = null;
	// 			}
	// 			if (friendInvitesSubscriptionRef.current) {
	// 				void friendInvitesSubscriptionRef.current.unsubscribe();
	// 				friendInvitesSubscriptionRef.current = null;
	// 			}
	// 		};
	// 	}
	// }, [user?.id]);
	useEffect(() => {
		if (user?.id && !friendInvitesSubscriptionRef.current) {
			friendInvitesSubscriptionRef.current = supabase
				.channel("friend_invites_changes")
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "friend_invites",
						filter: `receiver_id=eq.${user.id}`,
					},
					(payload) => {
						// Refetch friend invites when there's an update
						console.log("payload update", payload);

						void refetchFriendInvites();
					}
				)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "friend_invites",
						filter: `receiver_id=eq.${user.id}`,
					},
					(payload) => {
						// Refetch friend invites when there's an update
						console.log("payload insert", payload);

						void refetchFriendInvites();
					}
				)

				.subscribe();

			return () => {
				if (friendInvitesSubscriptionRef.current) {
					console.log("unsubscribing from friend invites");
					void friendInvitesSubscriptionRef.current.unsubscribe();
					friendInvitesSubscriptionRef.current = null;
				}
			};
		}
	}, [user?.id, refetchFriendInvites]);

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
			<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
				<LoadingSpinner />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 p-4 py-8">
			<div className="container mx-auto max-w-4xl space-y-6">
				<h1 className="text-3xl font-bold text-base-content mb-6">Friends</h1>

				{/* Combined Friends Section */}
				<div className="card bg-base-100 shadow-2xl">
					<div className="card-body">
						<h2 className="card-title text-xl mb-6">
							Your Friends{" "}
							<div className="badge badge-primary">{friends.length}</div>
						</h2>

						{/* Search Bar */}
						<form onSubmit={handleSearch} className="mb-6">
							<div className="join w-full">
								<input
									className="input input-bordered input-primary join-item flex-1"
									placeholder="Search by username"
									type="text"
									value={searchQuery}
									onChange={handleSearchInput}
								/>
								<button
									className="btn btn-primary join-item"
									type="submit"
									disabled={isSearching}
								>
									{isSearching ? (
										<span className="loading loading-spinner loading-sm"></span>
									) : (
										"Search"
									)}
								</button>
							</div>
						</form>

						{/* Search Results */}
						{searchResults.length > 0 && (
							<div className="space-y-3 mb-6">
								<h3 className="text-sm font-medium text-base-content/70 mb-3">
									Search Results
								</h3>
								{searchResults.map((result) => (
									<div key={result.id} className="card bg-base-200 shadow-sm">
										<div className="card-body p-4">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="avatar">
														<div className="w-10 rounded-full">
															<img
																alt={`${result.username}'s avatar`}
																src={`${result?.avatar_name || "default"}`}
															/>
														</div>
													</div>
													<span className="font-medium text-base-content">
														{result.username}
													</span>
												</div>
												{result.is_friend ? (
													<div className="badge badge-success">Friends</div>
												) : result.has_pending_invite ? (
													<div className="badge badge-warning">Pending</div>
												) : (
													<button
														className="btn btn-primary btn-sm"
														onClick={() => void sendFriendInvite(result.id)}
													>
														Add Friend
													</button>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						)}

						{searchQuery && searchResults.length === 0 && !isSearching && (
							<div className="alert alert-info">
								<span>No users found matching "{searchQuery}"</span>
							</div>
						)}

						{/* Friends List */}
						<div className="space-y-3">
							<h3 className="text-sm font-medium text-base-content/70 mb-3">
								Current Friends
							</h3>
							{friends.length === 0 ? (
								<div className="card bg-base-200">
									<div className="card-body text-center py-12">
										<div className="text-6xl mb-4">👥</div>
										<h3 className="text-lg font-medium text-base-content mb-2">
											No friends yet
										</h3>
										<p className="text-base-content/70">
											Search for users to add them as friends.
										</p>
									</div>
								</div>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{friends.map((friend) => (
										<div key={friend.id} className="card bg-base-200 shadow-sm">
											<div className="card-body p-4">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-3">
														<div className="avatar">
															<div className="w-10 rounded-full">
																<img
																	alt={`${friend.friend_profile.username}'s avatar`}
																	src={`${friend.friend_profile?.avatar_name || "default"}`}
																/>
															</div>
														</div>
														<span className="font-medium text-base-content">
															{friend.friend_profile.username}
														</span>
													</div>
													<button
														className="btn btn-error btn-sm btn-outline"
														onClick={() => void removeFriend(friend.friend_id)}
													>
														Remove
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Friend Requests Section */}
				{(invites.filter((invite) => invite.receiver_id === user?.id).length >
					0 ||
					invites.filter((invite) => invite.sender_id === user?.id).length >
						0) && (
					<div className="card bg-base-100 shadow-2xl">
						<div className="card-body">
							<h2 className="card-title text-xl mb-4">Friend Requests</h2>

							{/* Received Requests */}
							{invites.filter((invite) => invite.receiver_id === user?.id)
								.length > 0 && (
								<div className="mb-6">
									<h3 className="text-sm font-medium text-base-content/70 mb-3">
										Received Requests{" "}
										<div className="badge badge-primary badge-sm">
											{
												invites.filter(
													(invite) => invite.receiver_id === user?.id
												).length
											}
										</div>
									</h3>
									<div className="space-y-3">
										{invites
											.filter((invite) => invite.receiver_id === user?.id)
											.map((invite) => (
												<div
													key={invite.id}
													className="card bg-base-200 shadow-sm"
												>
													<div className="card-body p-4">
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-3">
																<div className="avatar">
																	<div className="w-10 rounded-full">
																		<img
																			alt={`${invite.sender.username}'s avatar`}
																			src={`/avatars/${invite.sender.avatar_name}.svg`}
																		/>
																	</div>
																</div>
																<span className="font-medium text-base-content">
																	{invite.sender.username}
																</span>
															</div>
															<div className="flex gap-2">
																<button
																	className="btn btn-success btn-sm"
																	onClick={() => void acceptInvite(invite.id)}
																>
																	Accept
																</button>
																<button
																	className="btn btn-error btn-sm btn-outline"
																	onClick={() => void rejectInvite(invite.id)}
																>
																	Reject
																</button>
															</div>
														</div>
													</div>
												</div>
											))}
									</div>
								</div>
							)}

							{/* Sent Requests */}
							{invites.filter((invite) => invite.sender_id === user?.id)
								.length > 0 && (
								<div>
									<h3 className="text-sm font-medium text-base-content/70 mb-3">
										Sent Requests{" "}
										<div className="badge badge-secondary badge-sm">
											{
												invites.filter(
													(invite) => invite.sender_id === user?.id
												).length
											}
										</div>
									</h3>
									<div className="space-y-3">
										{invites
											.filter((invite) => invite.sender_id === user?.id)
											.map((invite) => (
												<div
													key={invite.id}
													className="card bg-base-200 shadow-sm"
												>
													<div className="card-body p-4">
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-3">
																<div className="avatar">
																	<div className="w-10 rounded-full">
																		<img
																			alt={`${invite.receiver.username}'s avatar`}
																			src={`/avatars/${invite.receiver.avatar_name}.svg`}
																		/>
																	</div>
																</div>
																<span className="font-medium text-base-content">
																	{invite.receiver.username}
																</span>
															</div>
															<div className="badge badge-warning">Pending</div>
														</div>
													</div>
												</div>
											))}
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
