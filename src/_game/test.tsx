import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, useEffect } from "react";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { useGLTF, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { RigidBody as RigidBodyType } from "@dimforge/rapier3d-compat";

const DICE_URL = "https://dl.dropboxusercontent.com/scl/fi/n0ogooke4kstdcwo7lryy/dice_highres_red.glb?rlkey=i15sotl674m294bporeumu5d3&st=fss6qosg";

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

function Ground() {
  return (
    <RigidBody type="fixed" restitution={0.7} friction={0.5}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
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
      <PerspectiveCamera makeDefault position={[-12, 22, 12]} />
      <ambientLight intensity={2} />
      <directionalLight
        position={[-30, 50, -30]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <Physics gravity={[0, -29.4, 0]}>
        <Ground />
        {dices}
      </Physics>
    </>
  );
}

export function Scene(): JSX.Element {
  const [diceCount, setDiceCount] = useState(6);

  const rollDice = () => {
    const dices: JSX.Element[] = [];
    for (let i = 0; i < diceCount; i++) {
      const x = Math.random() * 4 - 2;
      const y = 15;
      const z = Math.random() * 4 - 2;
      const rotation = [
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      ] as [number, number, number];
      
      dices.push(
        <Dice 
          key={i} 
          position={[x, y, z]} 
          rotation={rotation}
        />
      );
    }
    return dices;
  };

  const [dices, setDices] = useState<JSX.Element[]>(() => rollDice());

  useEffect(() => {
    setDices(rollDice());
  }, [diceCount]);

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
              onClick={() => setDiceCount(Math.max(diceCount - 1, 1))}
            >
              -
            </button>
            <div>
              <p className="mb-[-0.5rem] text-center text-[#3c390f] opacity-50">
                AMOUNT: <span>{diceCount}</span>
              </p>
              <button 
                className="p-2 mb-8 text-6xl text-[#3c390f] opacity-75 hover:opacity-100 transition-opacity duration-250 pointer-events-auto"
                onClick={() => setDices(rollDice())}
              >
                ROLL
              </button>
            </div>
            <button 
              className="p-2 mb-8 text-6xl text-[#3c390f] opacity-75 hover:opacity-100 transition-opacity duration-250 pointer-events-auto"
              onClick={() => setDiceCount(Math.min(diceCount + 1, 12))}
            >
              +
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