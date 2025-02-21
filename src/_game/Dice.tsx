import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { Model as DiceModel } from "./modals/DiceModel";

interface DiceProps {
	desiredNumber?: number;
	position?: [number, number, number];
	isSpinning: boolean;
	onDiceClick: (index: number) => void;
	isScoring?: boolean;
	index: number;
}

/**
 * Get the rotation needed for a specific number to face up
 */
function getRotationForNumber(number: number): [number, number, number] {
	switch (number) {
		case 1:
			return [Math.PI / 2, 0, 0]; // Working - shows 1
		case 2:
			return [Math.PI / 2, -Math.PI / 2, -Math.PI / 2];
		case 3:
			return [0, 0, -Math.PI / 2]; // Working - shows 3
		case 4:
			return [0, 0, Math.PI / 2]; // Working - shows 4
		case 5:
			return [0, Math.PI / 2, 0]; // Working - shows 5
		case 6:
			return [-Math.PI / 2, 0, 0]; // Working - shows 6
		default:
			return [0, 0, 0];
	}
}

function getPositionByPlacement(placement: number): [number, number, number] {
	switch (placement) {
		case 1:
			return [-4, 0, -4];
		case 2:
			return [4, 0, -4];
		case 3:
			return [-4, 0, 0];
		case 4:
			return [4, 0, 0];
		case 5:
			return [-4, 0, 4];
		case 6:
			return [4, 0, 4];
		default:
			return [0, 0, 0];
	}
}

/**
 * Static Dice component that shows a specific number facing up
 */
export function Dice({
	placement,
	value,
	isScoringNumber,
}: DiceProps): JSX.Element {
	const originalPosition = getPositionByPlacement(placement);
	const originalRotation = getRotationForNumber(value);

	if (isScoringNumber) {
	}
	return (
		<DiceModel
			position={originalPosition}
			rotation={originalRotation}
			placement={placement}
			value={value}
			isScoringNumber={isScoringNumber}
		/>
	);
}
