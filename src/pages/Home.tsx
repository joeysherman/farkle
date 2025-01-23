import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import type { FunctionComponent } from "../common/types";
import { Scene, SceneRef } from "../_game/test";

export const Home = (): FunctionComponent => {
	const { t, i18n } = useTranslation();
	const sceneRef = useRef<SceneRef>(null);
	const [desiredNumber, setDesiredNumber] = useState(6);

	const onTranslateButtonClick = async (): Promise<void> => {
		if (i18n.resolvedLanguage === "en") {
			await i18n.changeLanguage("es");
		} else {
			await i18n.changeLanguage("en");
		}
	};

	const handleRollClick = () => {
		sceneRef.current?.roll(desiredNumber);
	};

	const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseInt(event.target.value);
		if (value >= 1 && value <= 6) {
			setDesiredNumber(value);
		}
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
					value={desiredNumber}
					onChange={handleNumberChange}
					className="w-16 px-3 py-4 text-2xl text-center bg-white rounded-lg shadow-lg"
				/>
				<button 
					onClick={handleRollClick}
					className="px-8 py-4 text-2xl bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
				>
					Roll Dice
				</button>
			</div>
		</div>
	);
};
