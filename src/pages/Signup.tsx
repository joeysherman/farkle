import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BouncingDice } from "../components/BouncingDice";
import { useAuth } from "../contexts/AuthContext";

// loading spinner using tailwind css and daisyui
function LoadingSpinner(): JSX.Element {
	return (
		<div className="flex justify-center items-center">
			<div className="loading loading-spinner loading-lg text-accent"></div>
		</div>
	);
}

export function Signup(): JSX.Element {
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const { signUp } = useAuth();

	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const handleSubmit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();

		try {
			setLoading(true);
			setMessage(null);

			const { error } = await signUp(email, password);

			if (error) throw error;
			setMessage({
				type: "success",
				text: "Check your email to confirm your account!",
			});
		} catch (error) {
			setMessage({
				type: "error",
				text: error instanceof Error ? error.message : "An error occurred",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100 flex items-center justify-center p-4">
			<BouncingDice />
			<div className="card w-full max-w-md bg-base-100 shadow-md ring-1 ring-base-300">
				<div className="card-body">
					<div className="text-center mb-6">
						<h2 className="card-title text-2xl justify-center mb-2 text-neutral">
							Create your account
						</h2>
						<p className="text-slate-500">
							Join us to start playing Farkle online
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
								className="input input-bordered"
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
								autoComplete="new-password"
								required
								placeholder="Create a password"
								className="input input-bordered"
								disabled={loading}
								value={password}
								onChange={(event): void => {
									setPassword(event.target.value);
								}}
							/>
						</div>

						<div className="form-control mt-6">
							{loading ? (
								<LoadingSpinner />
							) : (
								<button type="submit" className="btn btn-accent">
									Create account
								</button>
							)}
						</div>
					</form>

					<div className="divider">OR</div>

					<div className="text-center">
						<p className="text-slate-500 mb-3">Already have an account?</p>
						<Link to="/signin" disabled={loading}>
							<button
								className="btn btn-outline btn-accent w-full"
								disabled={loading ? "disabled" : ""}
							>
								Sign in
							</button>
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
