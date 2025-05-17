import { Fragment, useEffect, useRef } from "react";
import { Link, useMatch, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../contexts/AuthContext";
import type { User, RealtimeChannel } from "@supabase/supabase-js";
import {
	Menu,
	MenuButton,
	MenuItem,
	MenuItems,
	Transition,
} from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";

interface Profile {
	id: string;
	username: string;
	avatar_name: string;
}

interface GameInfo {
	name: string;
	currentPlayers: number;
	maxPlayers: number;
}

interface FriendInvite {
	id: string;
	sender_id: string;
	receiver_id: string;
	status: string;
}

const useUserData = () => {
	return useQuery({
		queryKey: ["currentUser"],
		queryFn: async () => {
			const { data, error } = await supabase.auth.getUser();
			if (error) {
				throw error;
			}
			return data.user;
		},
	});
};

const useProfileData = (userId: string) => {
	return useQuery({
		enabled: !!userId,
		queryKey: ["user", "profile", userId],
		queryFn: async () => {
			const { data: profileData } = await supabase
				.from("profiles")
				.select("id, username, avatar_name")
				.eq("id", userId)
				.single();

			return profileData;
		},
	});
};

export const useFriendInvites = (userId: string) => {
	return useQuery({
		enabled: !!userId,
		queryKey: ["user", "friend_invites", userId],
		queryFn: async () => {
			const { data: invites } = await supabase
				.from("friend_invites")
				.select("*")
				.eq("receiver_id", userId)
				.eq("status", "pending");

			return invites as Array<FriendInvite>;
		},
	});
};

export function Navbar({ gameInfo }: { gameInfo?: GameInfo }): JSX.Element {
	const navigate = useNavigate();
	const router = useRouter();
	const { user, isAuthChecking: isUserLoading, signOut } = useAuth();
	const friendInvitesSubscriptionRef = useRef<RealtimeChannel | null>(null);

	const isProfileActive = useMatch({ from: "/profile", shouldThrow: false });
	const isFriendsActive = useMatch({ from: "/friends", shouldThrow: false });
	const isHistoryActive = useMatch({ from: "/history", shouldThrow: false });

	const { data: profileData, isLoading: isProfileLoading } = useProfileData(
		user?.id ?? ""
	);

	const {
		data: friendInvites = [],
		isLoading: isInvitesLoading,
		refetch: refetchFriendInvites,
	} = useFriendInvites(user?.id ?? "");

	const loading = isUserLoading || isProfileLoading || isInvitesLoading;
	const pendingInvitesCount = friendInvites.length;

	// Set up subscription for friend invite updates
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

	const handleSignOut = async (): Promise<void> => {
		try {
			await signOut();

			await navigate({ to: "/signin" });
		} catch (error) {
			console.error("Error signing out:", error);
		}
	};

	return (
		<nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow">
			<div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
				<div className="flex justify-between h-12 sm:h-16">
					<div className="flex items-center">
						<div className="flex-shrink-0 flex items-center">
							<Link
								className="text-base sm:text-xl font-bold text-indigo-600"
								to="/app/dashboard"
							>
								Farkle Online
							</Link>
						</div>
						{/* Game Info - Only show on mobile */}
						{gameInfo && (
							<div className="ml-4 md:hidden flex items-center space-x-2">
								<span className="text-sm font-medium text-gray-900">
									{gameInfo.name}
								</span>
							</div>
						)}
					</div>

					<div className="flex items-center">
						{!loading && user && (
							<div className="flex items-center">
								<Menu as="div" className="relative inline-block text-left">
									<MenuButton className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 relative">
										<img
											alt="User avatar"
											className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
											src={`/avatars/${profileData?.avatar_name || "default"}.svg`}
										/>
										{pendingInvitesCount > 0 && (
											<span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 border-2 border-white"></span>
										)}
									</MenuButton>
									<Transition
										as={Fragment}
										enter="transition ease-out duration-100"
										enterFrom="transform opacity-0 scale-95"
										enterTo="transform opacity-100 scale-100"
										leave="transition ease-in duration-75"
										leaveFrom="transform opacity-100 scale-100"
										leaveTo="transform opacity-0 scale-95"
									>
										<MenuItems className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
											<div className="px-1 py-1">
												<MenuItem>
													{({ active: isActive }): JSX.Element => (
														<Link
															className={`${
																isActive || isProfileActive
																	? "bg-indigo-500 text-white"
																	: "text-gray-900"
															} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
															to="/app/profile"
														>
															Profile
														</Link>
													)}
												</MenuItem>
												<MenuItem>
													{({ active: isActive }): JSX.Element => (
														<Link
															className={`${
																isActive || isFriendsActive
																	? "bg-indigo-500 text-white"
																	: "text-gray-900"
															} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
															to="/app/friends"
														>
															<span className="flex-1">Friends</span>
															{pendingInvitesCount > 0 && (
																<span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-xs font-medium">
																	{pendingInvitesCount}
																</span>
															)}
														</Link>
													)}
												</MenuItem>
												<MenuItem>
													{({ active: isActive }): JSX.Element => (
														<Link
															className={`${
																isActive || isHistoryActive
																	? "bg-indigo-500 text-white"
																	: "text-gray-900"
															} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
															to="/app/history"
														>
															History
														</Link>
													)}
												</MenuItem>
												<div className="my-1 h-px bg-gray-200"></div>
												<MenuItem>
													{({ active: isActive }): JSX.Element => (
														<button
															className={`${
																isActive
																	? "bg-red-500 text-white"
																	: "text-red-600"
															} group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium`}
															onClick={handleSignOut}
														>
															Sign out
														</button>
													)}
												</MenuItem>
											</div>
										</MenuItems>
									</Transition>
								</Menu>
							</div>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
}
