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

	if (isDisabled) {
		debugger;
	}
	return (
		<div className="flex-none grid grid-cols-2 gap-6 py-2 px-4">
			{isFarkle && latestAction ? (
				<button
					className="col-span-2 w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-500 hover:bg-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					onClick={() => {
						debugger;
						if (latestAction?.kept_dice) {
							void onTurnAction(latestAction.kept_dice, "bust");
						}
					}}
				>
					End Turn
				</button>
			) : turnActions.length === 0 || latestAction?.turn_action_outcome ? (
				<button
					disabled={isPending}
					className="col-span-2 w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						e.target.blur();
						void onRoll(6);
					}}
				>
					Start Turn
				</button>
			) : latestAction ? (
				<>
					<button
						className="w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
						disabled={!canContinue || isPending}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							e.target.blur();
							if (canContinue) {
								void onTurnAction(latestAction.kept_dice, "bank");
							}
						}}
					>
						Bank {turnActions.reduce((acc, action) => acc + action.score, 0)}
					</button>
					<button
						className="w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
						disabled={isDisabled}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							e.target.blur();
							if (canContinue) {
								const keptDice = selectedDiceIndices
									.map((index) => latestAction.dice_values[index])
									.filter(Boolean);
								const validScoringDice = latestAction.kept_dice;
								const allKeptDice = [...validScoringDice, ...keptDice];
								void onTurnAction(allKeptDice, "continue");
								setSelectedDiceIndices([]);
							}
						}}
					>
						{latestAction.available_dice === 0 &&
							latestAction.score > 0 &&
							"Hot Dice! Roll 6 dice"}
						{latestAction.available_dice > 0 &&
							latestAction.score > 0 &&
							`Roll ${latestAction.available_dice} dice`}
					</button>
				</>
			) : null}
		</div>
	);
};
