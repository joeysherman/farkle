import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
// @ts-expect-error - No type definitions available for the Model component
import { Model } from "../_game/modals/DiceModel";

type DiceModelType = typeof Model;

export function BouncingDice(): JSX.Element {
	return (
		<div className="fixed inset-0 pointer-events-none">
			<Canvas
				camera={{
					fov: 45,
					position: [0, 0, 20],
				}}
			>
				<ambientLight intensity={0.5} />
				<directionalLight intensity={1} position={[10, 10, 5]} />
				<Model
					isSpinning
					position={[0, 0, 0]}
					returnSpeed={1}
					rotation={[0, 0, 0]}
					spinRandomness={0.8}
					spinSpeed={2}
				/>
				<OrbitControls
					enablePan={false}
					enableRotate={false}
					enableZoom={false}
				/>
			</Canvas>
		</div>
	);
}
