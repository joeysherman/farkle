import { Dispatch, SetStateAction, Suspense, useRef } from "react";
import { Dice } from "./Dice";
interface DiceState {
	number: number;
}

interface DiceSceneProps {
	diceStates: DiceState[];
	isSpinning: boolean;
	setIsSpinning: Dispatch<SetStateAction<boolean>>;
}

/**
 * Main scene component that displays all dice
 */
export function DiceScene({
	diceStates,
	isSpinning,
	selectedDiceIndices,
	setSelectedDiceIndices,
}: DiceSceneProps) {
	return (
		<Suspense fallback={null}>
			{diceStates.map((diceState, index) => {
				const { placement, number, isScoringNumber } = diceState;
				return (
					<Dice
						key={index}
						index={index}
						placement={placement}
						value={number}
						isSpinning={isSpinning}
						isScoringNumber={isScoringNumber || false}
						onDiceClick={() => {
							if (selectedDiceIndices.includes(index)) {
								setSelectedDiceIndices(
									selectedDiceIndices.filter((i) => i !== index)
								);
							} else {
								setSelectedDiceIndices([...selectedDiceIndices, index]);
							}
						}}
						selected={selectedDiceIndices.includes(index)}
					/>
				);
			})}
		</Suspense>
	);
}
