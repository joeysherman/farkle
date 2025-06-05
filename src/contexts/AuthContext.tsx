import {
	createContext,
	useContext,
	useState,
	useEffect,
	type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, AuthError } from "@supabase/supabase-js";

type Profile = {
	id: string;
	onboarding_completed: boolean;
};

export interface AuthContextType {
	user: User | null;
	profile: Profile | null;
	isAuthChecking: boolean;
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
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);

	// Helper function to fetch user profile (without managing loading state)
	const fetchUserProfile = async (userId: string): Promise<Profile | null> => {
		try {
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
			try {
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
			} catch (error) {
				console.error("Error during auth initialization:", error);
			} finally {
				setIsAuthChecking(false);
			}
		};

		void initializeAuth();

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(
			async (event, session): Promise<void> => {
				console.log("Auth state change:", event);

				try {
					if (session?.user) {
						console.log("session", session);
						// Fetch user profile when authenticated
						const profileData = await fetchUserProfile(session.user.id);
						setProfile(profileData);
					} else {
						setProfile(null);
					}
					setUser(session?.user ?? null);
				} catch (error) {
					console.error("Error during auth state change:", error);
				} finally {
					setIsAuthChecking(false);
				}
			}
		);

		return (): void => {
			subscription.unsubscribe();
		};
	}, []);

	// Sign in with email and password
	const signIn = async (
		email: string,
		password: string
	): Promise<{ error: AuthError | null }> => {
		setIsAuthChecking(true);
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			setIsAuthChecking(false);
		}
		// Don't manually set user here - let onAuthStateChange handle it
		return { error };
	};

	// Sign up with email and password
	const signUp = async (
		email: string,
		password: string
	): Promise<{ error: AuthError | null }> => {
		const { error } = await supabase.auth.signUp({
			email,
			password,
		});

		return { error };
	};

	// Sign out
	const signOut = async (): Promise<void> => {
		setIsAuthChecking(true);
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
		const { error } = await supabase.auth.updateUser({
			password,
		});
		return { error };
	};

	const value = {
		user,
		profile,
		isAuthChecking,
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
