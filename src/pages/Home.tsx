import { useRef, useState } from "react";
import type { FunctionComponent } from "../common/types";
import { Scene, SceneRef } from "../_game/test";

export const Home = (): FunctionComponent => {
	const sceneRef = useRef<SceneRef>(null);
	const [diceValues, setDiceValues] = useState([1, 2, 3, 4, 5, 6]);

	const handleNumberChange = (index: number, value: string) => {
		const numValue = parseInt(value);
		if (numValue >= 1 && numValue <= 6) {
			setDiceValues(prev => {
				const newValues = [...prev];
				newValues[index] = numValue;
				return newValues;
			});
		}
	};

	const handleRollClick = (index: number) => {
		const value = diceValues[index];
		if (value !== undefined) {
			sceneRef.current?.roll(index, value);
		}
	};

	return (
		<div className="bg-blue-300 font-bold w-screen h-screen flex flex-col justify-center items-center">
			<div className="w-full max-w-4xl mt-8 aspect-square">
				<Scene ref={sceneRef} />
			</div>
			<div className="flex flex-wrap justify-center gap-4 mt-4 max-w-4xl">
				{diceValues.map((value, index) => (
					<div key={index} className="flex items-center gap-2">
						<div className="text-white text-lg">Die {index + 1}:</div>
						<input
							type="number"
							min="1"
							max="6"
							value={value}
							onChange={(e) => handleNumberChange(index, e.target.value)}
							className="w-16 px-3 py-2 text-xl text-center bg-white rounded-lg shadow-lg"
						/>
						<button 
							onClick={() => handleRollClick(index)}
							className="px-4 py-2 text-xl bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
						>
							Roll
						</button>
					</div>
				))}
			</div>
		</div>
	);
};
