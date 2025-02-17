import { useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import type * as THREE from "three";
import { DICE_URL } from "./constants";
import { useFrame } from "@react-three/fiber";

// Preload the dice model
useGLTF.preload(DICE_URL);

interface DiceProps {
	desiredNumber?: number;
	position?: [number, number, number];
	isSpinning: boolean;
	onDiceClick: (index: number) => void;
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

/**
 * Static Dice component that shows a specific number facing up
 */
export function Dice({
	desiredNumber = 6,
	position = [0, 0, 0],
	isSpinning,
	onDiceClick,
}: DiceProps): JSX.Element {
	const { scene } = useGLTF(DICE_URL);
	const clonedScene = scene.clone(true);

	const meshRef = useRef<THREE.Mesh>(null);
	const [hovered, setHovered] = useState(false);

	const originalRotation = useRef<[number, number, number]>(
		getRotationForNumber(desiredNumber)
	);

	useFrame((_, delta) => {
		if (isSpinning && meshRef.current) {
			const rotationSpeed = 10;
			meshRef.current.rotation.x += delta * rotationSpeed;
			meshRef.current.rotation.y += delta * rotationSpeed;
			meshRef.current.rotation.z += delta * rotationSpeed;
		} else if (!isSpinning && meshRef.current) {
			meshRef.current.rotation.set(...originalRotation.current);
		}
	});

	useFrame(() => {
		if (hovered && meshRef.current) {
			meshRef.current.position.y =
				position[1] + Math.sin(Date.now() * 0.01) * 0.1;
		} else if (meshRef.current) {
			meshRef.current.position.y = position[1];
		}
	});

	return (
		<mesh
			ref={meshRef}
			position={position}
			rotation={originalRotation.current}
			onClick={() => {
				onDiceClick(desiredNumber);
			}}
			onPointerEnter={() => {
				setHovered(true);
			}}
			onPointerLeave={() => {
				setHovered(false);
			}}
		>
			<primitive object={clonedScene} scale={[1, 1, 1]} />
		</mesh>
	);
}
