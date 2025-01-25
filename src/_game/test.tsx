import { Canvas } from "@react-three/fiber";
import { useState, useImperativeHandle, forwardRef } from "react";
import { DiceScene } from "./DiceScene";
import { DICE_URL } from "./constants";
import { useGLTF } from "@react-three/drei";

// Preload the dice model
useGLTF.preload(DICE_URL);

export interface SceneRef {
  roll: (index: number, desiredNumber: number) => void;
}

export const Scene = forwardRef<SceneRef>((_, ref) => {
  const [diceStates, setDiceStates] = useState([
    { number: 1 },
    { number: 2 },
    { number: 3 },
    { number: 4 },
    { number: 5 },
    { number: 6 }
  ]);

  // Function to roll a specific die
  const rollDie = (index: number, desiredNumber: number) => {
    setDiceStates(prev => {
      const newStates = [...prev];
      newStates[index] = { number: desiredNumber };
      return newStates;
    });
  };

  // Expose roll function via ref
  useImperativeHandle(ref, () => ({
    roll: rollDie
  }));

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: [0, 5, 10], fov: 50 }}
        style={{ background: '#f3f4f6' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <DiceScene diceStates={diceStates} />
      </Canvas>
    </div>
  );
}); 