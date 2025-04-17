import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from "react";
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

interface NotificationContextType {
	isSubscribed: boolean;
	error: string | null;
	browserPermission: NotificationPermission;
	handleSubscribe: () => Promise<void>;
	handleUnsubscribe: () => Promise<void>;
	checkBrowserPermission: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
	undefined
);

export const useNotifications = (): NotificationContextType => {
	const context = useContext(NotificationContext);
	if (!context) {
		throw new Error(
			"useNotifications must be used within a NotificationProvider"
		);
	}
	return context;
};

interface NotificationProviderProps {
	children: ReactNode;
}

export const NotificationProvider = ({
	children,
}: NotificationProviderProps): JSX.Element => {
	const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [browserPermission, setBrowserPermission] =
		useState<NotificationPermission>("default");

	const checkBrowserPermission = (): void => {
		if ("Notification" in window) {
			setBrowserPermission(Notification.permission);
			setIsSubscribed(Notification.permission === "granted");
		}
	};

	useEffect(() => {
		// Check if notifications are already enabled
		checkBrowserPermission();
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
				.upsert({ id: userData?.user?.id, fcm_token: token });

			if (updateError) throw updateError;

			setIsSubscribed(true);
			checkBrowserPermission();
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
				.update({ fcm_token: null })
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
					console.log("unsubscribing from notifications");
					unsubscribe();
				}
			};
		}
	}, [isSubscribed]);

	const value = {
		isSubscribed,
		error,
		browserPermission,
		handleSubscribe,
		handleUnsubscribe,
		checkBrowserPermission,
	};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
};
