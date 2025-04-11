import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabaseClient";
import { BouncingDice } from "../components/BouncingDice";

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

	if (isAuthenticated) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="max-w-md w-full">
					<div className="rounded-md bg-yellow-50 p-4">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg
									className="h-5 w-5 text-yellow-400"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fillRule="evenodd"
										d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
										clipRule="evenodd"
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
					<div className="rounded-md shadow-sm -space-y-px">
						<div>
							<label htmlFor="email-address" className="sr-only">
								Email address
							</label>
							<input
								id="email-address"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
								placeholder="Email address"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
						<div>
							<label htmlFor="password" className="sr-only">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
								placeholder="Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={loading}
							className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
						>
							{loading ? (
								<>
									<svg
										className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										></circle>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									Signing in...
								</>
							) : (
								"Sign in"
							)}
						</button>
					</div>

					<div className="text-center">
						<Link
							to="/signup"
							className="font-medium text-indigo-600 hover:text-indigo-500"
						>
							Don't have an account? Sign up
						</Link>
					</div>
				</form>
			</div>
		</div>
	);
}
