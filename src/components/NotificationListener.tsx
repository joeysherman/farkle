import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
	onMessageListener,
	requestNotificationPermission,
} from "../config/firebase";
import { supabase } from "../lib/supabaseClient";

interface NotificationPayload {
	notification?: {
		title?: string;
		body?: string;
	};
}

export const NotificationListener = (): JSX.Element => {
	const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Check if notifications are already enabled
		if ("Notification" in window) {
			setIsSubscribed(Notification.permission === "granted");
		}
	}, []);

	const handleSubscribe = async (): Promise<void> => {
		try {
			setError(null);
			const token = await requestNotificationPermission();
			if (!token) {
				throw new Error("Failed to get notification token");
			}

			const { data: userData, error: userError } =
				await supabase.auth.getUser();
			if (userError) throw userError;

			const { error: updateError } = await supabase
				.from("profiles")
				.upsert({ id: userData?.user?.id, fcmToken: token });

			if (updateError) throw updateError;

			setIsSubscribed(true);
			toast.success("Notifications enabled successfully!");
		} catch (error_) {
			setError(
				error_ instanceof Error
					? error_.message
					: "Failed to enable notifications"
			);
			setIsSubscribed(false);
		}
	};

	const handleUnsubscribe = async (): Promise<void> => {
		try {
			setError(null);
			const { data: userData, error: userError } =
				await supabase.auth.getUser();
			if (userError) throw userError;

			const { error: updateError } = await supabase
				.from("profiles")
				.update({ fcmToken: null })
				.eq("id", userData?.user?.id);

			if (updateError) throw updateError;

			setIsSubscribed(false);
			toast.success("Notifications disabled successfully!");
		} catch (error_) {
			setError(
				error_ instanceof Error
					? error_.message
					: "Failed to disable notifications"
			);
		}
	};

	useEffect(() => {
		if (isSubscribed) {
			const unsubscribe = onMessageListener().then(
				(payload: NotificationPayload) => {
					if (payload?.notification) {
						const { title, body } = payload.notification;
						console.log("Notification received:", payload);

						toast(
							<div className="flex flex-col">
								{title && <div className="font-bold">{title}</div>}
								{body && <div>{body}</div>}
							</div>,
							{
								duration: 5000,
								position: "top-right",
								icon: "🔔",
								style: {
									background: "#4F46E5",
									color: "#fff",
								},
							}
						);
					}
				}
			);

			return () => {
				if (typeof unsubscribe === "function") {
					unsubscribe();
				}
			};
		}
	}, [isSubscribed]);

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
