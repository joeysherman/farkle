import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { requestNotificationPermission } from "../config/firebase";

export const InitialNotificationPrompt = (): JSX.Element | null => {
	const [hasPrompted, setHasPrompted] = useState<boolean>(false);

	useEffect(() => {
		const checkAndPromptNotifications = async (): Promise<void> => {
			try {
				// Check if user is logged in
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user) return;

				// Check if user already has a notification token
				const { data: profile } = await supabase
					.from("profiles")
					.select("fcm_token")
					.eq("id", user.id)
					.single();

				// If user already has a token or has been prompted, don't show the prompt
				if (profile?.fcm_token || hasPrompted) return;

				// Check if browser supports notifications
				if (!("Notification" in window)) return;

				// Check if permission is already granted
				if (Notification.permission === "granted") return;

				// Request permission
				const token = await requestNotificationPermission();
				if (!token) return;

				// Save the token
				await supabase
					.from("profiles")
					.upsert({ id: user.id, fcm_token: token });

				setHasPrompted(true);
			} catch (error) {
				console.error("Error in initial notification prompt:", error);
			}
		};

		void checkAndPromptNotifications();
	}, [hasPrompted]);

	// This component doesn't render anything visible
	return null;
};
