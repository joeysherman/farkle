import {
	Text,
	Billboard,
	OrbitControls,
	CameraControls,
	PerspectiveCamera,
	OrthographicCamera,
	Stats,
	GizmoHelper,
	GizmoViewport,
	Grid,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
	EffectComposer,
	Outline,
	Select,
	Selection,
} from "@react-three/postprocessing";
import { useRef, useState, useEffect } from "react";
import { BoxingRing } from "./BoxingRing";
import { Coliseum } from "./Coliseum";
import { ARENA_SIZE } from "./constants";
import { Model as DiceModel } from "./modals/DiceModel";
import { DiceScene } from "./DiceScene";
import { DebugPanel, CameraDebug } from "./DebugPanel";
import { PokerTable } from "./PokerTable";

const isDev = process.env.NODE_ENV === "development";

// Camera presets for different device types
const cameraPresets = {
	mobile: {
		position: {
			x: -24.88,
			y: 64.32,
			z: -27.58,
		},
		rotation: {
			x: -1.98,
			y: -0.34,
			z: -2.48,
		},
		target: {
			x: 0,
			y: 0,
			z: 0,
		},
		fov: 45,
		distance: 50,
		zoom: 1,
		// Allow zooming out a bit more and zooming in slightly less
		maxDistance: 80, // Increased from 74.28 to allow zooming out more
		minDistance: 40, // Decreased from 74.28 to allow zooming in more
		zoomSpeed: 0.5,
	},
	desktop: {
		position: {
			x: -14.58,
			y: 27.71,
			z: 6.6,
		},
		rotation: {
			x: -1.34,
			y: -0.47,
			z: -1.09,
		},
		target: {
			x: 0,
			y: 0,
			z: 0,
		},
		fov: 35,
		distance: 50,
		zoom: 1,
		// Default zoom limits
		maxDistance: 75,
		minDistance: 55,
		zoomSpeed: 0.25,
	},
};

// Utility function to detect device type
const isMobileDevice = (): boolean => {
	// Check if window is defined (client-side)
	if (typeof window !== "undefined") {
		// Method 1: Check screen width
		if (window.innerWidth <= 768) {
			return true;
		}

		// Method 2: Check user agent
		const userAgent =
			navigator.userAgent || navigator.vendor || (window as any).opera;
		const mobileRegex =
			/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
		return mobileRegex.test(userAgent.toLowerCase());
	}

	// Default to desktop if we can't determine
	return false;
};

export const GameScene = ({
	diceStates,
	isSpinning,
	selectedDiceIndices,
	setSelectedDiceIndices,
	isCurrentPlayerTurn,
	tableModel = "boxing_ring",
}: GameSceneProps) => {
	const cameraControlsRef = useRef();
	const orbitControlsRef = useRef();
	const [isMobile, setIsMobile] = useState(isMobileDevice());
	const [cameraPreset, setCameraPreset] = useState(
		isMobile ? cameraPresets.mobile : cameraPresets.desktop
	);

	// Update camera preset when screen size changes
	useEffect(() => {
		const handleResize = () => {
			const mobile = isMobileDevice();
			setIsMobile(mobile);
			setCameraPreset(mobile ? cameraPresets.mobile : cameraPresets.desktop);
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return (
		<div className="absolute bottom-0 w-full h-full">
			{isDev && (
				<DebugPanel
					orbitControlsRef={orbitControlsRef}
					onAutoRotateChange={(value) => {
						if (orbitControlsRef.current) {
							orbitControlsRef.current.autoRotate = value;
						}
					}}
					onAutoRotateSpeedChange={(value) => {
						if (orbitControlsRef.current) {
							orbitControlsRef.current.autoRotateSpeed = value;
						}
					}}
				/>
			)}
			<Canvas
			// shadows
			// camera={{
			// 	position: [-ARENA_SIZE * 0.4, ARENA_SIZE * 1.2, ARENA_SIZE * 1.4],
			// 	fov: 30,
			// }}

			// style={{
			// 	background: "#f3f4f6",
			// 	position: "absolute",

			// 	right: 0,
			// 	bottom: 0,
			// 	left: 0,
			// 	width: "100%",
			// 	height: "100%",
			// }}
			>
				{isDev && (
					<>
						<CameraDebug orbitControlsRef={orbitControlsRef} />
						<Stats
							className="stats"
							showPanel={0} // 0: fps, 1: ms, 2: mb, 3+: custom
							position={{ top: "60px", right: "0px" }}
						/>
						<GizmoHelper alignment="bottom-right" margin={[80, 80]}>
							<GizmoViewport
								axisColors={["red", "green", "blue"]}
								labelColor="black"
							/>
						</GizmoHelper>
					</>
				)}
				{isDev && (
					<Grid
						args={[30, 30]}
						position={[0, -0.01, 0]}
						cellSize={1}
						cellThickness={0.5}
						cellColor="#6f6f6f"
						sectionSize={3}
						sectionThickness={1.5}
						sectionColor="#9d4b4b"
						fadeDistance={30}
						fadeStrength={1}
						followCamera={false}
						infiniteGrid
					/>
				)}
				{/* <PerspectiveCamera
					makeDefault
					position={[-ARENA_SIZE * 3.5, ARENA_SIZE * 3.5, ARENA_SIZE * 1]}
					fov={30}
					//aspect={window.innerWidth / window.innerHeight}
					//aspect={0.5}
					zoom={0.5}
				/> */}
				<PerspectiveCamera
					makeDefault
					position={[
						cameraPreset.position.x,
						cameraPreset.position.y,
						cameraPreset.position.z,
					]}
					rotation={[
						cameraPreset.rotation.x,
						cameraPreset.rotation.y,
						cameraPreset.rotation.z,
					]}
					fov={cameraPreset.fov}
					distance={cameraPreset.distance}
				/>
				<ambientLight intensity={0.5} />
				<pointLight position={[-50, 100, -50]} />
				<directionalLight
					position={[-50, 100, -50]}
					intensity={2}
					castShadow
					//shadow-mapSize={[4096, 4096]}
					shadow-camera-left={-20}
					shadow-camera-right={20}
					shadow-camera-top={20}
					shadow-camera-bottom={-20}
				/>
				{tableModel === "boxing_ring" ? (
					<BoxingRing />
				) : tableModel === "coliseum" ? (
					<Coliseum />
				) : (
					<PokerTable />
				)}
				<Selection enabled={!isSpinning} autoClear={true}>
					<EffectComposer multisampling={8} autoClear={false}>
						{isCurrentPlayerTurn && (
							<Outline
								visibleEdgeColor="red"
								edgeStrength={100}
								edgeGlow={1}
								pulseSpeed={0.5}
								blur={false}
								xRay={false}
								width={1000}
							/>
						)}
					</EffectComposer>
					<DiceScene
						isCurrentPlayerTurn={isCurrentPlayerTurn}
						diceStates={diceStates}
						isSpinning={isSpinning}
						selectedDiceIndices={selectedDiceIndices}
						setSelectedDiceIndices={setSelectedDiceIndices}
					/>
				</Selection>
				<OrbitControls
					ref={orbitControlsRef}
					autoRotate
					autoRotateSpeed={0.5}
					enableDamping
					dampingFactor={0.05}
					enablePan
					enableZoom
					minPolarAngle={Math.PI / 6}
					maxPolarAngle={Math.PI / 2 - 0.1}
					// Use the device-specific zoom limits
					maxDistance={cameraPreset.maxDistance}
					minDistance={cameraPreset.minDistance}
					rotateSpeed={0.5}
					zoomSpeed={cameraPreset.zoomSpeed}
					target={[
						cameraPreset.target.x,
						cameraPreset.target.y,
						cameraPreset.target.z,
					]}
				/>
			</Canvas>
		</div>
	);
};
