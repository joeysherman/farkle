import type { FC } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { supabase } from "../lib/supabaseClient";

export const PushNotificationButton: FC = () => {
	const notificationState = useNotifications();
	const { subscription, error, subscribe, unsubscribe } =
		notificationState ?? {};

	const handleTestNotification = async (): Promise<void> => {
		try {
			const { error: notificationError } = await supabase.rpc(
				"send_test_notification"
			);
			if (notificationError) throw notificationError;
		} catch (error) {
			console.error("Error sending test notification:", error);
		}
	};

	if (error) {
		return (
			<div className="text-red-500">
				Error: {error?.message ?? "Unknown error"}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<button
				className={`px-4 py-2 rounded-md ${
					subscription
						? "bg-red-500 hover:bg-red-600"
						: "bg-blue-500 hover:bg-blue-600"
				} text-white transition-colors`}
				onClick={(): void => {
					if (subscription) {
						void unsubscribe?.();
					} else {
						void subscribe?.();
					}
				}}
			>
				{subscription ? "Disable Notifications" : "Enable Notifications"}
			</button>
			{subscription && (
				<button
					className="px-4 py-2 rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors"
					onClick={(): void => void handleTestNotification()}
				>
					Send Test Notification
				</button>
			)}
		</div>
	);
};
