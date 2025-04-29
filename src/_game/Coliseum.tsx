import { useGLTF } from "@react-three/drei";

function ColiseumModel() {
	const { scene } = useGLTF("/models/coliseum.glb");

	// Add shadows to all meshes in the scene
	scene.traverse((child: any) => {
		if (child.isMesh) {
			child.castShadow = true;
			child.receiveShadow = true;
		}
	});

	return (
		<primitive
			object={scene}
			//scale={[8, 8, 8]} // Scale up to match the boxing ring size
			position={[0, -2, 0]} // Lower it slightly to match the ground
			rotation={[0, Math.PI / 4, 0]} // Rotate 45 degrees for better viewing angle
			castShadow
			receiveShadow
		/>
	);
}

export function Coliseum() {
	return <ColiseumModel />;
}

// Preload the model
useGLTF.preload("/models/coliseum.glb");
