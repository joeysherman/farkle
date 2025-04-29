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
							if (!isCurrentPlayerTurn) return;
							// get the dice that are the same as the current dice
							// if the index is already in the selectedDiceIndices array
							let diceAlreadySelected = false;
							let selectedDiceGroup = [];
							let newSelectedDiceIndices = [...selectedDiceIndices];
							let sameDice = [];

							// check if the index is already in the selectedDiceIndices array
							if (selectedDiceIndices.includes(index)) {
								diceAlreadySelected = true;
							}

							// if the dice is already selected, add the placement to the selectedDiceGroup array
							if (diceAlreadySelected) {
								if (number === 1 || number === 5) {
									// remove the index from the newSelectedDiceIndices array
									newSelectedDiceIndices = newSelectedDiceIndices.filter(
										(placement) => placement !== index
									);
									setSelectedDiceIndices(newSelectedDiceIndices);
								} else {
									// find the currently selected dice from the selectedDiceIndices + 1 array and the diceStates.placement array
									const currentlySelectedDice = diceStates.filter(
										(dice) =>
											selectedDiceIndices.includes(dice.placement - 1) &&
											number === dice.number
									);
									// if the currentlySelectedDice is 3
									if (currentlySelectedDice.length === 3) {
										// for each currentlySelectedDice, remove the placement -1 from the newSelectedDiceIndices array
										for (let i = 0; i < currentlySelectedDice.length; i++) {
											newSelectedDiceIndices = newSelectedDiceIndices.filter(
												(placement) =>
													placement !== currentlySelectedDice[i].placement - 1
											);
										}
										setSelectedDiceIndices(newSelectedDiceIndices);
									} else if (currentlySelectedDice.length > 3) {
										// remove the index from the newSelectedDiceIndices array since we have more than 3
										newSelectedDiceIndices = newSelectedDiceIndices.filter(
											(placement) => placement !== index
										);
										setSelectedDiceIndices(newSelectedDiceIndices);
									}
								}
							} else {
								// if the number is 1 or 5 we can add the dice to the selectedDiceGroup array
								if (number === 1 || number === 5) {
									// add the index to the newSelectedDiceIndices array
									newSelectedDiceIndices.push(index);
									setSelectedDiceIndices(newSelectedDiceIndices);
								} else {
									// find all the dice from the selectedDiceIndices + 1 array and the diceStates.placement array
									const currentlySelectedDice = diceStates.filter(
										(dice) =>
											selectedDiceIndices.includes(dice.placement - 1) &&
											number === dice.number
									);

									// if the currentlySelectedDice is 0
									// find the number of dice from the diceStates.number array that are the same as the number
									if (currentlySelectedDice.length === 0) {
										// find the number of dice from the diceStates.number array that are the same as the number
										const numberOfDice = diceStates.filter(
											(dice) => dice.number === number
										);
										// if the number is 3 or more, add the index to the newSelectedDiceIndices array
										if (numberOfDice.length >= 3) {
											// walk the numberOfDice array and add the placement - 1 to the newSelectedDiceIndices array
											for (let i = 0; i < numberOfDice.length; i++) {
												newSelectedDiceIndices.push(
													numberOfDice[i].placement - 1
												);
											}

											setSelectedDiceIndices(newSelectedDiceIndices);
										}
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
