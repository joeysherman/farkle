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
	setIsSpinning,
}: DiceSceneProps) {
	return (
		<Suspense fallback={null}>
			{diceStates.map((diceState, index) => {
				return (
					<Dice
						key={index}
						placement={index + 1}
						value={diceState.number}
						isScoringNumber={diceState?.isScoringNumber || false}
					/>
				);
			})}
		</Suspense>
	);
}
