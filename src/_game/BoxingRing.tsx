import { useGLTF } from "@react-three/drei";
import { Suspense } from "react";
import boxingRingModel from "./modals/boxing_ring.glb";

// Preload the model
useGLTF.preload(boxingRingModel);

function BoxingRingModel() {
  const { scene } = useGLTF(boxingRingModel);

  return (
    <primitive 
      object={scene} 
      scale={[2, 2, 2]} 
      position={[0, -1, 0]}
      rotation={[0, Math.PI / 4, 0]} // 45 degrees rotation
    />
  );
}

export function BoxingRing() {
  return (
    <Suspense fallback={null}>
      <BoxingRingModel />
    </Suspense>
  );
} 
