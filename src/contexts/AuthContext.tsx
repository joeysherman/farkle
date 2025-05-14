import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, AuthError } from "@supabase/supabase-js";

interface Profile {
	id: string;
	onboarding_completed: boolean;
}

export interface AuthContextType {
	user: User | null;
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

	useEffect(() => {
		let isMounted = true;

		const checkAuth = async (): Promise<void> => {
			try {
				const {
					data: { user: authUser },
				} = await supabase.auth.getUser();

				if (authUser) {
					const { data: profile } = await supabase
						.from("profiles")
						.select("*")
						.eq("id", authUser.id)
						.single();

					if (!profile && isMounted) {
						setIsAuthChecking(false);
						setUser(authUser);
						debugger;
						//await navigate({ to: "/onboarding" });
						return;
					}

					if (profile && isMounted) {
						setIsAuthChecking(false);
						setUser(authUser);
						if (!profile.onboarding_completed) {
							debugger;
							//await navigate({ to: "/onboarding" });
						}
						return;
					}
				} else if (isMounted) {
					setIsAuthChecking(false);
					setUser(null);
					debugger;
					//await navigate({ to: "/signin" });
				}
			} catch (error) {
				console.error("Auth check error:", error);
				setIsAuthChecking(false);
				setUser(null);
			}
		};

		void checkAuth();

		return (): void => {
			isMounted = false;
		};
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
		if (data && data.user) {
			setUser(data.user);
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
		//await navigate({ to: "/signin" });
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
		isAuthChecking,
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
