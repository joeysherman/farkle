import {
	Text,
	Billboard,
	OrbitControls,
	CameraControls,
	PerspectiveCamera,
	OrthographicCamera,
	Stats,
	GizmoHelper,
	GizmoViewport,
	Grid,
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
import { DebugPanel, CameraDebug } from "./DebugPanel";

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
		<div className="absolute bottom-0 w-full h-3/4 md:h-full">
			<DebugPanel
				orbitControlsRef={orbitControlsRef}
				onAutoRotateChange={(value) => {
					if (orbitControlsRef.current) {
						orbitControlsRef.current.autoRotate = value;
					}
				}}
				onAutoRotateSpeedChange={(value) => {
					if (orbitControlsRef.current) {
						orbitControlsRef.current.autoRotateSpeed = value;
					}
				}}
			/>
			<Canvas

			// shadows
			// camera={{
			// 	position: [-ARENA_SIZE * 0.4, ARENA_SIZE * 1.2, ARENA_SIZE * 1.4],
			// 	fov: 30,
			// }}

			// style={{
			// 	background: "#f3f4f6",
			// 	position: "absolute",

			// 	right: 0,
			// 	bottom: 0,
			// 	left: 0,
			// 	width: "100%",
			// 	height: "100%",
			// }}
			>
				<CameraDebug orbitControlsRef={orbitControlsRef} />
				<Stats
					className="stats"
					showPanel={0} // 0: fps, 1: ms, 2: mb, 3+: custom
					position={{ top: "60px", right: "0px" }}
				/>
				<Grid
					args={[30, 30]}
					position={[0, -0.01, 0]}
					cellSize={1}
					cellThickness={0.5}
					cellColor="#6f6f6f"
					sectionSize={3}
					sectionThickness={1.5}
					sectionColor="#9d4b4b"
					fadeDistance={30}
					fadeStrength={1}
					followCamera={false}
					infiniteGrid
				/>
				{/* <PerspectiveCamera
					makeDefault
					position={[-ARENA_SIZE * 3.5, ARENA_SIZE * 3.5, ARENA_SIZE * 1]}
					fov={30}
					//aspect={window.innerWidth / window.innerHeight}
					//aspect={0.5}
					zoom={0.5}
				/> */}
				<PerspectiveCamera
					makeDefault
					position={[-14.58, 27.71, 6.6]}
					rotation={[-1.34, -0.47, -1.09]}
					fov={45}
				/>
				<ambientLight intensity={0.5} />
				<pointLight position={[-50, 100, -50]} />
				<directionalLight
					position={[-50, 100, -50]}
					intensity={2}
					castShadow
					//shadow-mapSize={[4096, 4096]}
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
					autoRotate
					autoRotateSpeed={0.5}
					enableDamping
					dampingFactor={0.05}
					enablePan
					enableZoom
					minPolarAngle={Math.PI / 6}
					maxPolarAngle={Math.PI / 2 - 0.1}
					// Convert zoom values to distances (inverse relationship)
					// Lower zoom (9) = Further distance
					// Higher zoom (20.89) = Closer distance
					maxDistance={ARENA_SIZE * (20.89 / 9)} // For min zoom of 9
					minDistance={ARENA_SIZE * (9 / 20.89)} // For max zoom of 20.89
					rotateSpeed={0.5}
					zoomSpeed={0.75}
					target={[0, 0, 0]}
				/>
				<GizmoHelper alignment="bottom-right" margin={[80, 80]}>
					<GizmoViewport
						axisColors={["red", "green", "blue"]}
						labelColor="black"
					/>
				</GizmoHelper>
			</Canvas>
		</div>
	);
};
