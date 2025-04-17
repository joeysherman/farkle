import { useEffect } from "react";
import { useNotifications } from "../contexts/NotificationContext";

export const NotificationListener = (): JSX.Element | null => {
	const { isSubscribed } = useNotifications();

	useEffect(() => {
		// This component now just listens for notifications when subscribed
		// The actual notification handling is done in the NotificationContext
		if (isSubscribed) {
			console.log("Notification listener active");
		}
	}, [isSubscribed]);

	// This component doesn't render anything
	return null;
};
