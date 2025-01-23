import { useRef } from "react";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ARENA_SIZE } from "./constants";
import { Dice } from "./Dice";

/**
 * Main scene component that displays 6 dice in a row
 */
export function DiceScene({ diceStates }: { diceStates: { number: number }[] }) {
  const controls = useRef<any>(null);

  // Calculate positions for 6 dice in a row with more spacing
  const dicePositions: [number, number, number][] = [
    [-10, 0, -5],
    [-10, 0, 5],
    [0, 0, -5],
    [0, 0, 5],
    [10, 0, -5],
    [10, 0, 5]
  ];

  return (
    <>
      <OrbitControls 
        ref={controls}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2 - 0.1}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        enablePan={false}
        enableZoom={true}
        minDistance={10}
        maxDistance={ARENA_SIZE * 2}
        zoomSpeed={0.5}
      />
      
      <PerspectiveCamera 
        makeDefault 
        position={[-ARENA_SIZE * 0.8, ARENA_SIZE * 0.8, ARENA_SIZE * 0.8]} 
        fov={50}
      />

      <ambientLight intensity={2} />
      <directionalLight
        position={[-50, 75, -50]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[4096, 4096]}
      />

      {/* Render 6 dice with their current numbers */}
      {diceStates.map((state, index) => (
        <Dice 
          key={index}
          desiredNumber={state.number}
          position={dicePositions[index]}
        />
      ))}

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#e9e464" />
      </mesh>
    </>
  );
}