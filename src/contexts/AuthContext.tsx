import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, AuthError } from "@supabase/supabase-js";

type Profile = {
	id: string;
	onboarding_completed: boolean;
};

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
		const initializeAuth = async (): Promise<void> => {
			debugger;
			const {
				data: { user },
				error,
			} = await supabase.auth.getUser();

			if (error) {
				setIsAuthChecking(false);
				setUser(null);
				console.error("Auth initialization error:", error);
			} else {
				setUser(user);
				setIsAuthChecking(false);
			}
		};

		void initializeAuth();
		return () => {
			setIsAuthChecking(true);
			setUser(null);
		};
	}, []);
	debugger;
	// Sign in with email and password
	const signIn = async (
		email: string,
		password: string
	): Promise<{ error: AuthError | null }> => {
		const { error, data } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		debugger;
		if (data?.user) {
			setUser(data.user);

			setIsAuthChecking(false);
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
