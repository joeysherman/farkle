import { useRef } from "react";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ARENA_SIZE } from "./constants";
import { Dice } from "./Dice";

interface DiceState {
  number: number;
}

/**
 * Main scene component that displays all dice
 */
export function DiceScene({ diceStates }: { diceStates: DiceState[] }) {
  const controls = useRef<any>(null);

  // Calculate positions for 2x3 grid layout
  const positions: [number, number, number][] = [
    [-2, 0, -2],  // Top left
    [2, 0, -2],   // Top right
    [-2, 0, 0],   // Middle left
    [2, 0, 0],    // Middle right
    [-2, 0, 2],   // Bottom left
    [2, 0, 2],    // Bottom right
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
        position={[-ARENA_SIZE * 0.5, ARENA_SIZE * 0.75, ARENA_SIZE * 0.75]} 
        fov={50}
      />

      <ambientLight intensity={2} />
      <directionalLight
        position={[-50, 75, -50]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[4096, 4096]}
      />

      {/* Render all dice */}
      {diceStates.map((state, index) => (
        <Dice 
          key={index}
          desiredNumber={state.number}
          position={positions[index]}
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