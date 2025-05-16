import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User } from "@supabase/supabase-js";
import { GameRoom } from "../pages/Room";

// Add custom animation styles
const copiedAnimationStyles = `
	@keyframes slideIn {
		0% {
			opacity: 0;
			transform: translateY(100%);
		}
		10% {
			opacity: 1;
			transform: translateY(0);
		}
		90% {
			opacity: 1;
			transform: translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateY(-100%);
		}
	}
	
	.animate-slide-in {
		animation: slideIn 2s ease-in-out forwards;
	}
`;

interface InviteModalProps {
	room: GameRoom | null;
	user: User | null;
	roomId: string;
	localUsername: string;
	setLocalUsername: (username: string) => void;
	handleJoinWithCode: (code: string, username: string) => Promise<void>;
	copyInviteLink: () => Promise<void>;
	copied: boolean;
	onClose: () => void;
}

export function InviteModal({
	room,
	user,
	roomId,
	localUsername,
	setLocalUsername,
	handleJoinWithCode,
	copyInviteLink,
	copied,
	onClose,
}: InviteModalProps): JSX.Element {
	const navigate = useNavigate();
	const codeInputRef = useRef<HTMLInputElement>(null);
	const joinButtonRef = useRef<HTMLButtonElement>(null);
	const [code, setCode] = useState("");
	const [isValid, setIsValid] = useState(false);
	const [countdown, setCountdown] = useState(5);
	const [codeCopied, setCodeCopied] = useState(false);
	console.log("code", code);

	// Handle ESC key press to close modal
	useEffect(() => {
		const handleEscKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleEscKey);
		return () => {
			window.removeEventListener("keydown", handleEscKey);
		};
	}, [onClose]);

	// Add effect to handle auto-redirect when game is in progress
	useEffect(() => {
		if (room?.status === "in_progress") {
			const timer = setInterval(() => {
				setCountdown((previous) => {
					if (previous <= 1) {
						void navigate({ to: "/app/dashboard" });
						return 0;
					}
					return previous - 1;
				});
			}, 1000);
			return () => clearInterval(timer);
		}
	}, [room?.status, navigate]);

	// Handle code paste
	const handleCodePaste = (
		event: React.ClipboardEvent<HTMLInputElement>
	): void => {
		console.log("Paste event triggered");
		event.preventDefault();
		const pastedText = event.clipboardData.getData("text");
		console.log("Pasted text:", pastedText);
		// Only allow digits and limit to 6 characters
		const digitsOnly = pastedText.replace(/\D/g, "").slice(0, 6);
		console.log("Digits only:", digitsOnly);
		setCode(digitsOnly);
		setIsValid(digitsOnly.length === 6);
	};

	// Handle code changes
	const handleCodeChange = (
		event: React.ChangeEvent<HTMLInputElement>
	): void => {
		console.log("Change event triggered");
		const value = event.target.value;
		console.log("Input value:", value);
		// Only allow digits and limit to 6 characters
		const digitsOnly = value.replace(/\D/g, "").slice(0, 6);
		console.log("Digits only:", digitsOnly);

		setCode(digitsOnly);
		setIsValid(digitsOnly.length === 6);
	};

	// Auto-join when code is 6 digits
	useEffect(() => {
		console.log("Code changed:", code);
		if (code.length === 6) {
			console.log("Attempting to join with code:", code);
			void handleJoinWithCode(code, localUsername);
		}
	}, [code, handleJoinWithCode, localUsername]);

	// Handle backdrop click
	const handleBackdropClick = (
		event: React.MouseEvent<HTMLDivElement>
	): void => {
		// Only close if the click was directly on the backdrop
		if (event.target === event.currentTarget) {
			onClose();
		}
	};

	// Handle invite code click to copy
	const handleInviteCodeClick = async (): Promise<void> => {
		if (room?.invite_code) {
			await navigator.clipboard.writeText(room.invite_code);
			setCodeCopied(true);
			setTimeout(() => {
				setCodeCopied(false);
			}, 2000);
		}
	};

	return (
		<div
			className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
			onClick={handleBackdropClick}
		>
			<style>{copiedAnimationStyles}</style>
			<div className="bg-white rounded-lg p-6 max-w-md w-full relative">
				{/* Close button */}
				<button
					className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 focus:outline-none"
					onClick={onClose}
					type="button"
				>
					<span className="sr-only">Close</span>
					<svg
						className="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>

				{user && room?.created_by === user.id ? (
					<>
						<h3 className="text-lg font-medium mb-4">
							Invite Players to {room?.name}
						</h3>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700">
									Room Code{" "}
									<span className="text-xs text-gray-500">
										{codeCopied ? "(copied to clipboard)" : "(click to copy)"}
									</span>
								</label>
								<div className="mt-1 relative">
									<input
										className={`block w-full px-3 py-2 rounded-md outline-none ${
											codeCopied
												? "border border-green-500 bg-green-50 active:border-green-500"
												: "border-gray-300 bg-gray-50 border"
										} cursor-pointer transition-colors duration-200`}
										onClick={handleInviteCodeClick}
										readOnly
										type="text"
										value={room?.invite_code}
									/>
									{codeCopied && (
										<div className="absolute inset-0 flex items-center justify-center bg-green-50 bg-opacity-90 rounded-md animate-slide-in">
											<div className="flex items-center text-green-500 font-medium">
												<svg
													className="h-5 w-5 mr-2"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M5 13l4 4L19 7"
													/>
												</svg>
												<span className="text-lg">Copied!</span>
											</div>
										</div>
									)}
								</div>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700">
									Room URL{" "}
									<span className="text-xs text-gray-500">
										{copied ? "(copied to clipboard)" : "(click to copy)"}
									</span>
								</label>
								<div className="mt-1 relative">
									<div className="flex rounded-md shadow-sm">
										<input
											className={`block w-full px-3 py-2 rounded-md outline-none ${
												copied
													? "border border-green-500 bg-green-50 active:border-green-500"
													: "border-gray-300 bg-gray-50 border"
											} cursor-pointer transition-colors duration-200`}
											onClick={copyInviteLink}
											readOnly
											type="text"
											value={`${window.location.origin}/room?roomId=${roomId}`}
										/>
									</div>
									{copied && (
										<div className="absolute inset-0 flex items-center justify-center bg-green-50 bg-opacity-90 rounded-md animate-slide-in">
											<div className="flex items-center text-green-500 font-medium">
												<svg
													className="h-5 w-5 mr-2"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M5 13l4 4L19 7"
													/>
												</svg>
												<span className="text-lg">Copied!</span>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					</>
				) : room?.status === "in_progress" ? (
					<>
						<h3 className="text-lg font-medium mb-4 text-red-600">
							Game Already Started
						</h3>
						<p className="text-gray-600 mb-4">You cannot join at this time.</p>
						<p className="text-2xl font-bold text-indigo-600 text-center mb-4">
							Redirecting in {countdown}
						</p>
						<button
							className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
							onClick={() => void navigate({ to: "/app/dashboard" })}
						>
							Go Back
						</button>
					</>
				) : (
					<>
						<h3 className="text-lg font-medium mb-4">
							Join {room?.name || "Game"}
						</h3>
						<div className="space-y-4">
							{!user && (
								<div>
									<label className="block text-sm font-medium text-gray-700">
										Username
									</label>
									<input
										className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300"
										onChange={(event) => setLocalUsername(event.target.value)}
										placeholder="Enter your username"
										type="text"
										value={localUsername}
									/>
								</div>
							)}
							<div>
								<label className="block text-sm font-medium text-gray-700">
									Room Code
								</label>
								<input
									className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300"
									inputMode="numeric"
									maxLength={6}
									onChange={handleCodeChange}
									onPaste={handleCodePaste}
									pattern="[0-9]*"
									placeholder="Enter 6-digit code"
									ref={codeInputRef}
									type="text"
									value={code}
								/>
							</div>
							<button
								className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={!isValid}
								onClick={() => void handleJoinWithCode(code, localUsername)}
								ref={joinButtonRef}
							>
								Join Game
							</button>
							{/* go back home */}
							<button
								className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
								onClick={() => void navigate({ to: "/app/dashboard" })}
							>
								Go Back
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
