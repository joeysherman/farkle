import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout(): JSX.Element {
	const navigate = useNavigate();

	const [isAuthChecking, setIsAuthChecking] = useState(true);
	const [user, setUser] = useState<any>(null);

	useEffect(() => {
		let isMounted = true; // Flag to track component's mount status

		const checkAuth = async (): Promise<void> => {
			const {
				data: { user: authUser },
			} = await supabase.auth.getUser();

			// if authUser is null, get the profile using the authUser id
			if (authUser) {
				// profile may not exist, so we need to check for that
				const { data: profile } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", authUser.id)
					.single();

				// if profile doesn't exist, force the user to onboarding
				if (!profile && isMounted) {
					setIsAuthChecking(false);
					setUser(authUser);
					await navigate({ to: "/onboarding" });
					return;
				} else if (profile && isMounted) {
					setIsAuthChecking(false);
					setUser(authUser);
					if (profile.onboarding_completed) {
						await navigate({ to: "/" });
					} else {
						await navigate({ to: "/onboarding" });
					}
					return;
				}
			} else if (isMounted && !authUser) {
				setIsAuthChecking(false);
				setUser(null);
				await navigate({ to: "/signup" });
				return;
			}
		};

		checkAuth();

		return () => {
			isMounted = false; // Set flag to false when component unmounts
		};
	}, []);

	if (isAuthChecking) {
		return <div>Loading...root</div>;
	}

	return (
		<div>
			<Outlet />
		</div>
	);
}
