import {
	Text,
	Billboard,
	OrbitControls,
	CameraControls,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
	EffectComposer,
	Outline,
	Select,
	Selection,
} from "@react-three/postprocessing";
import { useRef, useState } from "react";
import { BoxingRing } from "./BoxingRing";
import { ARENA_SIZE } from "./constants";
import { Model as DiceModel } from "./modals/DiceModel";
import { DiceScene } from "./DiceScene";

function Box(props) {
	const ref = useRef();
	const [hovered, hover] = useState(null);
	console.log(hovered);
	useFrame(
		(state, delta) => (ref.current.rotation.x = ref.current.rotation.y += delta)
	);
	return (
		<Select enabled={hovered}>
			<mesh
				ref={ref}
				{...props}
				onPointerOver={(e) => {
					e.stopPropagation();
					hover(true);
				}}
				onPointerOut={(e) => {
					e.stopPropagation();
					hover(false);
				}}
			>
				<boxGeometry />
				{/* <meshStandardMaterial color="orange" /> */}
				<meshBasicMaterial color="orange" />
			</mesh>
		</Select>
	);
}

export const GameScene = ({
	diceStates,
	isSpinning,
	selectedDiceIndices,
	setSelectedDiceIndices,
	isCurrentPlayerTurn,
}: GameSceneProps) => {
	const cameraControlsRef = useRef();
	const orbitControlsRef = useRef();

	return (
		<div className="relative w-full h-full" style={{ minHeight: "500px" }}>
			<Canvas
				shadows
				camera={{
					position: [-ARENA_SIZE * 0.4, ARENA_SIZE * 1.2, ARENA_SIZE * 1.4],
					fov: 30,
				}}
				style={{
					background: "#f3f4f6",
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
				}}
			>
				<ambientLight intensity={0.5} />
				<pointLight position={[-50, 100, -50]} />
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
				<Selection enabled={!isSpinning} autoClear={true}>
					<EffectComposer multisampling={8} autoClear={false}>
						{isCurrentPlayerTurn && (
							<Outline
								visibleEdgeColor="red"
								edgeStrength={100}
								edgeGlow={1}
								pulseSpeed={0.5}
								blur={false}
								xRay={false}
								width={1000}
							/>
						)}
					</EffectComposer>
					<DiceScene
						isCurrentPlayerTurn={isCurrentPlayerTurn}
						diceStates={diceStates}
						isSpinning={isSpinning}
						selectedDiceIndices={selectedDiceIndices}
						setSelectedDiceIndices={setSelectedDiceIndices}
					/>
				</Selection>
				<OrbitControls
					ref={orbitControlsRef}
					enableDamping
					dampingFactor={0.05}
					enablePan
					enableZoom
					minPolarAngle={Math.PI / 6}
					maxPolarAngle={Math.PI / 2 - 0.1}
					minDistance={ARENA_SIZE * 1}
					maxDistance={ARENA_SIZE * 3}
					rotateSpeed={0.5}
					zoomSpeed={0.75}
					target={[0, 0, 0]}
				/>
			</Canvas>
		</div>
	);
};
