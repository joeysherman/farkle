import { useRef, Dispatch, SetStateAction } from "react";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ARENA_SIZE } from "./constants";
import { Dice } from "./Dice";
import { BoxingRing } from "./BoxingRing";

interface DiceState {
	number: number;
}

interface DiceSceneProps {
	diceStates: DiceState[];
	isSpinning: boolean;
	setIsSpinning: Dispatch<SetStateAction<boolean>>;
}

/**
 * Main scene component that displays all dice
 */
export function DiceScene({
	diceStates,
	isSpinning,
	setIsSpinning,
}: DiceSceneProps) {
	const controls = useRef<any>(null);

	// Calculate positions for 2x3 grid layout - adjusted for larger ring
	const positions: [number, number, number][] = [
		[-4, 0, -4], // Top left
		[4, 0, -4], // Top right
		[-4, 0, 0], // Middle left
		[4, 0, 0], // Middle right
		[-4, 0, 4], // Bottom left
		[4, 0, 4], // Bottom right
	];

	return (
		<>
			<OrbitControls
				ref={controls}
				minPolarAngle={0}
				maxPolarAngle={Math.PI / 2 - 0.1}
				enableDamping
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

			{/* Improved lighting for better shadows */}
			<ambientLight intensity={1.5} />
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

			{/* Add boxing ring */}
			<BoxingRing />

			{/* Render all dice with adjusted scale */}
			{diceStates.map((state, index) => (
				<Dice
					key={index}
					desiredNumber={state.number}
					position={positions[index]}
					isSpinning={isSpinning}
					setIsSpinning={setIsSpinning}
				/>
			))}

			{/* Ground plane - commented out since boxing ring has its own floor */}
			{/* <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#e9e464" />
      </mesh> */}
		</>
	);
}
