import { useNotifications } from "../hooks/useNotifications";

export const DashboardNotifications = (): JSX.Element => {
	const { subscription, error, subscribe, unsubscribe } = useNotifications();

	return (
		<div className="flex flex-col gap-2">
			{error && (
				<div className="text-red-500 text-sm">Error: {error.message}</div>
			)}
			<button
				className={`px-4 py-2 rounded-md ${
					subscription
						? "bg-red-500 hover:bg-red-600"
						: "bg-blue-500 hover:bg-blue-600"
				} text-white transition-colors`}
				onClick={() => {
					if (subscription) {
						void unsubscribe();
					} else {
						void subscribe();
					}
				}}
			>
				{subscription ? "Disable Notifications" : "Enable Notifications"}
			</button>
		</div>
	);
};
