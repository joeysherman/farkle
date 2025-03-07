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
			scale={[10, 10, 10]} // Increased scale significantly
			position={[0, 0, 0]} // Lowered position to act as a table
			rotation={[0, Math.PI / 4, 0]} // 45 degrees rotation
			castShadow
			receiveShadow
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
