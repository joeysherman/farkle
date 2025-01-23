import { Canvas } from "@react-three/fiber";
import { useState, useImperativeHandle, forwardRef } from "react";
import { DiceScene } from "./DiceScene";
import { Dice } from "./Dice";
import { DICE_URL } from "./constants";
import { useGLTF } from "@react-three/drei";

// Preload the dice model
useGLTF.preload(DICE_URL);

export interface SceneRef {
  roll: () => void;
}

export const Scene = forwardRef<SceneRef>((_, ref) => {
  const [dices, setDices] = useState<JSX.Element[]>(() => [<Dice key={Date.now()} />]);

  const rollDice = () => {
    setDices([<Dice key={Date.now()} />]); // New key forces remount
  };

  // Expose roll function via ref
  useImperativeHandle(ref, () => ({
    roll: rollDice
  }));

  return (
    <div className="relative w-full h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 w-full z-10">
        <section className="flex justify-center w-full pointer-events-none">
          <div className="flex gap-6">
            <button 
              className="p-2 mb-8 text-6xl text-[#3c390f] opacity-75 hover:opacity-100 transition-opacity duration-250 pointer-events-auto"
              onClick={rollDice}
            >
              ROLL
            </button>
          </div>
        </section>
      </div>

      {/* Three.js Canvas */}
      <Canvas shadows className="w-full h-full">
        <DiceScene dices={dices} />
      </Canvas>
    </div>
  );
}); 