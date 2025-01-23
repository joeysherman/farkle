import { useTranslation } from "react-i18next";
import { useRef } from "react";
import type { FunctionComponent } from "../common/types";
import { Scene, SceneRef } from "../_game/test";

export const Home = (): FunctionComponent => {
	const { t, i18n } = useTranslation();
	const sceneRef = useRef<SceneRef>(null);

	const onTranslateButtonClick = async (): Promise<void> => {
		if (i18n.resolvedLanguage === "en") {
			await i18n.changeLanguage("es");
		} else {
			await i18n.changeLanguage("en");
		}
	};

	const handleRollClick = () => {
		sceneRef.current?.roll();
	};

	return (
		<div className="bg-blue-300 font-bold w-screen h-screen flex flex-col justify-center items-center">
			<p className="text-white text-6xl">{t("home.greeting")}</p>
			<button type="submit" onClick={onTranslateButtonClick}>
				translate
			</button>
			<div className="w-full max-w-2xl mt-8 aspect-square">
				<Scene ref={sceneRef} />
			</div>
			<button 
				onClick={handleRollClick}
				className="mt-4 px-8 py-4 text-2xl bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
			>
				Roll Dice
			</button>
		</div>
	);
};
