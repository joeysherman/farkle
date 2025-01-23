import { useRef } from "react";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Ground } from "./Ground";
import { Walls } from "./Walls";
import { ARENA_SIZE } from "./constants";

/**
 * Main scene component that sets up the 3D environment for the dice
 * Includes camera controls, lighting, and physics world
 */
export function DiceScene({ dices }: { dices: JSX.Element[] }) {
  const controls = useRef<any>(null);

  return (
    <>
      {/* Camera Controls */}
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
      
      {/* Main Camera */}
      <PerspectiveCamera 
        makeDefault 
        position={[-ARENA_SIZE * 1.1, ARENA_SIZE * 1.6, ARENA_SIZE * 1.1]} 
        fov={50}
      />

      {/* Scene Lighting */}
      <ambientLight intensity={2} />
      <directionalLight
        position={[-50, 75, -50]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-ARENA_SIZE}
        shadow-camera-right={ARENA_SIZE}
        shadow-camera-top={ARENA_SIZE}
        shadow-camera-bottom={-ARENA_SIZE}
      />

      {/* Physics World */}
      <Physics 
        gravity={[0, -29.4, 0]}
        timeStep="vary"
      >
        <Ground />
        <Walls />
        {dices}
      </Physics>
    </>
  );
}