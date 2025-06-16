import type { User, AuthError } from "@supabase/supabase-js";

export type Profile = {
	id: string;
	username?: string;
	avatar_name?: string;
	has_changed_username?: boolean;
	total_games?: number;
	games_won?: number;
	highest_score?: number;
	onboarding_step?: number;
	onboarding_completed: boolean;
	created_at?: string;
	updated_at?: string;
	fcm_token?: string;
};

export type LoadingState =
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
	refetchProfile: () => Promise<void>;
} 