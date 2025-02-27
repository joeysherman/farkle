import { useState } from "react";
import { toast } from "react-hot-toast";

const AVAILABLE_AVATARS = [
	"default",
	"avatar_1",
	"avatar_2",
	"avatar_3",
	"avatar_4",
	"avatar_5",
] as const;

export type AvatarName = (typeof AVAILABLE_AVATARS)[number];

interface AvatarSelectorProps {
	currentAvatar: AvatarName;
	onSelect: (avatarName: AvatarName) => Promise<void>;
	onClose?: () => void;
	showCloseButton?: boolean;
}

export const AvatarSelector = ({
	currentAvatar,
	onSelect,
	onClose,
	showCloseButton = true,
}: AvatarSelectorProps): JSX.Element => {
	const [loadingAvatar, setLoadingAvatar] = useState<AvatarName | null>(null);

	const handleAvatarSelect = async (avatarName: AvatarName): Promise<void> => {
		try {
			setLoadingAvatar(avatarName);
			await onSelect(avatarName);
			void toast.success("Avatar updated successfully!");
		} catch (error) {
			console.error("Failed to update avatar:", error);
			void toast.error("Failed to update avatar. Please try again.");
		} finally {
			setLoadingAvatar(null);
		}
	};

	return (
		<div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
			<div className="flex justify-between items-center mb-4">
				<h3 className="text-lg font-medium text-gray-900">Select Avatar</h3>
				{showCloseButton && onClose && (
					<button
						className="text-gray-400 hover:text-gray-500"
						onClick={onClose}
					>
						<span className="sr-only">Close</span>
						<svg
							className="h-6 w-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M6 18L18 6M6 6l12 12"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
							/>
						</svg>
					</button>
				)}
			</div>
			<div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
				{AVAILABLE_AVATARS.map((avatarName) => (
					<button
						key={avatarName}
						disabled={loadingAvatar !== null}
						onClick={() => {
							void handleAvatarSelect(avatarName);
						}}
						className={`relative rounded-lg p-2 flex items-center justify-center ${
							currentAvatar === avatarName
								? "ring-2 ring-indigo-500"
								: "hover:bg-gray-50"
						}`}
					>
						<img
							alt={`Avatar ${avatarName}`}
							src={`/avatars/${avatarName}.svg`}
							className={`w-16 h-16 rounded-full ${
								loadingAvatar === avatarName ? "opacity-50" : ""
							}`}
						/>
						{loadingAvatar === avatarName && (
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="w-8 h-8 border-t-2 border-indigo-500 border-solid rounded-full animate-spin"></div>
							</div>
						)}
					</button>
				))}
			</div>
		</div>
	);
};
