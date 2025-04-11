import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabaseClient";
import { BouncingDice } from "../components/BouncingDice";
import { PushNotificationButton } from "../components/PushTest";

export function Signin(): JSX.Element {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	useEffect(() => {
		const checkAuth = async (): Promise<void> => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (user) {
				setIsAuthenticated(true);
				void navigate({ to: "/" });
			} else {
				setIsAuthenticated(false);
			}
		};

		void checkAuth();
	}, [navigate]);

	const handleLogout = async (): Promise<void> => {
		await supabase.auth.signOut();
		setIsAuthenticated(false);
	};

	const handleSubmit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();

		try {
			setLoading(true);
			setMessage(null);

			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) throw error;
			void navigate({ to: "/" });
		} catch (error) {
			setMessage({
				type: "error",
				text: error instanceof Error ? error.message : "An error occurred",
			});
		} finally {
			setLoading(false);
		}
	};

	if (isAuthenticated === true) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
				<div className="max-w-md w-full space-y-8">
					<div className="rounded-md bg-yellow-50 p-4">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg
									className="h-5 w-5 text-yellow-400"
									fill="currentColor"
									viewBox="0 0 20 20"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										clipRule="evenodd"
										d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
										fillRule="evenodd"
									/>
								</svg>
							</div>
							<div className="ml-3">
								<h3 className="text-sm font-medium text-yellow-800">
									Already Signed In
								</h3>
								<div className="mt-2 text-sm text-yellow-700">
									<p>You are already signed in. Redirecting to home page...</p>
									<button
										className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
										onClick={handleLogout}
									>
										<svg
											className="-ml-1 mr-2 h-4 w-4"
											fill="currentColor"
											viewBox="0 0 20 20"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												clipRule="evenodd"
												d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
												fillRule="evenodd"
											/>
											<path
												clipRule="evenodd"
												d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z"
												fillRule="evenodd"
											/>
										</svg>
										Sign out
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (isAuthenticated === null) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
			<BouncingDice />
			<div className="max-w-md w-full space-y-8 backdrop-blur-sm bg-white/70 p-8 rounded-xl shadow-xl">
				<div>
					<h1 className="text-center text-4xl font-extrabold text-indigo-900 mb-2">
						Farkle
					</h1>
					<p className="text-center text-lg text-indigo-600 font-medium italic">
						10k call it a day
					</p>
				</div>

				{message && (
					<div
						className={`rounded-md p-4 ${
							message.type === "success" ? "bg-green-50" : "bg-red-50"
						}`}
					>
						<p
							className={`text-sm ${
								message.type === "success" ? "text-green-800" : "text-red-800"
							}`}
						>
							{message.text}
						</p>
					</div>
				)}

				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div>
						<label
							className="block text-sm font-medium text-gray-700"
							htmlFor="email"
						>
							Email address
						</label>
						<div className="mt-1">
							<input
								autoComplete="username email"
								className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white/50 backdrop-blur-sm"
								disabled={loading}
								id="email"
								name="email"
								placeholder="Enter your email"
								required
								type="email"
								value={email}
								onChange={(event): void => {
									setEmail(event.target.value);
								}}
							/>
						</div>
					</div>

					<div>
						<label
							className="block text-sm font-medium text-gray-700"
							htmlFor="password"
						>
							Password
						</label>
						<div className="mt-1">
							<input
								autoComplete="current-password"
								className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white/50 backdrop-blur-sm"
								disabled={loading}
								id="password"
								name="password"
								placeholder="Enter your password"
								required
								type="password"
								value={password}
								onChange={(event): void => {
									setPassword(event.target.value);
								}}
							/>
						</div>
					</div>

					<div>
						<button
							className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
							disabled={loading}
							type="submit"
						>
							{loading ? "Signing in..." : "Sign in"}
						</button>
					</div>

					<div className="flex items-center justify-between">
						<div className="text-sm">
							<Link
								className="font-medium text-indigo-600 hover:text-indigo-500"
								to="/signup"
							>
								Don't have an account? Sign up
							</Link>
						</div>
					</div>
				</form>

				<div className="mt-6">
					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-gray-300"></div>
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="px-2 bg-white/70 text-gray-500">
								Push Notifications
							</span>
						</div>
					</div>
					<div className="mt-6">
						<PushNotificationButton />
					</div>
				</div>
			</div>
		</div>
	);
}
