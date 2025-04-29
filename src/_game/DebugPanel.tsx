import { useEffect, useRef } from "react";
import * as dat from "dat.gui";
import { useThree } from "@react-three/fiber";

interface DebugPanelProps {
	orbitControlsRef: React.RefObject<any>;
	onAutoRotateChange?: (value: boolean) => void;
	onAutoRotateSpeedChange?: (value: number) => void;
}

// Create a single instance of GUI outside the component
let gui: dat.GUI | null = null;

const isDev = process.env.NODE_ENV === "development";

// Component that runs inside Canvas
export const CameraDebug = ({
	orbitControlsRef,
}: {
	orbitControlsRef: React.RefObject<any>;
}) => {
	// Only run in development
	if (!isDev) return null;

	const { camera } = useThree();

	useEffect(() => {
		const logCameraState = () => {
			if (camera && orbitControlsRef.current) {
				const distance = orbitControlsRef.current.getDistance();
				console.log("Camera State:", {
					position: {
						x: Number(camera.position.x.toFixed(2)),
						y: Number(camera.position.y.toFixed(2)),
						z: Number(camera.position.z.toFixed(2)),
					},
					rotation: {
						x: Number(camera.rotation.x.toFixed(2)),
						y: Number(camera.rotation.y.toFixed(2)),
						z: Number(camera.rotation.z.toFixed(2)),
					},
					target: {
						x: Number(orbitControlsRef.current.target.x.toFixed(2)),
						y: Number(orbitControlsRef.current.target.y.toFixed(2)),
						z: Number(orbitControlsRef.current.target.z.toFixed(2)),
					},
					fov: camera.fov,
					distance: Number(distance.toFixed(2)),
					zoom: Number(camera.zoom.toFixed(2)),
				});
			}
		};

		// Add the log function to window for easy access from GUI
		(window as any).__logCameraState = logCameraState;

		return () => {
			delete (window as any).__logCameraState;
		};
	}, [camera, orbitControlsRef]);

	return null;
};

export const DebugPanel = ({
	orbitControlsRef,
	onAutoRotateChange,
	onAutoRotateSpeedChange,
}: DebugPanelProps) => {
	// Only run in development
	if (!isDev) return null;

	const cameraPositionRef = useRef<[number, number, number]>([0, 5, 10]);

	useEffect(() => {
		// Only create GUI if it doesn't exist and we're in development
		if (!gui && isDev) {
			gui = new dat.GUI({
				name: "Scene Controls",
				autoPlace: false,
				width: 320,
			});

			// Position the GUI in the top right
			const guiContainer = gui.domElement;
			guiContainer.style.position = "absolute";
			guiContainer.style.top = "0px";
			guiContainer.style.right = "0px";
			guiContainer.style.zIndex = "1000"; // Ensure it's above the canvas
			document.body.appendChild(guiContainer);
		}

		// Camera Controls
		const cameraFolder = gui?.addFolder("Camera Controls");
		cameraFolder
			?.add({ autoRotate: true }, "autoRotate")
			.onChange((value: boolean) => {
				if (orbitControlsRef.current) {
					orbitControlsRef.current.autoRotate = value;
				}
				onAutoRotateChange?.(value);
			});
		cameraFolder
			?.add({ autoRotateSpeed: 0.5 }, "autoRotateSpeed", 0, 2, 0.1)
			.onChange((value: number) => {
				if (orbitControlsRef.current) {
					orbitControlsRef.current.autoRotateSpeed = value;
				}
				onAutoRotateSpeedChange?.(value);
			});

		// Camera Position
		const positionFolder = gui?.addFolder("Camera Position");
		positionFolder
			?.add(cameraPositionRef.current, "0", -20, 20, 0.1)
			.name("X")
			.onChange((value: number) => {
				cameraPositionRef.current[0] = value;
				(window as any).__logCameraState?.();
			});
		positionFolder
			?.add(cameraPositionRef.current, "1", -20, 20, 0.1)
			.name("Y")
			.onChange((value: number) => {
				cameraPositionRef.current[1] = value;
				(window as any).__logCameraState?.();
			});
		positionFolder
			?.add(cameraPositionRef.current, "2", -20, 20, 0.1)
			.name("Z")
			.onChange((value: number) => {
				cameraPositionRef.current[2] = value;
				(window as any).__logCameraState?.();
			});

		// Debug Actions
		const debugFolder = gui?.addFolder("Debug Actions");
		debugFolder
			?.add(
				{
					logState: () => {
						(window as any).__logCameraState?.();
					},
				},
				"logState"
			)
			.name("Log Camera State");

		// Open folders by default
		cameraFolder?.open();
		positionFolder?.open();
		debugFolder?.open();

		// Cleanup function
		return () => {
			if (gui) {
				const guiContainer = gui.domElement;
				if (guiContainer.parentNode) {
					guiContainer.parentNode.removeChild(guiContainer);
				}
				gui.destroy();
				gui = null;
			}
		};
	}, [orbitControlsRef, onAutoRotateChange, onAutoRotateSpeedChange]);

	return null;
};
