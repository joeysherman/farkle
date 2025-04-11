import type { FC } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { supabase } from "../lib/supabaseClient";

export const PushNotificationButton: FC = () => {
	const { subscription, error, subscribe, unsubscribe } = useNotifications();

	const handleTestNotification = async () => {
		try {
			const { error } = await supabase.rpc("send_test_notification");
			if (error) throw error;
		} catch (err) {
			console.error("Error sending test notification:", err);
		}
	};

	if (error) {
		return <div className="text-red-500">Error: {error.message}</div>;
	}

	return (
		<div className="flex flex-col gap-2">
			<button
				className={`px-4 py-2 rounded-md ${
					subscription
						? "bg-red-500 hover:bg-red-600"
						: "bg-blue-500 hover:bg-blue-600"
				} text-white transition-colors`}
				onClick={subscription ? unsubscribe : subscribe}
			>
				{subscription ? "Disable Notifications" : "Enable Notifications"}
			</button>
			{subscription && (
				<button
					className="px-4 py-2 rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors"
					onClick={handleTestNotification}
				>
					Send Test Notification
				</button>
			)}
		</div>
	);
};
