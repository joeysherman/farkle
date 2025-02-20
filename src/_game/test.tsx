import { Canvas } from "@react-three/fiber";
import {
	useState,
	useImperativeHandle,
	forwardRef,
	Dispatch,
	SetStateAction,
} from "react";
import { DiceScene } from "./DiceScene";
import { DICE_URL } from "./constants";
import { useGLTF } from "@react-three/drei";

// Preload the dice model
useGLTF.preload(DICE_URL);

export interface SceneRef {
	roll: (index: number, desiredNumber: number) => void;
	startSpin: () => void;
}

export const Scene = forwardRef<SceneRef>(({ diceStates }, ref) => {
	// const [diceStates, setDiceStates] = useState([
	// 	{ number: 6 },
	// 	{ number: 2 },
	// 	{ number: 3 },
	// 	{ number: 4 },
	// 	{ number: 5 },
	// 	{ number: 6 },
	// ]);

	const [isSpinning, setIsSpinning] = useState(false);

	// Function to roll a specific die
	const rollDie = (index: number, desiredNumber: number) => {
		setDiceStates((prev) => {
			const newStates = [...prev];
			newStates[index] = { number: desiredNumber };
			return newStates;
		});
	};

	// Function to start dice spin
	const startSpin = (): void => {
		setIsSpinning(true);
		setTimeout(() => {
			setIsSpinning(false);
		}, 2000);
	};

	return (
		<>
			<button onClick={startSpin}>Spin Dice</button>
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
					<pointLight position={[10, 10, 10]} />
					<DiceScene
						diceStates={diceStates}
						isSpinning={isSpinning}
						setIsSpinning={setIsSpinning as Dispatch<SetStateAction<boolean>>}
					/>
				</Canvas>
			</div>
		</>
	);
});
