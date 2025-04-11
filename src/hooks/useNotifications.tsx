import { useEffect, useState } from "react";
import {
	onMessageListener,
	requestNotificationPermission,
} from "../config/firebase";
import { toast } from "react-hot-toast";
import { supabase } from "../lib/supabaseClient";

interface NotificationState {
	subscription: boolean;
	error: Error | null;
	subscribe: () => Promise<void>;
	unsubscribe: () => Promise<void>;
}

export const useNotifications = (): NotificationState => {
	const [subscription, setSubscription] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		// Check if notifications are already enabled
		if ("Notification" in window) {
			setSubscription(Notification.permission === "granted");
		}
	}, []);

	const subscribe = async (): Promise<void> => {
		try {
			setError(null);
			const token = await requestNotificationPermission();
			if (!token) {
				throw new Error("Failed to get notification token");
			}

			// Store the token in Supabase
			const { error: updateError } = await supabase
				.from("user_notification_tokens")
				.upsert({ token });

			if (updateError) {
				throw updateError;
			}

			setSubscription(true);
			toast.success("Notifications enabled successfully!");
		} catch (err) {
			setError(
				err instanceof Error ? err : new Error("Failed to enable notifications")
			);
			setSubscription(false);
		}
	};

	const unsubscribe = async (): Promise<void> => {
		try {
			setError(null);
			// Remove the token from Supabase
			const { error: deleteError } = await supabase
				.from("user_notification_tokens")
				.delete()
				.eq("token", await requestNotificationPermission());

			if (deleteError) {
				throw deleteError;
			}

			setSubscription(false);
			toast.success("Notifications disabled successfully!");
		} catch (err) {
			setError(
				err instanceof Error
					? err
					: new Error("Failed to disable notifications")
			);
		}
	};

	useEffect(() => {
		if (subscription) {
			const unsubscribe = onMessageListener()
				.then((payload: any) => {
					toast(
						<div className="max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5">
							<div className="flex-1 w-0 p-4">
								<div className="flex items-start">
									<div className="ml-3 flex-1">
										<p className="text-sm font-medium text-gray-900">
											{payload?.notification?.title}
										</p>
										<p className="mt-1 text-sm text-gray-500">
											{payload?.notification?.body}
										</p>
									</div>
								</div>
							</div>
						</div>
					);
				})
				.catch((err) => {
					console.error("Failed to receive foreground message:", err);
					setError(
						err instanceof Error
							? err
							: new Error("Failed to receive notification")
					);
				});

			return () => {
				unsubscribe;
			};
		}
	}, [subscription]);

	return {
		subscription,
		error,
		subscribe,
		unsubscribe,
	};
};
