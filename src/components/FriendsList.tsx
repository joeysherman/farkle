import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useFriendInvites } from "./layout/navbar/Navbar";
import { Link, useNavigate } from "@tanstack/react-router";
import { Combobox } from "@headlessui/react";

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
	isFriend: boolean;
	hasPendingInvite: boolean;
}

interface FriendsListProps {
	/** Whether to show the search functionality */
	showSearch?: boolean;
	/** Whether to show friend invites */
	showInvites?: boolean;
	/** Maximum number of friends to display */
	maxDisplay?: number;
	/** Compact mode for smaller displays */
	compact?: boolean;
	/** Custom class names */
	className?: string;
}

// Loading spinner component
function LoadingSpinner(): JSX.Element {
	return (
		<div className="flex justify-center items-center">
			<div className="loading loading-spinner loading-lg text-primary"></div>
		</div>
	);
}

export function FriendsList({
	showSearch = false,
	showInvites = false,
	maxDisplay,
	compact = false,
	className = "",
}: FriendsListProps): JSX.Element {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [friends, setFriends] = useState<Array<Friend>>([]);
	const [invites, setInvites] = useState<Array<FriendInvite>>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<Array<SearchResult>>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
		null
	);

	const { refetch: refetchFriendInvites } = useFriendInvites(user?.id ?? "");

	const friendInvitesSubscriptionRef = useRef<RealtimeChannel | null>(null);

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
			const friendIds = data?.map((friend: any) => friend.friend_id) || [];

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
			profiles?.forEach((profile: any) => {
				profileMap.set(profile.id, profile);
			});

			// Combine friends with profile data
			const friendsWithProfiles: Array<Friend> =
				data?.map((friend: any) => ({
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

			allInvites.forEach((invite: any) => {
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
			profiles?.forEach((profile: any) => {
				profileMap.set(profile.id, profile);
			});

			// Combine invites with profile data
			const invitesWithProfiles: Array<FriendInvite> = allInvites.map(
				(invite: any) => ({
					...invite,
					sender: profileMap.get(invite.sender_id),
					receiver: profileMap.get(invite.receiver_id),
				})
			);

			setInvites(invitesWithProfiles);
		} catch (error) {
			console.error("Error fetching invites:", error);
			toast.error("Failed to load friend invites");
		}
	};

	useEffect(() => {
		if (user?.id) {
			void fetchFriends();
			if (showInvites) {
				void fetchInvites();
			}
		}
	}, [user?.id, showInvites]);

	// Set up real-time subscriptions for friend invite updates
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
						console.log("payload insert", payload);
						void refetchFriendInvites();
					}
				)
				.subscribe();

			return (): void => {
				if (friendInvitesSubscriptionRef.current) {
					console.log("unsubscribing from friend invites");
					void friendInvitesSubscriptionRef.current.unsubscribe();
					friendInvitesSubscriptionRef.current = null;
				}
			};
		}
	}, [user?.id, refetchFriendInvites]);

	useEffect(() => {
		return (): void => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
		};
	}, [debounceTimer]);

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
				// onboarding_completed is true
				.eq("onboarding_completed", true)
				.neq("id", user?.id)
				.limit(10);

			if (error) throw error;

			// Check if users are already friends or have pending invites
			const userIds = data?.map((profile: any) => profile.id) || [];

			// Get friends
			const { data: friendsData } = await supabase
				.from("friends")
				.select("friend_id")
				.eq("user_id", user?.id)
				.in("friend_id", userIds);

			const friendIds = new Set(
				friendsData?.map((friend: any) => friend.friend_id) || []
			);

			// Get pending invites
			const { data: invitesData } = await supabase
				.from("friend_invites")
				.select("sender_id, receiver_id")
				.or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
				.in("sender_id", userIds)
				.in("receiver_id", userIds);

			const pendingInviteIds = new Set(
				invitesData?.map((invite: any) =>
					invite.sender_id === user?.id ? invite.receiver_id : invite.sender_id
				) || []
			);

			// Combine results
			const results: Array<SearchResult> =
				data?.map((profile: any) => ({
					id: profile.id,
					username: profile.username,
					avatar_name: profile.avatar_name,
					isFriend: friendIds.has(profile.id),
					hasPendingInvite: pendingInviteIds.has(profile.id),
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

	const sendFriendInvite = async (userId: string): Promise<void> => {
		try {
			const { error } = await supabase.rpc("send_friend_invite", {
				p_receiver_id: userId,
			});

			if (error) throw error;

			// Update search results
			setSearchResults((previous) =>
				previous.map((result) =>
					result.id === userId ? { ...result, hasPendingInvite: true } : result
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
			if (showInvites) {
				await fetchInvites();
			}
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
			if (showInvites) {
				await fetchInvites();
			}
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
			<div className={`${className}`}>
				<LoadingSpinner />
			</div>
		);
	}

	const displayedFriends = maxDisplay ? friends.slice(0, maxDisplay) : friends;

	return (
		<div className={`space-y-4 ${className}`}>
			{/* Search Section */}
			{showSearch && (
				<div className="space-y-4">
					<Combobox value="" onChange={() => {}}>
						<div className="relative">
							<Combobox.Input
								className="input input-bordered input-primary w-full pr-10"
								placeholder="Search by username"
								displayValue={(query: string) => query}
								onChange={handleSearchInput}
							/>
							<div className="absolute inset-y-0 right-0 flex items-center pr-2 z-20">
								{isSearching ? (
									<span className="loading loading-spinner loading-sm"></span>
								) : searchQuery ? (
									<button
										className="btn btn-ghost btn-sm btn-circle"
										onClick={() => {
											setSearchQuery("");
											setSearchResults([]);
										}}
										type="button"
									>
										<svg
											className="h-4 w-4"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												clipRule="evenodd"
												d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
												fillRule="evenodd"
											/>
										</svg>
									</button>
								) : null}
							</div>

							<Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-base-100 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
								{searchResults.length === 0 && searchQuery && !isSearching ? (
									<div className="relative cursor-default select-none py-2 px-4 text-base-content/70">
										No users found matching "{searchQuery}"
									</div>
								) : (
									searchResults.map((result) => (
										<div
											key={result.id}
											className="relative cursor-default select-none py-3 pl-4 pr-4 hover:bg-base-100 border-b border-base-300/50 last:border-b-0 transition-colors"
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="avatar">
														<div
															className={`${compact ? "w-8" : "w-10"} rounded-full ring-2 ring-base-300/20`}
														>
															<img
																alt={`${result.username}'s avatar`}
																src={`${result.avatar_name || "default"}`}
															/>
														</div>
													</div>
													<div className="flex flex-col">
														<span
															className={`font-medium text-base-content ${compact ? "text-sm" : ""}`}
														>
															{result.username}
														</span>
														<span className="text-xs text-base-content/60">
															{result.isFriend
																? "Already friends"
																: "Click to add"}
														</span>
													</div>
												</div>
												<div className="flex items-center gap-2">
													<button
														className="btn btn-ghost btn-xs text-base-content/70 hover:text-base-content"
														onClick={(event) => {
															event.stopPropagation();
															void navigate({
																to: "/app/profile",
																search: { id: result.id },
															});
														}}
													>
														View Profile
													</button>
													{result.isFriend ? (
														<div className="badge badge-success badge-sm">
															Friends
														</div>
													) : result.hasPendingInvite ? (
														<div className="badge badge-warning badge-sm">
															Pending
														</div>
													) : (
														<button
															className="btn btn-neutral btn-xs hover:btn-success"
															onClick={(event) => {
																event.stopPropagation();
																void sendFriendInvite(result.id);
															}}
														>
															Add Friend
														</button>
													)}
												</div>
											</div>
										</div>
									))
								)}
							</Combobox.Options>
						</div>
					</Combobox>
				</div>
			)}

			{/* Friends List */}
			<div className="space-y-3">
				{!compact && (
					<div className="flex items-center gap-2">
						<h3 className="text-sm font-medium text-base-content/70">
							{showSearch ? "Current Friends" : "Friends"}
						</h3>
						{friends.length > 0 && (
							<div className="badge badge-primary badge-sm">
								{friends.length}
							</div>
						)}
					</div>
				)}

				{friends.length === 0 ? (
					<div className={`${compact ? "py-4" : "py-8"} text-center`}>
						<div className={`${compact ? "text-2xl" : "text-4xl"} mb-2`}>
							👥
						</div>
						<h3
							className={`${compact ? "text-sm" : "text-lg"} font-medium mb-1`}
						>
							No friends yet
						</h3>
						{/* link to friends page */}
						{compact && (
							<Link to="/app/friends">
								<button className="btn btn-primary btn-sm">Add Friend</button>
							</Link>
						)}
						{!compact && (
							<p className="text-base-content/70 text-sm">
								Search for users to add them as friends.
							</p>
						)}
					</div>
				) : (
					<div
						className={`grid ${compact ? "grid-cols-1 gap-2" : "grid-cols-1 md:grid-cols-2 gap-3"}`}
					>
						{displayedFriends.map((friend) => (
							<div key={friend.id} className="card bg-base-200 shadow-sm">
								<div className={`card-body ${compact ? "p-3" : "p-4"}`}>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="avatar">
												<div
													className={`${compact ? "w-8" : "w-10"} rounded-full`}
												>
													<img
														alt={`${friend.friend_profile.username}'s avatar`}
														src={`${friend.friend_profile?.avatar_name || "default"}`}
													/>
												</div>
											</div>
											<span
												className={`font-medium text-base-content ${compact ? "text-sm" : ""}`}
											>
												{friend.friend_profile.username}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<button
												className={`btn btn-outline ${compact ? "btn-xs" : "btn-sm"}`}
												onClick={() =>
													navigate({
														to: "/app/profile",
														search: { id: friend.friend_id },
													})
												}
											>
												View Profile
											</button>
											<button
												className={`btn btn-error btn-outline ${compact ? "btn-xs" : "btn-sm"}`}
												onClick={() => void removeFriend(friend.friend_id)}
											>
												Remove
											</button>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{maxDisplay && friends.length > maxDisplay && (
					<div className="text-center">
						<p className="text-sm text-base-content/70">
							Showing {maxDisplay} of {friends.length} friends
						</p>
					</div>
				)}
			</div>

			{/* Friend Invites Section */}
			{showInvites && (
				<div className="space-y-4">
					{/* Received Requests */}
					{invites.filter((invite) => invite.receiver_id === user?.id).length >
						0 && (
						<div>
							<h3 className="text-sm font-medium text-base-content/70 mb-3">
								Received Requests{" "}
								<div className="badge badge-primary badge-sm">
									{
										invites.filter((invite) => invite.receiver_id === user?.id)
											.length
									}
								</div>
							</h3>
							<div className="space-y-3">
								{invites
									.filter((invite) => invite.receiver_id === user?.id)
									.map((invite) => (
										<div key={invite.id} className="card bg-base-200 shadow-sm">
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
															className="btn btn-outline btn-sm"
															onClick={() =>
																navigate({
																	to: "/app/profile",
																	search: { id: invite.sender_id },
																})
															}
														>
															View Profile
														</button>
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
					{invites.filter((invite) => invite.sender_id === user?.id).length >
						0 && (
						<div>
							<h3 className="text-sm font-medium text-base-content/70 mb-3">
								Sent Requests{" "}
								<div className="badge badge-secondary badge-sm">
									{
										invites.filter((invite) => invite.sender_id === user?.id)
											.length
									}
								</div>
							</h3>
							<div className="space-y-3">
								{invites
									.filter((invite) => invite.sender_id === user?.id)
									.map((invite) => (
										<div key={invite.id} className="card bg-base-200 shadow-sm">
											<div className="card-body p-4">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-3">
														<div className="avatar">
															<div className="w-10 rounded-full">
																<img
																	alt={`${invite.receiver.username}'s avatar`}
																	src={`${invite.receiver?.avatar_name || "default"}`}
																/>
															</div>
														</div>
														<span className="font-medium text-base-content">
															{invite.receiver.username}
														</span>
													</div>
													<div className="flex items-center gap-2">
														<div className="badge badge-warning">Pending</div>
														<button
															className="btn btn-outline btn-sm"
															onClick={() =>
																navigate({
																	to: "/app/profile",
																	search: { id: invite.receiver_id },
																})
															}
														>
															View Profile
														</button>
													</div>
												</div>
											</div>
										</div>
									))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
