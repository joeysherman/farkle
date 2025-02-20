import { useRef, useState, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DICE_URL } from "./constants";
import { useFrame } from "@react-three/fiber";

// Preload the dice model
useGLTF.preload(DICE_URL);

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

/**
 * Static Dice component that shows a specific number facing up
 */
export function Dice({
	desiredNumber = 6,
	position = [0, 0, 0],
	isSpinning,
	onDiceClick,
	isScoring = false,
	index,
}: DiceProps): JSX.Element {
	const { scene } = useGLTF(DICE_URL);
	const clonedScene = scene.clone(true);

	const originalMaterials = useRef(
		new Map<string, THREE.MeshStandardMaterial>()
	);

	const meshRef = useRef<THREE.Mesh>(null);
	const [hovered, setHovered] = useState(false);

	const originalRotation = useRef<[number, number, number]>(
		getRotationForNumber(desiredNumber)
	);

	// Apply green tint to scoring dice
	useEffect(() => {
		clonedScene.traverse((child) => {
			if (
				child instanceof THREE.Mesh &&
				child.material instanceof THREE.MeshStandardMaterial
			) {
				const meshId = child.uuid;
				// Store original material if not already stored
				if (!originalMaterials.current.has(meshId)) {
					originalMaterials.current.set(meshId, child.material.clone());
				}

				if (isScoring && child.material.name === "Dice") {
					child.material.color = new THREE.Color(0xb8ffc9);
					child.material.emissive = new THREE.Color(0x00ff00);
					child.material.emissiveIntensity = 0.5;
				} else {
					// Restore original material
					const originalMaterial = originalMaterials.current.get(meshId);
					if (originalMaterial) {
						child.material = originalMaterial.clone();
					}
				}
			}
		});

		return (): void => {
			clonedScene.traverse((child) => {
				if (
					child instanceof THREE.Mesh &&
					child.material instanceof THREE.MeshStandardMaterial
				) {
					const originalMaterial = originalMaterials.current.get(child.uuid);
					if (originalMaterial) {
						child.material = originalMaterial.clone();
					}
				}
			});
		};
	}, [isScoring, clonedScene]);

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
