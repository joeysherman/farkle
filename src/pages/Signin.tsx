import { useCallback, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BouncingDice } from "../components/BouncingDice";
import { useAuth } from "../contexts/AuthContext";

export function Signin(): JSX.Element {
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

				// Navigation will be handled by auth state change and route guards
				// Just trigger a navigation to let the guards handle the redirect
				await navigate({ to: "/", replace: true });
			} catch (error) {
				setMessage({
					type: "error",
					text: error instanceof Error ? error.message : "An error occurred",
				});
			} finally {
				setLoading(false);
			}
		},
		[signIn, navigate, email, password]
	);

	return (
		<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
			<BouncingDice />
			<div className="card w-full max-w-md bg-base-100 shadow-2xl">
				<div className="card-body">
					<div className="text-center mb-6">
						<h2 className="card-title text-2xl justify-center mb-2">
							Welcome back!
						</h2>
						<p className="text-base-content/70">
							Sign in to continue your game
						</p>
					</div>

					{message && (
						<div
							className={`alert ${message.type === "success" ? "alert-success" : "alert-error"} mb-4`}
						>
							<span>{message.text}</span>
						</div>
					)}

					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="form-control">
							<label className="label" htmlFor="email">
								<span className="label-text">Email address</span>
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="username email"
								required
								placeholder="Enter your email"
								className="input input-bordered input-primary"
								disabled={loading}
								value={email}
								onChange={(event): void => {
									setEmail(event.target.value);
								}}
							/>
						</div>

						<div className="form-control">
							<label className="label" htmlFor="password">
								<span className="label-text">Password</span>
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								placeholder="Enter your password"
								className="input input-bordered input-primary"
								disabled={loading}
								value={password}
								onChange={(event): void => {
									setPassword(event.target.value);
								}}
							/>
						</div>

						<div className="form-control mt-6">
							<button
								type="submit"
								className={`btn btn-primary ${loading ? "loading" : ""}`}
								disabled={loading}
							>
								{loading ? "Signing in..." : "Sign in"}
							</button>
						</div>
					</form>

					<div className="divider">OR</div>

					<div className="text-center">
						<p className="text-base-content/70 mb-3">
							Don't have an account yet?
						</p>
						<Link className="btn btn-outline btn-primary w-full" to="/signup">
							Sign up
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
