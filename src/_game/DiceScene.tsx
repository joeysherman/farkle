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
	isCurrentPlayerTurn,
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
							let sameDicePlacementsArray = [];
							// get the dice that are the same as the current dice
							// if the index is already in the selectedDiceIndices array
							let indexAlreadyInSelectedDiceIndices = false;
							let sameDice = false;
							let newSelectedDiceIndices = [];

							for (const selectedDiceIndex of selectedDiceIndices) {
								if (selectedDiceIndex === index) {
									indexAlreadyInSelectedDiceIndices = true;
								}
							}

							if (indexAlreadyInSelectedDiceIndices) {
								// if the number is 1 or 5 we can remove that dice from the selectedDiceIndices array
								if (number === 1 || number === 5) {
									// remove the current index from the selectedDiceIndices array
									newSelectedDiceIndices = selectedDiceIndices.filter(
										(i) => i !== index
									);
									setSelectedDiceIndices(newSelectedDiceIndices);
								} else {
									// find the same dice in the diceStates array
									const sameDice = diceStates.filter(
										(dice) => dice.number === number
									);
									// add the placement of the same dice to the sameDicePlacementsArray
									for (const dice of sameDice) {
										sameDicePlacementsArray.push(dice.placement - 1);
									}
									// remove the values from selectedDiceIndices that are in sameDicePlacementsArray
									newSelectedDiceIndices = selectedDiceIndices.filter(
										(i) => !sameDicePlacementsArray.includes(i)
									);

									setSelectedDiceIndices(newSelectedDiceIndices);
								}
							} else {
								// if the number is 1 or 5 we can add that dice to the selectedDiceIndices array
								if (number === 1 || number === 5) {
									newSelectedDiceIndices = [...selectedDiceIndices, index];
									setSelectedDiceIndices(newSelectedDiceIndices);
								} else {
									// get the dice that are at the selectedDiceIndices array + 1
									const diceAtSelectedDiceIndicesPlusOne = diceStates.filter(
										(dice) => selectedDiceIndices.includes(dice.placement - 1)
									);
									// if the length is greater or equal to 3, add this dice to the selectedDiceIndices array
									if (diceAtSelectedDiceIndicesPlusOne.length >= 3) {
										newSelectedDiceIndices = [...selectedDiceIndices, index];
										setSelectedDiceIndices(newSelectedDiceIndices);
									}
								}
							}
						}}
						selected={selectedDiceIndices.includes(index)}
					/>
				);
			})}
		</Suspense>
	);
}
