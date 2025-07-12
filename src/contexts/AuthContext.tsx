import {
	createContext,
	useContext,
	useState,
	useEffect,
	type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, AuthError } from "@supabase/supabase-js";
import type {
	Profile,
	LoadingState,
	AuthContextType,
} from "./AuthContext.types";

export const AuthContext = createContext<AuthContextType | undefined>(
	undefined
);

export function AuthProvider({
	children,
}: {
	children: ReactNode;
}): JSX.Element {
	const [isAuthChecking, setIsAuthChecking] = useState(true);
	const [loadingState, setLoadingState] =
		useState<LoadingState>("initializing");
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);

	// Helper function to fetch user profile
	const fetchUserProfile = async (userId: string): Promise<Profile | null> => {
		try {
			setLoadingState("fetching-profile");
			const { data: profileData, error } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", userId)
				.single();

			if (error) {
				console.error("Error fetching profile:", error);
				return null;
			}

			return profileData as Profile;
		} catch (error) {
			console.error("Error fetching profile:", error);
			return null;
		}
	};

	useEffect(() => {
		const initializeAuth = async (): Promise<void> => {
			console.log("initializing auth");
			setLoadingState("initializing");
			const {
				data: { user },
				error,
			} = await supabase.auth.getUser();

			if (error) {
				console.error("Auth initialization error:", error);
			}

			setUser(user);
			setLoadingState("idle");

			if (user) {
				// Fetch profile data for authenticated user
				const profileData = await fetchUserProfile(user.id);

				console.log("setting profile in initializeAuth", profileData);
				setProfile(profileData);
				// Mark auth checking as complete after profile is loaded
				setIsAuthChecking(false);
			} else {
				// No user, can immediately mark as complete
				setProfile(null);
				setIsAuthChecking(false);
			}
		};

		void initializeAuth();

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			console.log("Auth state change:", event);

			// Update user state immediately
			setUser(session?.user ?? null);
			setLoadingState("idle");

			// If no user, we can immediately mark auth checking as complete
			if (!session?.user) {
				console.log("setting profile to null in onAuthStateChange");
				setProfile(null);
				setIsAuthChecking(false);
				return;
			}

			// Defer profile fetching to avoid deadlocks, but keep auth checking true until profile is loaded
			setTimeout(() => {
				const loadProfile = async (): Promise<void> => {
					console.log("session", session);
					// Fetch user profile when authenticated
					const profileData = await fetchUserProfile(session.user.id);
					console.log("setting profile in onAuthStateChange", profileData);
					setProfile(profileData);
					// Only mark auth checking as complete after profile is loaded
					setIsAuthChecking(false);
				};
				void loadProfile();
			}, 0);
		});

		return (): void => {
			console.log("unsubscribing from auth state change");
			subscription.unsubscribe();
		};
	}, []);

	// Sign in with email and password
	const signIn = async (
		email: string,
		password: string
	): Promise<{ error: AuthError | null }> => {
		setIsAuthChecking(true);
		setLoadingState("signing-in");
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			setIsAuthChecking(false);
			setLoadingState("idle");
		}
		// Don't manually set user here - let onAuthStateChange handle it
		return { error };
	};

	// Sign up with email and password
	const signUp = async (
		email: string,
		password: string
	): Promise<{ error: AuthError | null }> => {
		setLoadingState("signing-in");
		const { error } = await supabase.auth.signUp({
			email,
			password,
		});

		if (error) {
			setLoadingState("idle");
		}

		return { error };
	};

	// Sign out
	const signOut = async (): Promise<void> => {
		setIsAuthChecking(true);
		setLoadingState("signing-out");
		await supabase.auth.signOut();
		// Don't manually set user here - let onAuthStateChange handle it
	};

	// Reset password (send reset email)
	const resetPassword = async (
		email: string
	): Promise<{ error: AuthError | null }> => {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/reset-password`,
		});
		return { error };
	};

	// Update password
	const updatePassword = async (
		password: string
	): Promise<{ error: AuthError | null }> => {
		setLoadingState("updating-profile");
		const { error } = await supabase.auth.updateUser({
			password,
		});
		setLoadingState("idle");
		return { error };
	};

	// Function to manually refetch profile
	const refetchProfile = async (): Promise<void> => {
		if (!user?.id) return;

		console.log("🔄 AuthContext: Starting profile refetch for user:", user.id);
		const profileData = await fetchUserProfile(user.id);
		console.log("📊 AuthContext: Fetched profile data:", profileData);
		console.log("🔄 AuthContext: Setting profile in context");
		debugger;
		setProfile(profileData);
		console.log(
			"✅ AuthContext: Profile set in context - onboarding_completed:",
			profileData?.onboarding_completed
		);
	};

	const value = {
		user,
		profile,
		isAuthChecking,
		loadingState,
		isAuthenticated: !!user,
		signIn,
		signUp,
		signOut,
		resetPassword,
		updatePassword,
		refetchProfile,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);

	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
