import { useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DICE_URL } from "./constants";

// Preload the dice model
useGLTF.preload(DICE_URL);

interface DiceProps {
  desiredNumber?: number;
  position?: [number, number, number];
}

/**
 * Get the rotation needed for a specific number to face up
 */
function getRotationForNumber(number: number): [number, number, number] {
  switch (number) {
    case 1:
      return [Math.PI / 2, 0, 0];    // Working - shows 1
    case 2:
      return [-Math.PI / 2, Math.PI, 0];  // New rotation for 2
    case 3:
      return [Math.PI / 2, Math.PI, 0];   // New rotation for 3
    case 4:
      return [Math.PI / 2, 0, Math.PI];   // New rotation for 4
    case 5:
      return [-Math.PI / 2, 0, Math.PI];  // New rotation for 5
    case 6:
      return [-Math.PI / 2, 0, 0];   // Working - shows 6
    default:
      return [-Math.PI / 2, 0, 0];   // Default to 6
  }
}

/**
 * Static Dice component that shows a specific number facing up
 */
export function Dice({ desiredNumber = 6, position = [0, 0, 0] }: DiceProps) {
  const { scene } = useGLTF(DICE_URL);
  const clonedScene = scene.clone(true);

  return (
    <mesh
      position={position}
      rotation={getRotationForNumber(desiredNumber)}
    >
      <primitive object={clonedScene} scale={[1, 1, 1]} />
    </mesh>
  );
} 