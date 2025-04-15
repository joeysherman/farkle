import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User } from "@supabase/supabase-js";
import { GameRoom } from "../pages/Room";

interface InviteModalProps {
	room: GameRoom | null;
	user: User | null;
	roomId: string;
	localUsername: string;
	setLocalUsername: (username: string) => void;
	handleJoinWithCode: (code: string, username: string) => Promise<void>;
	copyInviteLink: () => Promise<void>;
	copied: boolean;
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
}: InviteModalProps): JSX.Element {
	const navigate = useNavigate();
	const codeInputRef = useRef<HTMLInputElement>(null);
	const joinButtonRef = useRef<HTMLButtonElement>(null);
	const [code, setCode] = useState("");
	const [isValid, setIsValid] = useState(false);
	const [countdown, setCountdown] = useState(5);

	// Add effect to handle auto-redirect when game is in progress
	useEffect(() => {
		if (room?.status === "in_progress") {
			const timer = setInterval(() => {
				setCountdown((previous) => {
					if (previous <= 1) {
						void navigate({ to: "/" });
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

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
			<div className="bg-white rounded-lg p-6 max-w-md w-full">
				{user && room?.created_by === user.id ? (
					<>
						<h3 className="text-lg font-medium mb-4">
							Invite Players to {room?.name}
						</h3>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700">
									Room Code
								</label>
								<input
									className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 bg-gray-50"
									readOnly
									type="text"
									value={room?.invite_code}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700">
									Room URL
								</label>
								<div className="mt-1 flex rounded-md shadow-sm">
									<input
										className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 bg-gray-50"
										readOnly
										type="text"
										value={`${window.location.origin}/room?roomId=${roomId}`}
									/>
									<button
										className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
										onClick={copyInviteLink}
									>
										{copied ? "Copied!" : "Copy"}
									</button>
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
							onClick={() => void navigate({ to: "/" })}
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
								onClick={() => void navigate({ to: "/" })}
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
