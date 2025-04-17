import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider, type createRouter } from "@tanstack/react-router";
import type { FunctionComponent } from "./common/types";
import { Toaster } from "react-hot-toast";
import { NotificationProvider } from "./contexts/NotificationContext";
// import { InitialNotificationPrompt } from "./components/InitialNotificationPrompt";
// import { TanStackRouterDevelopmentTools } from "./components/utils/development-tools/TanStackRouterDevelopmentTools";

const queryClient = new QueryClient();

type AppProps = { router: ReturnType<typeof createRouter> };

const App = ({ router }: AppProps): FunctionComponent => {
	return (
		<QueryClientProvider client={queryClient}>
			<NotificationProvider>
				<RouterProvider router={router} />
				<Toaster position="top-right" />
				{/* <InitialNotificationPrompt /> */}
				{/* <TanStackRouterDevelopmentTools
					router={router}
					initialIsOpen={false}
					position="bottom-right"
				/>
				<ReactQueryDevtools initialIsOpen={false} /> */}
			</NotificationProvider>
		</QueryClientProvider>
	);
};

export default App;
