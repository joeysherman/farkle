import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Dispatch, SetStateAction, useRef, useState } from "react";
import { BoxingRing } from "./BoxingRing";
import { DiceScene } from "./DiceScene";
import { ARENA_SIZE } from "./constants";

export interface SceneRef {
	roll: (index: number, desiredNumber: number) => void;
	startSpin: () => void;
}

export const GameScene = ({ diceStates, isSpinning }) => {
	const controls = useRef<any>(null);

	return (
		<div className="relative w-full h-full" style={{ minHeight: "300px" }}>
			<Canvas
				shadows
				camera={{ position: [0, 0, 0], fov: 20 }}
				style={{
					background: "#f3f4f6",
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
				}}
			>
				<OrbitControls
					enableDamping
					ref={controls}
					minPolarAngle={0}
					maxPolarAngle={Math.PI / 2 - 0.1}
					dampingFactor={0.05}
					rotateSpeed={0.5}
					enablePan={false}
					enableZoom={true}
					minDistance={15}
					maxDistance={ARENA_SIZE * 3}
					zoomSpeed={0.5}
				/>

				<PerspectiveCamera
					makeDefault
					position={[-ARENA_SIZE * 0.75, ARENA_SIZE * 0.75, ARENA_SIZE * 0.25]}
					fov={45}
				/>
				<ambientLight intensity={1.5} />
				<pointLight position={[10, 10, 10]} />
				<directionalLight
					position={[-50, 100, -50]}
					intensity={2}
					castShadow
					shadow-mapSize={[4096, 4096]}
					shadow-camera-left={-20}
					shadow-camera-right={20}
					shadow-camera-top={20}
					shadow-camera-bottom={-20}
				/>
				<BoxingRing />
				<DiceScene diceStates={diceStates} isSpinning={isSpinning} />
			</Canvas>
		</div>
	);
};
