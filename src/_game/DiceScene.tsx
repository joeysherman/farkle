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
export function DiceScene({ diceStates, isSpinning }: DiceSceneProps) {
	return (
		<Suspense fallback={null}>
			{diceStates.map((diceState, index) => {
				const { placement, number, isScoringNumber } = diceState;
				return (
					<Dice
						key={index}
						placement={placement}
						value={number}
						isSpinning={isSpinning}
						isScoringNumber={isScoringNumber || false}
					/>
				);
			})}
		</Suspense>
	);
}
