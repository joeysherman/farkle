import { useGLTF } from "@react-three/drei";
import { Suspense } from "react";

// Preload the model
useGLTF.preload("/models/boxing_ring.glb");

function BoxingRingModel() {
	const { scene } = useGLTF("/models/boxing_ring.glb");

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
