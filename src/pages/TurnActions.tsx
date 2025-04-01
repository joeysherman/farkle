import { useEffect, useRef, useState } from "react";
import { TurnAction } from "./Room";

export function TurnActions({
	isCurrentPlayerTurn,
	turnActions,
	room,
}: {
	isCurrentPlayerTurn: boolean;
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

	// Get only the last 2 turn actions
	const lastTwoTurnActions = turnActions.slice(-2);

	return (
		<div ref={turnActionsRef} className="h-[84px] overflow-y-auto">
			<div className="space-y-1">
				{lastTwoTurnActions.map((action, index, array) => {
					const remainingDice = action.dice_values.filter(
						(value) => !action.scoring_dice.includes(value)
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
									{action?.dice_values.map((value, index) => {
										let keptDice = action.kept_dice;
										let isScoringDice = false;
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
									{remainingDice.length === 0 &&
										action.scoring_dice.length === 0 && (
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
					<div className="flex justify-center items-center h-[84px]">
						{isCurrentPlayerTurn ? (
							<p className="text-sm text-gray-500 italic">Start rolling!</p>
						) : (
							<p className="text-sm text-gray-500 italic">
								Waiting for player to roll.
							</p>
						)}
					</div>
				)}
				{turnActions.length === 0 && room?.status === "waiting" && (
					<div className="flex justify-center items-center h-[84px]">
						<p className="text-sm text-gray-500 italic">
							Waiting for game to start.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
