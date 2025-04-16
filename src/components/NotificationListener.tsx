import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { onMessageListener } from "../config/firebase";

interface NotificationPayload {
	notification?: {
		title?: string;
		body?: string;
	};
}

export const NotificationListener = (): JSX.Element | null => {
	useEffect(() => {
		const unsubscribe = onMessageListener().then(
			(payload: NotificationPayload) => {
				if (payload?.notification) {
					const { title, body } = payload.notification;
					console.log("NotificationListener", payload);
					// Display the notification as a toast
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
			// Clean up the listener when component unmounts
			if (typeof unsubscribe === "function") {
				unsubscribe();
			}
		};
	}, []);

	// This component doesn't render anything visible
	return null;
};
