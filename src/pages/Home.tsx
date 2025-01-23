import { useRef, useState } from "react";
import type { FunctionComponent } from "../common/types";
import { Scene, SceneRef } from "../_game/test";

export const Home = (): FunctionComponent => {
	const sceneRef = useRef<SceneRef>(null);
	const [diceValue, setDiceValue] = useState(6);  // Default to 6

	const handleNumberChange = (value: string) => {
		const numValue = parseInt(value);
		if (numValue >= 1 && numValue <= 6) {
			setDiceValue(numValue);
		}
	};

	const handleRollClick = () => {
		sceneRef.current?.roll(diceValue);
	};

	return (
		<div className="bg-blue-300 font-bold w-screen h-screen flex flex-col justify-center items-center">
			<div className="w-full max-w-2xl mt-8 aspect-square">
				<Scene ref={sceneRef} />
			</div>
			<div className="flex items-center gap-4 mt-4">
				<input
					type="number"
					min="1"
					max="6"
					value={diceValue}
					onChange={(e) => handleNumberChange(e.target.value)}
					className="w-16 px-3 py-2 text-xl text-center bg-white rounded-lg shadow-lg"
				/>
				<button 
					onClick={handleRollClick}
					className="px-4 py-2 text-xl bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
				>
					Roll
				</button>
			</div>
		</div>
	);
};
