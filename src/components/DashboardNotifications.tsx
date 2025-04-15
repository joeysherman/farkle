import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { requestNotificationPermission } from "../config/firebase";

export const DashboardNotifications = () => {
	const [isSubscribed, setIsSubscribed] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubscribe = async () => {
		try {
			const token = await requestNotificationPermission();
			if (token) {
				// Save the token to the user's profile in Supabase
				const { error: updateError } = await supabase
					.from("profiles")
					.update({ fcm_token: token })
					.eq("id", (await supabase.auth.getUser()).data.user?.id);

				if (updateError) throw updateError;
				setIsSubscribed(true);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to enable notifications"
			);
		}
	};

	const handleUnsubscribe = async () => {
		try {
			// Remove the token from the user's profile
			const { error: updateError } = await supabase
				.from("profiles")
				.update({ fcm_token: null })
				.eq("id", (await supabase.auth.getUser()).data.user?.id);

			if (updateError) throw updateError;
			setIsSubscribed(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to disable notifications"
			);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			{error && <div className="text-red-500 text-sm">Error: {error}</div>}
			<button
				className={`px-4 py-2 rounded-md ${
					isSubscribed
						? "bg-red-500 hover:bg-red-600"
						: "bg-blue-500 hover:bg-blue-600"
				} text-white transition-colors`}
				onClick={() => {
					if (isSubscribed) {
						void handleUnsubscribe();
					} else {
						void handleSubscribe();
					}
				}}
			>
				{isSubscribed ? "Disable Notifications" : "Enable Notifications"}
			</button>
		</div>
	);
};
