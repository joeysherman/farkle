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
		position: [0, -3, 0],
		scale: [1, 1, 1],
		cameraPosition: [0, 15, 30],
		fov: 20,
		minDistance: 35,
		maxDistance: 35,
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
}: RoomSettingsDialogProps): JSX.Element {
	const [selectedModel, setSelectedModel] = useState<
		"boxing_ring" | "coliseum" | "poker_table"
	>("boxing_ring");
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async (): Promise<void> => {
		try {
			setIsSaving(true);
			const { error } = await supabase
				.from("game_rooms")
				.update({ tableModel: selectedModel })
				.eq("id", roomId);

			if (error) throw error;
			onClose();
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

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
				<h2 className="text-2xl font-bold text-gray-900 mb-4">Room Settings</h2>

				<div className="mb-6">
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Game Table
					</label>
					<div className="grid grid-cols-3 gap-4">
						<button
							className={`p-4 rounded-lg border-2 transition-all ${
								selectedModel === "boxing_ring"
									? "border-indigo-500 bg-indigo-50"
									: "border-gray-200 hover:border-indigo-200"
							}`}
							onClick={(): void => {
								handleModelSelect("boxing_ring");
							}}
						>
							<div className="aspect-video bg-gray-100 rounded mb-2 overflow-hidden">
								<ModelPreview model="boxing_ring" />
							</div>
							<p className="text-sm font-medium text-gray-900">Boxing Ring</p>
							<p className="text-xs text-gray-500 mt-1">
								A classic boxing ring setting
							</p>
						</button>

						<button
							className={`p-4 rounded-lg border-2 transition-all ${
								selectedModel === "coliseum"
									? "border-indigo-500 bg-indigo-50"
									: "border-gray-200 hover:border-indigo-200"
							}`}
							onClick={(): void => {
								handleModelSelect("coliseum");
							}}
						>
							<div className="aspect-video bg-gray-100 rounded mb-2 overflow-hidden">
								<ModelPreview model="coliseum" />
							</div>
							<p className="text-sm font-medium text-gray-900">Coliseum</p>
							<p className="text-xs text-gray-500 mt-1">
								An epic Roman coliseum arena
							</p>
						</button>

						<button
							className={`p-4 rounded-lg border-2 transition-all ${
								selectedModel === "poker_table"
									? "border-indigo-500 bg-indigo-50"
									: "border-gray-200 hover:border-indigo-200"
							}`}
							onClick={(): void => {
								handleModelSelect("poker_table");
							}}
						>
							<div className="aspect-video bg-gray-100 rounded mb-2 overflow-hidden">
								<ModelPreview model="poker_table" />
							</div>
							<p className="text-sm font-medium text-gray-900">Poker Table</p>
							<p className="text-xs text-gray-500 mt-1">
								A classic casino poker table
							</p>
						</button>
					</div>
				</div>

				<div className="flex justify-end gap-3">
					<button
						className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
						onClick={onClose}
					>
						Cancel
					</button>
					<button
						className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
						disabled={isSaving}
						onClick={handleSave}
					>
						{isSaving ? "Saving..." : "Save Settings"}
					</button>
				</div>
			</div>
		</div>
	);
}
