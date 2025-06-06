import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, AuthError } from "@supabase/supabase-js";

type Profile = {
	id: string;
	onboarding_completed: boolean;
};

type LoadingState =
	| "idle"
	| "initializing"
	| "signing-in"
	| "signing-out"
	| "fetching-profile"
	| "updating-profile";

export interface AuthContextType {
	user: User | null;
	profile: Profile | null;
	isAuthChecking: boolean;
	loadingState: LoadingState;
	isAuthenticated: boolean;

	signIn: (
		email: string,
		password: string
	) => Promise<{ error: AuthError | null }>;
	signUp: (
		email: string,
		password: string
	) => Promise<{ error: AuthError | null }>;
	signOut: () => Promise<void>;
	resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
	updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
}

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
			const { data: profileData } = await supabase
				.from("profiles")
				.select("id, onboarding_completed")
				.eq("id", userId)
				.single();
			return profileData;
		} catch (error) {
			console.error("Error fetching profile:", error);
			return null;
		}
	};

	useEffect(() => {
		const initializeAuth = async (): Promise<void> => {
			setLoadingState("initializing");
			const {
				data: { user },
				error,
			} = await supabase.auth.getUser();

			if (error) {
				console.error("Auth initialization error:", error);
			}

			if (user) {
				// Fetch profile data for authenticated user
				const profileData = await fetchUserProfile(user.id);
				setProfile(profileData);
			}

			setUser(user);
			setLoadingState("idle");
			setIsAuthChecking(false);
		};

		void initializeAuth();

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log("Auth state change:", event);

			if (session?.user) {
				console.log("session", session);
				// Fetch user profile when authenticated
				const profileData = await fetchUserProfile(session.user.id);
				setProfile(profileData);
			} else {
				setProfile(null);
			}
			setUser(session?.user ?? null);
			setLoadingState("idle");
			setIsAuthChecking(false);
		});

		return () => {
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
		const { error, data } = await supabase.auth.signInWithPassword({
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
