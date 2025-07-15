import type { User } from "@supabase/supabase-js";
import { GameState, GamePlayer, TurnAction } from "./Room";

// Game Actions Component
export const GameActions: React.FC<{
	gameState: GameState | null;
	user: User | null;
	players: Array<GamePlayer>;
	turnActions: Array<TurnAction>;
	isPending: boolean;
	selectedDiceIndices: Array<number>;
	onTurnAction: (
		keptDice: Array<number>,
		outcome: "bust" | "bank" | "continue"
	) => Promise<void>;
	onRoll: (numberDice: number) => Promise<void>;
	setSelectedDiceIndices: React.Dispatch<React.SetStateAction<Array<number>>>;
}> = ({
	gameState,
	user,
	players,
	turnActions,
	selectedDiceIndices,
	isPending,
	onTurnAction,
	onRoll,
	setSelectedDiceIndices,
}) => {
	if (!gameState || !user) return null;

	const currentPlayer = players.find((p) => p.user_id === user.id);
	const isCurrentPlayerTurn = gameState.current_player_id === currentPlayer?.id;

	if (!isCurrentPlayerTurn) return null;

	const latestAction = turnActions[turnActions.length - 1];
	const isFarkle = latestAction?.score === 0;
	const canContinue = latestAction && !latestAction.turn_action_outcome;

	const isDisabled = isPending || !canContinue;

	return (
		<div className="flex-none grid grid-cols-2 gap-4 py-2 sm:gap-3 sm:py-3 sm:px-4">
			{isFarkle && latestAction ? (
				<button
					className="btn btn-error col-span-2 w-full"
					onClick={() => {
						if (latestAction?.scoring_dice) {
							void onTurnAction(latestAction.scoring_dice, "bust");
						}
					}}
				>
					End Turn (Farkle!)
				</button>
			) : turnActions.length === 0 || latestAction?.turn_action_outcome ? (
				<button
					disabled={isPending}
					className="btn btn-primary col-span-2 w-full"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						e.target.blur();
						void onRoll(6);
					}}
				>
					{isPending ? (
						<span className="flex items-center justify-center gap-2">
							<svg
								className="animate-spin h-4 w-4 sm:h-5 sm:w-5"
								viewBox="0 0 24 24"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
									fill="none"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							Rolling...
						</span>
					) : (
						"Start Turn"
					)}
				</button>
			) : (
				<>
					<button
						className="btn btn-success w-full"
						disabled={!canContinue || isPending}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							e.target.blur();
							if (canContinue) {
								void onTurnAction(latestAction.scoring_dice, "bank");
							}
						}}
					>
						<div className="flex flex-col">
							<span>Bank Score</span>
							<span className="text-xs sm:text-sm font-normal opacity-90">
								{turnActions.reduce((acc, action) => acc + action.score, 0)}{" "}
								points
							</span>
						</div>
					</button>
					<button
						className="btn btn-primary w-full"
						disabled={isDisabled}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							e.target.blur();
							if (canContinue) {
								const keptDice = selectedDiceIndices
									.map((index) => latestAction.dice_values[index])
									.filter(Boolean);
								void onTurnAction(keptDice, "continue");
								setSelectedDiceIndices([]);
							}
						}}
					>
						<div className="flex flex-col">
							<span>Continue</span>
							<span className="text-xs sm:text-sm font-normal opacity-90">
								{latestAction.available_dice === 0 && latestAction.score > 0
									? "Roll 6 dice"
									: latestAction.available_dice > 0 && latestAction.score > 0
										? `Roll ${latestAction.available_dice} dice`
										: "Select dice"}
							</span>
						</div>
					</button>
				</>
			)}
		</div>
	);
};
