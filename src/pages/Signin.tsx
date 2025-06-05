import { useCallback, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { BouncingDice } from "../components/BouncingDice";
import { useAuth } from "../contexts/AuthContext";

export function Signin(): JSX.Element {
	const router = useRouter();
	const navigate = useNavigate();

	const { signIn } = useAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const handleSubmit = useCallback(
		async (event: React.FormEvent): Promise<void> => {
			event.preventDefault();
			event.stopPropagation();

			try {
				setLoading(true);
				setMessage(null);

				const { error } = await signIn(email, password);

				if (error) throw error;
				debugger;
				console.log("Navigating to dashboard");
				//setLoading(false);
				// replace the current route with the dashboard route

				// navigate to the dashboard route using js
				router.history.replace("/app/dashboard");
			} catch (error) {
				debugger;
				setMessage({
					type: "error",
					text: error instanceof Error ? error.message : "An error occurred",
				});
			} finally {
				//setLoading(false);
			}
		},
		[signIn, router, email, password, navigate]
	);

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 px-4 sm:px-6 lg:px-8">
			<BouncingDice />
			<div className="max-w-md w-full space-y-8 backdrop-blur-sm bg-white/70 p-8 rounded-xl shadow-xl">
				<div>
					<h2 className="text-center text-2xl font-bold text-gray-900">
						Welcome back!
					</h2>
					<p className="mt-2 text-center text-sm text-gray-600">
						Sign in to continue your game
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

				<form className="mt-8 space-y-6">
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
							className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={loading}
							onClick={handleSubmit}
							type="submit"
						>
							{loading ? "Signing in..." : "Sign in"}
						</button>
					</div>
				</form>

				<div className="mt-8 pt-6 border-t border-gray-200">
					<p className="text-center text-sm text-gray-600">
						Don't have an account yet?
					</p>
					<div className="mt-3">
						<Link
							className="w-full flex justify-center py-2 px-4 border border-indigo-600 rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-transparent hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
							to="/signup"
						>
							Sign up
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
