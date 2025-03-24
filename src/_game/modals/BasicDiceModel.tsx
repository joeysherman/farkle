import { useGLTF } from "@react-three/drei";
import { forwardRef } from "react";
import type { Group, Mesh, Material } from "three";

interface BasicDiceProps {
	position?: [number, number, number];
	rotation?: [number, number, number];
}

interface GLTFResult {
	nodes: {
		Cube_1: Mesh;
		Cube_2: Mesh;
		Cube_3: Mesh;
	};
	materials: {
		Dot: Material;
		Dice: Material;
		"Red Dot": Material;
	};
}

export const BasicDiceModel = forwardRef<Group, BasicDiceProps>(
	(props, ref) => {
		// Cast to unknown first to avoid type checking issues with the GLTF loader
		const gltf = useGLTF("/dice-transformed.glb") as unknown;
		const { nodes, materials } = gltf as GLTFResult;
		const { position = [0, 0, 0], rotation = [0, 0, 0] } = props;

		return (
			<group ref={ref} position={position} rotation={rotation}>
				<mesh geometry={nodes.Cube_1.geometry} material={materials.Dot} />
				<mesh geometry={nodes.Cube_2.geometry} material={materials.Dice} />
				<mesh
					geometry={nodes.Cube_3.geometry}
					material={materials["Red Dot"]}
				/>
			</group>
		);
	}
);
