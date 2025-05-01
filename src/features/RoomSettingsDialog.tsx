import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { supabase } from "../lib/supabaseClient";
import { BoxingRing } from "../_game/BoxingRing";
import { Coliseum } from "../_game/Coliseum";
import { PokerTable } from "../_game/PokerTable";
import { PerspectiveCamera } from "@react-three/drei";

interface RoomSettingsDialogProps {
	roomId: string;
	onClose: () => void;
	currentStep: number;
}

const cameraPresets = {
	boxing_ring: {
		position: [0, 6, 0],
		scale: [1, 1, 1],
		cameraPosition: [0, 15, 30],
		fov: 20,
		minDistance: 120,
		maxDistance: 120,
	},
	coliseum: {
		position: [0, -3, 0],
		scale: [1, 1, 1],
		cameraPosition: [0, -3, 0],
		fov: 20,
		minDistance: 120,
		maxDistance: 120,
	},
	poker_table: {
		position: [0, 10, 0],
		scale: [1, 1, 1],
		//cameraPosition: [0, 15, 30],
		cameraPosition: [0, 0, 0],
		fov: 20,
		minDistance: 140,
		maxDistance: 140,
	},
};

function ModelPreview({
	model,
}: {
	model: "boxing_ring" | "coliseum" | "poker_table";
}): JSX.Element {
	return (
		<Canvas>
			<PerspectiveCamera
				makeDefault
				fov={cameraPresets[model].fov}
				//position={cameraPresets[model].cameraPosition}
				//scale={cameraPresets[model].scale}
			/>
			<ambientLight intensity={0.5} />
			<pointLight position={[-50, 100, -50]} />
			<directionalLight
				castShadow
				intensity={2}
				position={[-50, 100, -50]}
				shadow-camera-bottom={-20}
				shadow-camera-left={-20}
				shadow-camera-right={20}
				shadow-camera-top={20}
			/>
			{model === "boxing_ring" ? (
				<group
					position={cameraPresets[model].position}
					scale={cameraPresets[model].scale}
				>
					<BoxingRing />
				</group>
			) : model === "coliseum" ? (
				<group
					position={cameraPresets[model].position}
					scale={cameraPresets[model].scale}
				>
					<Coliseum />
				</group>
			) : (
				<group
					position={cameraPresets[model].position}
					//scale={cameraPresets[model].scale}
				>
					<PokerTable />
				</group>
			)}
			<OrbitControls
				autoRotate
				autoRotateSpeed={1}
				enablePan={false}
				enableZoom={false}
				maxPolarAngle={Math.PI / 2.5}
				minPolarAngle={Math.PI / 3}
				maxDistance={cameraPresets[model].maxDistance}
				minDistance={cameraPresets[model].minDistance}
			/>
		</Canvas>
	);
}

export function RoomSettingsDialog({
	roomId,
	onClose,
	currentStep,
}: RoomSettingsDialogProps): JSX.Element {
	const [selectedModel, setSelectedModel] = useState<
		"boxing_ring" | "coliseum" | "poker_table"
	>("boxing_ring");
	const [isSaving, setIsSaving] = useState(false);
	debugger;
	const handleSave = async (): Promise<void> => {
		try {
			setIsSaving(true);
			console.log("Attempting to update room:", roomId);
			const { data, error } = await supabase.rpc("update_room_settings", {
				p_room_id: roomId,
				p_value: selectedModel,
			});

			if (error) {
				console.error("Supabase error:", error);
				throw error;
			}

			console.log("Update successful:", data);
			// only close if the step is 3
			if (currentStep === 3) {
				onClose();
			}
		} catch (error) {
			console.error("Error saving room settings:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleModelSelect = (
		model: "boxing_ring" | "coliseum" | "poker_table"
	): void => {
		setSelectedModel(model);
	};

	const renderStep = (): JSX.Element => {
		switch (currentStep) {
			case 1:
				return (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{[
							{
								id: "boxing_ring",
								title: "Boxing Ring",
								description: "A classic boxing ring setting",
							},
							{
								id: "coliseum",
								title: "Coliseum",
								description: "An epic Roman coliseum arena",
							},
							{
								id: "poker_table",
								title: "Poker Table",
								description: "A classic casino poker table",
							},
						].map((option) => (
							<button
								key={option.id}
								className={`group p-4 rounded-lg border-2 transition-all active:scale-95 ${
									selectedModel === option.id
										? "border-indigo-500 bg-indigo-50"
										: "border-gray-200 hover:border-indigo-200"
								}`}
								onClick={(): void => {
									handleModelSelect(
										option.id as "boxing_ring" | "coliseum" | "poker_table"
									);
								}}
							>
								<div className="aspect-[4/3] bg-gray-100 rounded-lg mb-3 overflow-hidden shadow-sm group-hover:shadow transition-shadow">
									<ModelPreview
										model={
											option.id as "boxing_ring" | "coliseum" | "poker_table"
										}
									/>
								</div>
								<p className="text-base font-medium text-gray-900">
									{option.title}
								</p>
								<p className="text-sm text-gray-500 mt-1">
									{option.description}
								</p>
							</button>
						))}
					</div>
				);
			case 2:
				return (
					<div className="p-4 text-center text-gray-500">
						Step 2 content will go here
					</div>
				);
			case 3:
				return (
					<div className="p-4 text-center text-gray-500">
						Step 3 content will go here
					</div>
				);
			default:
				return null;
		}
	};

	const getStepTitle = (): string => {
		switch (currentStep) {
			case 1:
				return "Select game table";
			case 2:
				return "Step 2 title";
			case 3:
				return "Step 3 title";
			default:
				return "";
		}
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 md:p-6">
			<div className="bg-white rounded-lg w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl overflow-y-auto flex flex-col">
				<div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 md:px-6 z-10">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-xl md:text-2xl font-bold text-gray-900">
								{getStepTitle()}
							</h2>
							<p className="text-sm text-gray-500 mt-1">
								Step {currentStep} of 3
							</p>
						</div>
						<button
							onClick={onClose}
							className="p-2 hover:bg-gray-100 rounded-full transition-colors"
							aria-label="Close dialog"
						>
							<svg
								className="w-5 h-5 text-gray-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					<div className="p-4 md:p-6">{renderStep()}</div>
				</div>

				<div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 md:p-6">
					<div className="flex justify-between gap-3">
						{currentStep > 1 && (
							<button
								className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
								onClick={(): void => {
									// Handle going back
								}}
							>
								Back
							</button>
						)}
						<button
							className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							disabled={isSaving}
							onClick={handleSave}
						>
							{isSaving
								? "Saving..."
								: currentStep === 3
									? "Finish"
									: "Continue"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
