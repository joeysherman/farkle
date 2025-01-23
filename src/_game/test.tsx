import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, useEffect } from "react";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { useGLTF, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { RigidBody as RigidBodyType } from "@dimforge/rapier3d-compat";

const DICE_URL = "https://dl.dropboxusercontent.com/scl/fi/n0ogooke4kstdcwo7lryy/dice_highres_red.glb?rlkey=i15sotl674m294bporeumu5d3&st=fss6qosg";

// Scene constants
const ARENA_SIZE = 8; // Size of the play area
const WALL_HEIGHT = 20; // Height of invisible walls
const DROP_HEIGHT = 10; // Height from which dice are dropped

// Preload the dice model
useGLTF.preload(DICE_URL);

function Dice({ position, rotation }: { 
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const diceRef = useRef<RigidBodyType>(null);
  const { scene } = useGLTF(DICE_URL);
  
  // Clone the scene for each die instance
  const clonedScene = scene.clone(true);

  return (
    <RigidBody 
      ref={diceRef} 
      colliders="cuboid" 
      position={position}
      rotation={rotation}
      restitution={0.7} 
      friction={0.5}
    >
      <primitive object={clonedScene} scale={[1, 1, 1]} />
    </RigidBody>
  );
}

function Walls() {
  return (
    <>
      {/* Back wall */}
      <RigidBody type="fixed" position={[0, WALL_HEIGHT / 2, -ARENA_SIZE / 2]}>
        <mesh>
          <boxGeometry args={[ARENA_SIZE, WALL_HEIGHT, 0.1]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Front wall */}
      <RigidBody type="fixed" position={[0, WALL_HEIGHT / 2, ARENA_SIZE / 2]}>
        <mesh>
          <boxGeometry args={[ARENA_SIZE, WALL_HEIGHT, 0.1]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Left wall */}
      <RigidBody type="fixed" position={[-ARENA_SIZE / 2, WALL_HEIGHT / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.1, WALL_HEIGHT, ARENA_SIZE]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Right wall */}
      <RigidBody type="fixed" position={[ARENA_SIZE / 2, WALL_HEIGHT / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.1, WALL_HEIGHT, ARENA_SIZE]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
    </>
  );
}

function Ground() {
  return (
    <RigidBody type="fixed" restitution={0.7} friction={0.5}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#e9e464" />
      </mesh>
    </RigidBody>
  );
}

function DiceScene({ dices }: { dices: JSX.Element[] }) {
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
        enableZoom={false}
      />
      <PerspectiveCamera 
        makeDefault 
        position={[-ARENA_SIZE * 1.5, ARENA_SIZE * 2.5, ARENA_SIZE * 1.5]} 
        fov={45}
      />
      <ambientLight intensity={2} />
      <directionalLight
        position={[-30, 50, -30]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-ARENA_SIZE}
        shadow-camera-right={ARENA_SIZE}
        shadow-camera-top={ARENA_SIZE}
        shadow-camera-bottom={-ARENA_SIZE}
      />
      <Physics gravity={[0, -29.4, 0]}>
        <Ground />
        <Walls />
        {dices}
      </Physics>
    </>
  );
}

export function Scene(): JSX.Element {
  // Fixed to 1 die
  const [diceCount] = useState(1);

  const rollDice = () => {
    const dices: JSX.Element[] = [];
    
    // For a single die, position it in the center
    const x = 0;
    const y = DROP_HEIGHT;
    const z = 0;
    
    // Rotation for 6 facing up (rotate 180 degrees around X axis)
    const rotation = [
      Math.PI, // 180 degrees around X axis
      0,       // no rotation around Y
      0        // no rotation around Z
    ] as [number, number, number];
    
    dices.push(
      <Dice 
        key={0} 
        position={[x, y, z]} 
        rotation={rotation}
      />
    );
    
    return dices;
  };

  const [dices, setDices] = useState<JSX.Element[]>(() => rollDice());

  // Remove the useEffect since diceCount never changes
  
  return (
    <div className="relative w-full h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full z-10">
        <nav className="flex justify-between w-full pointer-events-none">
          <h1 className="p-3 text-4xl leading-tight text-[#3c390f]">DICE<br/>3D</h1>
          <h5 className="p-3 text-[#3c390f] opacity-75 pointer-events-auto">
            <a href="https://github.com/fuzionix" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </h5>
        </nav>
      </div>

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 w-full z-10">
        <section className="flex justify-center w-full pointer-events-none">
          <div className="flex gap-6">
            <button 
              className="p-2 mb-8 text-6xl text-[#3c390f] opacity-75 hover:opacity-100 transition-opacity duration-250 pointer-events-auto"
              onClick={() => setDices(rollDice())}
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
} 