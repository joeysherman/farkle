import { useGLTF } from "@react-three/drei";

function PokerTableModel(): JSX.Element {
	const { scene } = useGLTF("/models/poker-table.glb");

	// Add shadows to all meshes in the scene
	scene.traverse((child: THREE.Object3D) => {
		if ((child as THREE.Mesh).isMesh) {
			const mesh = child as THREE.Mesh;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
		}
	});

	return (
		<primitive
			castShadow
			object={scene}
			position={[0, -23, 0]}
			receiveShadow
			rotation={[0, 0, 0]}
			scale={[50, 50, 50]}
		/>
	);
}

export function PokerTable(): JSX.Element {
	return <PokerTableModel />;
}

// Preload the model
useGLTF.preload("/models/poker-table.glb");
