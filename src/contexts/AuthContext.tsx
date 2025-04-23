import {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabaseClient";
import { User } from "@supabase/supabase-js";

interface Profile {
	id: string;
	onboarding_completed: boolean;
}

interface AuthContextType {
	user: User | null;
	isAuthChecking: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
	children,
}: {
	children: ReactNode;
}): JSX.Element {
	const navigate = useNavigate();
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
						await navigate({ to: "/onboarding" });
						return;
					}

					if (profile && isMounted) {
						setIsAuthChecking(false);
						setUser(authUser);
						if (!profile.onboarding_completed) {
							await navigate({ to: "/onboarding" });
						}
						return;
					}
				} else if (isMounted) {
					setIsAuthChecking(false);
					setUser(null);
					await navigate({ to: "/signup" });
				}
			} catch (error) {
				console.error("Auth check error:", error);
				setIsAuthChecking(false);
				setUser(null);
			}
		};

		void checkAuth();

		return () => {
			isMounted = false;
		};
	}, [navigate]);

	const value = {
		user,
		isAuthChecking,
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
