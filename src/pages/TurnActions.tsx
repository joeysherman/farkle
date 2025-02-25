import { useEffect, useRef, useState } from "react";
import { TurnAction } from "./Room";

export function TurnActions({ turnActions }: { turnActions: TurnAction[] }) {
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
			<div className="space-y-2">
				{turnActions.map((action) => {
					const remainingDice = action.dice_values.filter(
						(value, index) => !action.kept_dice.includes(value)
					);

					return (
						<div key={action.id} className="bg-gray-50 rounded p-2 text-sm">
							<div className="flex justify-between items-start">
								<div className="w-full">
									<div className="flex items-center gap-2 mb-2">
										<span className="font-medium text-gray-500">
											Roll {action.action_number}:
										</span>
										{action.score > 0 ? (
											<div className="font-medium text-indigo-600 ml-auto">
												+{action.score}
											</div>
										) : (
											<div className="font-medium text-red-500 ml-auto">+0</div>
										)}
									</div>

									{/* Two rows: Remaining Dice and Kept Dice */}
									<div className="grid grid-cols-1 gap-2">
										{/* Remaining Dice Row */}
										<div className="grid grid-cols-[120px_1fr] items-center gap-2">
											<span className="font-medium text-gray-500">
												Dice left:
											</span>
											<div className="flex gap-1 flex-wrap">
												{remainingDice.map((value, index) => (
													<button
														key={index}
														disabled={
															action !== turnActions[turnActions.length - 1] ||
															Boolean(action.turn_action_outcome)
														}
														className={`w-8 h-8 flex items-center justify-center rounded ${
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
																action ===
																	turnActions[turnActions.length - 1] &&
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
												{remainingDice.length === 0 && (
													<span className="text-gray-500 italic">
														No dice available
													</span>
												)}
											</div>
										</div>

										{/* Kept Dice Row */}
										<div className="grid grid-cols-[120px_1fr] items-center gap-2">
											<span className="font-medium text-gray-500">
												Scoring dice:
											</span>
											<div className="flex gap-1 flex-wrap">
												{action.kept_dice.map((value, index) => (
													<div
														key={index}
														className="w-8 h-8 flex items-center justify-center rounded bg-green-100 border border-green-300 text-green-700"
													>
														{value}
													</div>
												))}
												{action.kept_dice.length === 0 && (
													<span className="text-red-500 italic font-bold">
														Farkle!
													</span>
												)}
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					);
				})}

				{turnActions.length === 0 && (
					<div className="flex justify-center items-center h-full pt-4">
						<p className="text-sm text-gray-500 italic">Start rolling!</p>
					</div>
				)}
			</div>
		</div>
	);
}
