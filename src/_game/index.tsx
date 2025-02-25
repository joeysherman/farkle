import {
	Text,
	Billboard,
	OrbitControls,
	PerspectiveCamera,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
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
}: GameSceneProps) => {
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
				<ambientLight intensity={0.5} />
				{/* <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} /> */}
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
				<Selection>
					<EffectComposer multisampling={8} autoClear={false}>
						<Outline
							visibleEdgeColor="red"
							edgeStrength={100}
							edgeGlow={1}
							//edgeThickness={5}
							pulseSpeed={0.5}
							blur={false}
							xRay={false}
							width={1000}
						/>
						{/* <Outline
							patternTexture={null} // a pattern texture
							edgeStrength={2.5} // the edge strength
							pulseSpeed={0.0} // a pulse speed. A value of zero disables the pulse effect
							visibleEdgeColor={0xffffff} // the color of visible edges
							hiddenEdgeColor={0x22090a} // the color of hidden edges
							blur={false} // whether the outline should be blurred
							xRay={false} // indicates whether X-Ray outlines are enabled
						/> */}
					</EffectComposer>
					<DiceScene
						diceStates={diceStates}
						isSpinning={isSpinning}
						selectedDiceIndices={selectedDiceIndices}
						setSelectedDiceIndices={setSelectedDiceIndices}
					/>
				</Selection>
				<PerspectiveCamera
					makeDefault
					position={[-ARENA_SIZE * 0.75, ARENA_SIZE * 0.75, ARENA_SIZE * 0.75]}
					fov={45}
				/>
				<OrbitControls
					enableDamping
					minPolarAngle={0}
					maxPolarAngle={Math.PI / 2 - 0.1}
					dampingFactor={0.05}
					rotateSpeed={0.5}
					enablePan={false}
					enableZoom={true}
					//minDistance={10}
					maxDistance={ARENA_SIZE * 3}
					zoomSpeed={0.5}
				/>
			</Canvas>
		</div>
	);
};
