import { useEffect, useRef } from "react";
import type { TurnAction } from "./Room";
import { Disclosure } from "@headlessui/react";

export function TurnActions({
	isCurrentPlayerTurn,
	turnActions,
	room,
}: {
	isCurrentPlayerTurn: boolean;
	turnActions: Array<TurnAction>;
	room: GameRoom;
}) {
	const turnActionsRef = useRef<HTMLDivElement>(null);

	// Add effect to scroll to bottom when turnActions changes
	useEffect(() => {
		if (turnActionsRef.current) {
			turnActionsRef.current.scrollTop = turnActionsRef.current.scrollHeight;
		}
	}, [turnActions]);

	// Get the latest turn action
	const latestAction = turnActions[turnActions.length - 1];
	// Get previous turn actions
	const previousActions = turnActions.slice(0, -1);

	const RollDisplay = ({
		action,
		isLatest,
	}: {
		action: TurnAction;
		isLatest: boolean;
	}) => {
		const remainingDice = action.dice_values.filter(
			(value) => !action.scoring_dice.includes(value)
		);

		return (
			<div className="rounded p-1.5 text-sm">
				<div className="flex items-center gap-2">
					<span className="text-gray-500 min-w-[60px]">
						{isLatest ? "Latest Roll:" : "Roll " + action.action_number + ":"}
					</span>

					{/* Combined dice display */}
					<div className="flex gap-1 flex-1">
						{action?.dice_values.map((value, index) => {
							let keptDice = action.kept_dice;
							let isScoringDice = false;

							keptDice = action.selected_dice;

							// if keptDice is not empty, then it is a past turn action
							if (keptDice.length > 0) {
								// if the index is in the keptDice array, then it is a scoring dice
								isScoringDice = keptDice.includes(index);
							} else {
								isScoringDice = action.scoring_dice.includes(value);
							}
							if (isScoringDice) {
								return (
									<div
										key={index}
										className="w-6 h-6 flex items-center justify-center text-xs rounded bg-green-100 border border-green-300 text-green-700"
									>
										{value}
									</div>
								);
							} else {
								return (
									<div
										key={index}
										className="w-6 h-6 flex items-center justify-center text-xs rounded bg-white border border-gray-300 text-gray-700"
									>
										{value}
									</div>
								);
							}
						})}

						{/* Show Farkle or empty state */}
						{remainingDice.length === 0 && action.scoring_dice.length === 0 && (
							<span className="text-red-500 text-xs font-medium">Farkle!</span>
						)}
					</div>

					{/* Score indicator */}
					<div
						className={`min-w-[50px] text-right font-medium ${
							action.score > 0 ? "text-green-600" : "text-red-500"
						} ${isLatest ? "" : "pr-6"}`}
					>
						{action.score > 0 ? `+${action.score}` : "+0"}
					</div>
				</div>
			</div>
		);
	};

	if (turnActions.length === 0) {
		// if (isCurrentPlayerTurn) {
		// 	return (
		// 		<div ref={turnActionsRef} className="h-[42px] overflow-y-auto">
		// 			<div className="flex justify-center items-center h-[42px]">
		// 				{room?.status === "in_progress" ? (
		// 					<p className="text-sm text-gray-500 italic">Start rolling!</p>
		// 				) : (
		// 					<p className="text-sm text-gray-500 italic">Start the game.</p>
		// 				)}
		// 			</div>
		// 		</div>
		// 	);
		// } else {
		// 	return (
		// 		<div ref={turnActionsRef} className="h-[42px] overflow-y-auto">
		// 			<div className="flex justify-center items-center h-[42px]">
		// 				{room?.status === "in_progress" ? (
		// 					isCurrentPlayerTurn ? (
		// 						<p className="text-sm text-gray-500 italic">Start rolling!</p>
		// 					) : (
		// 						<p className="text-sm text-gray-500 italic">
		// 							Waiting for player to roll.
		// 						</p>
		// 					)
		// 				) : (
		// 					<p className="text-sm text-gray-500 italic">
		// 						Waiting for game to start.
		// 					</p>
		// 				)}
		// 			</div>
		// 		</div>
		// 	);
		// }
		return null;
	}

	return (
		<div className="h-auto min-h-[42px] overflow-hidden">
			{/* Mobile view */}
			<div className="md:hidden">
				{latestAction && (
					<div className="collapse bg-white rounded-lg border">
						<input
							type="checkbox"
							className="peer"
							disabled={previousActions.length === 0}
						/>
						<div className="collapse-title flex items-center justify-between p-0">
							<div className="flex-1 p-2 pr-0">
								<RollDisplay action={latestAction} isLatest />
							</div>
							{previousActions.length > 0 && (
								<div className="flex items-center justify-center w-8 h-full">
									<div className="w-4 h-4 text-gray-400">
										<svg
											className="w-full h-full transform peer-checked:rotate-180 transition-transform duration-200"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 9l-7 7-7-7"
											/>
										</svg>
									</div>
								</div>
							)}
						</div>
						{previousActions.length > 0 && (
							<div className="collapse-content px-2">
								<div className="space-y-1.5">
									{previousActions.map((action) => (
										<RollDisplay
											key={action.id}
											action={action}
											isLatest={false}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Desktop view */}
			<div className="hidden md:flex md:flex-col h-[180px]">
				{/* Scrollable previous actions */}
				<div
					ref={turnActionsRef}
					className="flex-1 overflow-y-auto space-y-1 mb-1"
				>
					{previousActions.map((action) => (
						<RollDisplay key={action.id} action={action} isLatest={false} />
					))}
				</div>
				{/* Fixed latest action at bottom */}
				<div className="flex-none">
					{latestAction && <RollDisplay action={latestAction} isLatest />}
				</div>
			</div>
		</div>
	);
}
