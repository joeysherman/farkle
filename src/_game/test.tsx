import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import type { RootState } from "@react-three/fiber";

function Box() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_state: RootState, delta: number) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

export function Scene(): JSX.Element {
  return (
    <div className="h-[400px] w-full">
      <Canvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Box />
      </Canvas>
    </div>
  );
} 