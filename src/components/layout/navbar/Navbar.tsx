import { useEffect, useState, Fragment } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "../../../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
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

export function Navbar(): JSX.Element {
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loading, setLoading] = useState(true);
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	const { data: profileData, isLoading: isProfileLoading } = useProfileData(
		user?.id ?? ""
	);

	useEffect(() => {
		let isMounted = true;

		// Get initial session and profile
		const fetchUserAndProfile = async (): Promise<void> => {
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (!isMounted) return;

				setUser(session?.user ?? null);

				if (session?.user) {
					const { data: profileData } = await supabase
						.from("profiles")
						.select("id, username, avatar_name")
						.eq("id", session.user.id)
						.single();
					if (!isMounted) return;
					setProfile(profileData);
				}
				if (isMounted) {
					setLoading(false);
				}
			} catch (error) {
				console.error("Error fetching user and profile:", error);
				if (isMounted) {
					setLoading(false);
				}
			}
		};

		void fetchUserAndProfile();

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(
			async (_event, session): Promise<void> => {
				try {
					if (!isMounted) return;
					setUser(session?.user ?? null);

					if (session?.user) {
						const { data: profileData } = await supabase
							.from("profiles")
							.select("id, username, avatar_name")
							.eq("id", session.user.id)
							.single();
						if (!isMounted) return;
						setProfile(profileData);
					} else {
						setProfile(null);
					}
				} catch (error) {
					console.error("Error handling auth change:", error);
				}
			}
		);

		return () => {
			isMounted = false;
			subscription.unsubscribe();
		};
	}, []);

	const handleSignOut = async (): Promise<void> => {
		try {
			setIsLoggingOut(true);
			await supabase.auth.signOut();
			// Wait a moment to show the splash screen
			await new Promise<void>((resolve) => {
				setTimeout(resolve, 1000);
			});
			void navigate({ to: "/signup" });
		} catch (error) {
			console.error("Error signing out:", error);
		}
	};

	// Show logout splash screen
	if (isLoggingOut) {
		return (
			<div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
				<div className="text-center">
					<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin mx-auto"></div>
					<p className="mt-4 text-lg text-gray-600">Signing out...</p>
				</div>
			</div>
		);
	}

	return (
		<nav className="bg-white shadow">
			<div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
				<div className="flex justify-between h-12 sm:h-16">
					<div className="flex">
						<div className="flex-shrink-0 flex items-center">
							<Link
								to="/"
								className="text-base sm:text-xl font-bold text-indigo-600"
							>
								Farkle Online
							</Link>
						</div>
					</div>

					<div className="flex items-center">
						{loading ? (
							<div className="text-gray-500 text-sm sm:text-base">
								Loading...
							</div>
						) : user ? (
							<div className="flex items-center">
								<Menu as="div" className="relative inline-block text-left">
									<MenuButton className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
										<img
											alt="User avatar"
											className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
											src={`/avatars/${profileData?.avatar_name || "default"}.svg`}
										/>
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
										<MenuItems className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
											<div className="px-1 py-1">
												<MenuItem>
													{({ active }): JSX.Element => (
														<Link
															className={`${
																active
																	? "bg-indigo-500 text-white"
																	: "text-gray-900"
															} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
															to="/profile"
														>
															Profile
														</Link>
													)}
												</MenuItem>
												<MenuItem>
													{({ active }): JSX.Element => (
														<button
															className={`${
																active
																	? "bg-indigo-500 text-white"
																	: "text-gray-900"
															} group flex w-full items-center rounded-md px-2 py-2 text-sm`}
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
						) : (
							<div className="flex items-center space-x-4">
								<Link
									className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 border border-transparent text-sm font-medium rounded text-indigo-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
									to="/signup"
								>
									Sign in
								</Link>
							</div>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
}
