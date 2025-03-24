import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import { BasicDiceModel } from "../_game/modals/BasicDiceModel";
import type { Group } from "three";
import { motion } from "framer-motion-3d";
import { useWindowSize } from "@react-hook/window-size";

// Camera settings
const CAMERA_DISTANCE = 30;
const CAMERA_FOV = 45;

// Calculate visible area based on camera settings
const VISIBLE_HEIGHT =
	2 * Math.tan((CAMERA_FOV * Math.PI) / 180 / 2) * CAMERA_DISTANCE;
const ASPECT_RATIO = window.innerWidth / window.innerHeight;
const VISIBLE_WIDTH = VISIBLE_HEIGHT * ASPECT_RATIO;

// Convert 4px to world units
const MARGIN_PX = 4;
const PX_TO_WORLD = VISIBLE_WIDTH / window.innerWidth; // How many world units per pixel
const MARGIN = MARGIN_PX * PX_TO_WORLD;

// Constants for boundaries and movement
const BOUNDARY = {
	LEFT: -VISIBLE_WIDTH / 2 + MARGIN,
	RIGHT: VISIBLE_WIDTH / 2 - MARGIN,
	TOP: VISIBLE_HEIGHT / 2 - MARGIN,
	BOTTOM: -VISIBLE_HEIGHT / 2 + MARGIN,
};

// Dice size compensation (half the dice size since we're measuring from center)
const DICE_SIZE = {
	width: 2,
	height: 2,
};

const INITIAL_VELOCITY = {
	x: 0.08,
	y: 0.06,
};

// Rotation speeds (radians per frame)
const ROTATION_SPEED = {
	x: 0.015,
	y: 0.02,
	z: 0.01,
};

// Boundary lines component to visualize the limits
function BoundaryLines(): JSX.Element {
	// Memoize points arrays to prevent recreating every frame
	const points = useMemo(
		() => ({
			vertical: [
				[
					[BOUNDARY.LEFT, BOUNDARY.BOTTOM, 0],
					[BOUNDARY.LEFT, BOUNDARY.TOP, 0],
				],
				[
					[BOUNDARY.RIGHT, BOUNDARY.BOTTOM, 0],
					[BOUNDARY.RIGHT, BOUNDARY.TOP, 0],
				],
			],
			horizontal: [
				[
					[BOUNDARY.LEFT, BOUNDARY.TOP, 0],
					[BOUNDARY.RIGHT, BOUNDARY.TOP, 0],
				],
				[
					[BOUNDARY.LEFT, BOUNDARY.BOTTOM, 0],
					[BOUNDARY.RIGHT, BOUNDARY.BOTTOM, 0],
				],
			],
		}),
		[]
	);

	return (
		<>
			{points.vertical.map((line, index) => (
				<Line key={`v${index}`} color="red" lineWidth={2} points={line} />
			))}
			{points.horizontal.map((line, index) => (
				<Line key={`h${index}`} color="red" lineWidth={2} points={line} />
			))}
		</>
	);
}

function AnimatedDice(): JSX.Element {
	const diceRef = useRef<Group>(null);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const velocityRef = useRef(INITIAL_VELOCITY);
	const [rotation, setRotation] = useState({ x: 0.2, y: 0.3, z: 0.1 });

	useEffect(() => {
		let frameId: number;
		const velocity = velocityRef.current;

		const animate = (): void => {
			// Update position
			setPosition((previous) => {
				let newX = previous.x + velocity.x;
				let newY = previous.y + velocity.y;

				// Bounce logic with boundary checks accounting for dice size
				if (newX + DICE_SIZE.width / 2 >= BOUNDARY.RIGHT) {
					newX = BOUNDARY.RIGHT - DICE_SIZE.width / 2;
					velocity.x = -Math.abs(velocity.x);
				} else if (newX - DICE_SIZE.width / 2 <= BOUNDARY.LEFT) {
					newX = BOUNDARY.LEFT + DICE_SIZE.width / 2;
					velocity.x = Math.abs(velocity.x);
				}

				if (newY + DICE_SIZE.height / 2 >= BOUNDARY.TOP) {
					newY = BOUNDARY.TOP - DICE_SIZE.height / 2;
					velocity.y = -Math.abs(velocity.y);
				} else if (newY - DICE_SIZE.height / 2 <= BOUNDARY.BOTTOM) {
					newY = BOUNDARY.BOTTOM + DICE_SIZE.height / 2;
					velocity.y = Math.abs(velocity.y);
				}

				return { x: newX, y: newY };
			});

			// Update rotation
			setRotation((prev) => ({
				x: prev.x + ROTATION_SPEED.x,
				y: prev.y + ROTATION_SPEED.y,
				z: prev.z + ROTATION_SPEED.z,
			}));

			frameId = requestAnimationFrame(animate);
		};

		frameId = requestAnimationFrame(animate);
		return (): void => {
			cancelAnimationFrame(frameId);
		};
	}, []); // Empty dependency array for better performance

	return (
		<motion.group
			ref={diceRef}
			animate={{ scale: 1 }}
			initial={{ scale: 0 }}
			position={[position.x, position.y, 0]}
			rotation={[rotation.x, rotation.y, rotation.z]}
			transition={{
				default: { duration: 0.1, ease: "linear" },
				scale: { duration: 0.5, ease: "easeOut" },
			}}
		>
			<BasicDiceModel />
		</motion.group>
	);
}

export function BouncingDice(): JSX.Element {
	return (
		<div className="fixed inset-0 pointer-events-none">
			<Canvas
				camera={{
					fov: CAMERA_FOV,
					position: [0, 0, CAMERA_DISTANCE],
				}}
			>
				<ambientLight intensity={0.7} />
				<directionalLight intensity={0.5} position={[5, 5, 5]} />
				<BoundaryLines />
				<AnimatedDice />
				<OrbitControls
					enablePan={false}
					enableRotate={false}
					enableZoom={false}
				/>
			</Canvas>
		</div>
	);
}
