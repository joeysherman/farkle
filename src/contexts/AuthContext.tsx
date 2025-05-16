import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, AuthError, Session } from "@supabase/supabase-js";

type Profile = {
	id: string;
	onboarding_completed: boolean;
};

export interface AuthContextType {
	user: User | null;
	session: Session | null;
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
	const [session, setSession] = useState<Session | null>(null);

	useEffect(() => {
		const initializeAuth = async (): Promise<void> => {
			debugger;
			try {
				// First check for existing session in local storage
				const {
					data: { session: currentSession },
				} = await supabase.auth.getSession();

				if (currentSession) {
					setSession(currentSession);

					// Then verify the session with the server
					const {
						data: { user: authUser },
						error,
					} = await supabase.auth.getUser();

					if (error) {
						console.error("Auth verification error:", error);
						setUser(null);
						setSession(null);
						return;
					}

					if (authUser) {
						const { data: profile } = await supabase
							.from("profiles")
							.select("*")
							.eq("id", authUser.id)
							.single();

						if (!profile) {
							setUser(authUser);
							return;
						}

						if (profile) {
							setUser(authUser);
							if (!profile.onboarding_completed) {
								// Handle onboarding redirect
							}
							return;
						}
					}
				}
			} catch (error) {
				console.error("Auth initialization error:", error);
			} finally {
				setIsAuthChecking(false);
			}
		};

		void initializeAuth();
	}, []);

	// Sign in with email and password
	const signIn = async (
		email: string,
		password: string
	): Promise<{ error: AuthError | null }> => {
		const { error, data } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (data?.user) {
			setUser(data.user);
			setSession(data.session);
			setIsAuthChecking(false);
			debugger;
		}
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
		await supabase.auth.signOut();
		setUser(null);
		setSession(null);
		setIsAuthChecking(false);
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
		session,
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
