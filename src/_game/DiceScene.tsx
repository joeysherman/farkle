import { useRef } from "react";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ARENA_SIZE } from "./constants";
import { Dice } from "./Dice";

/**
 * Main scene component that displays a single die
 */
export function DiceScene({ number }: { number: number }) {
  const controls = useRef<any>(null);

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
        position={[-ARENA_SIZE * 0.5, ARENA_SIZE * 0.5, ARENA_SIZE * 0.5]} 
        fov={50}
      />

      <ambientLight intensity={2} />
      <directionalLight
        position={[-50, 75, -50]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[4096, 4096]}
      />

      {/* Single die in the center */}
      <Dice 
        desiredNumber={number}
        position={[0, 0, 0]}
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#e9e464" />
      </mesh>
    </>
  );
}