import { useEffect, useRef, useState } from "react";
import { TurnAction } from "./Room";

export function TurnActions({
	turnActions,
	room,
}: {
	turnActions: TurnAction[];
	room: GameRoom;
}) {
	const turnActionsRef = useRef<HTMLDivElement>(null);
	const [selectedDiceIndices, setSelectedDiceIndices] = useState<number[]>([]);

	// Add effect to scroll to bottom when turnActions changes
	useEffect(() => {
		if (turnActionsRef.current) {
			turnActionsRef.current.scrollTop = turnActionsRef.current.scrollHeight;
		}
	}, [turnActions]);

	return (
		<div
			ref={turnActionsRef}
			className="flex-1 overflow-y-auto mb-4 scroll-smooth"
		>
			<div className="space-y-1">
				{turnActions.map((action, index, array) => {
					const remainingDice = action.dice_values.filter(
						(value) => !action.kept_dice.includes(value)
					);

					const isLatestAction = index === array.length - 1;

					return (
						<div key={action.id} className="bg-gray-50 rounded p-1.5 text-sm">
							<div className="flex items-center gap-2">
								<span className="text-gray-500 min-w-[60px]">
									{isLatestAction
										? "Latest Roll:"
										: "Roll " + action.action_number + ":"}
								</span>

								{/* Combined dice display */}
								<div className="flex gap-1 flex-1">
									{/* Remaining dice */}
									{remainingDice.map((value, index) => (
										<button
											key={index}
											disabled={
												action !== turnActions[turnActions.length - 1] ||
												Boolean(action.turn_action_outcome)
											}
											className={`w-6 h-6 flex items-center justify-center text-xs rounded ${
												selectedDiceIndices.includes(
													action.dice_values.indexOf(value)
												)
													? "bg-indigo-500 text-white"
													: "bg-white border border-gray-300"
											} ${
												action === turnActions[turnActions.length - 1] &&
												!action.turn_action_outcome
													? "hover:bg-indigo-100 cursor-pointer"
													: "cursor-default"
											}`}
											onClick={() => {
												if (
													action === turnActions[turnActions.length - 1] &&
													!action.turn_action_outcome
												) {
													const originalIndex =
														action.dice_values.indexOf(value);
													setSelectedDiceIndices((previous) => {
														if (previous.includes(originalIndex)) {
															return previous.filter(
																(index_) => index_ !== originalIndex
															);
														} else {
															return [...previous, originalIndex];
														}
													});
												}
											}}
										>
											{value}
										</button>
									))}

									{/* Scoring/kept dice */}
									{action.kept_dice.map((value, index) => (
										<div
											key={index}
											className="w-6 h-6 flex items-center justify-center text-xs rounded bg-green-100 border border-green-300 text-green-700"
										>
											{value}
										</div>
									))}

									{/* Show Farkle or empty state */}
									{remainingDice.length === 0 &&
										action.kept_dice.length === 0 && (
											<span className="text-red-500 text-xs font-medium">
												Farkle!
											</span>
										)}
								</div>

								{/* Score indicator */}
								<div
									className={`min-w-[50px] text-right font-medium ${
										action.score > 0 ? "text-green-600" : "text-red-500"
									}`}
								>
									{action.score > 0 ? `+${action.score}` : "+0"}
								</div>
							</div>
						</div>
					);
				})}

				{turnActions.length === 0 && room?.status === "in_progress" && (
					<div className="flex justify-center items-center h-full pt-4">
						<p className="text-sm text-gray-500 italic">Start rolling!</p>
					</div>
				)}
				{turnActions.length === 0 && room?.status === "waiting" && (
					<div className="flex justify-center items-center h-full pt-4">
						<p className="text-sm text-gray-500 italic">
							Waiting for game to start.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
