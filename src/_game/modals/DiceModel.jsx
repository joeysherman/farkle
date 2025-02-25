/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
Command: npx gltfjsx@6.5.3 dice.glb --transform 
Files: dice.glb [744.73KB] > /Users/joey/Documents/Projects/vite-react-boilerplate-main/src/_game/modals/dice-transformed.glb [41.22KB] (94%)
*/

import React, { useEffect, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import { motion } from "framer-motion-3d";
import { degToRad } from "three/src/math/MathUtils.js";

export function Model(props) {
	const [animateClass, setAnimateClass] = useState("idle");
	const meshRef = useRef(null);
	const { nodes, materials } = useGLTF("/dice-transformed.glb");
	const {
		position,
		rotation,
		isScoringNumber,
		isSpinning = false,
		selected = false,
		onClick,
		// Animation configuration props with defaults
		spinSpeed = 5,
		returnSpeed = 2,
		spinRandomness = 0.5, // Adds variation to spin directions
	} = props;
	const [hovered, setHovered] = useState(false);
	const diceMaterials = materials.Dice.clone();
	// if isScoringNumber is true, then we need to change the material of the dice to the scoring material
	if (isScoringNumber && selected) {
		// green
		diceMaterials.color = new THREE.Color(0, 1, 0);
	} else if (isScoringNumber && !selected) {
		// light green
		diceMaterials.color = new THREE.Color(0.5, 1, 0.5);
	}

	// Generate random rotations for more natural spinning
	const randomRotation = {
		// random between 0 and 360
		x: Math.random() * 720,
		y: Math.random() * 720,
		z: Math.random() * 720,
	};

	//

	useEffect(() => {
		if (!isSpinning && isScoringNumber && selected) {
			setAnimateClass("hovered");
		} else if (!isSpinning && isScoringNumber && !selected) {
			setAnimateClass("idle");
		} else if (isSpinning) {
			setAnimateClass("spinning");
		} else if (!isSpinning && animateClass === "spinning") {
			setAnimateClass("idle");
		}
	}, [isSpinning, isScoringNumber, selected]);
	// generate random numbers
	return (
		//<Select enabled={hovered && !isSpinning && isScoringNumber}>
		<motion.group
			{...props}
			ref={meshRef}
			position-x={position[0]}
			position-y={position[1]}
			position-z={position[2]}
			//animate={isSpinning ? (hovered ? "hovered" : "spinning") : "idle"}
			animate={animateClass}
			variants={{
				hovered: {
					// move up a bit
					y: 4,
					transition: {
						duration: 1 / returnSpeed,
						ease: "easeOut",
					},
				},
				idle: {
					y: 0,
					rotateX: rotation?.[0] || 0,
					rotateY: rotation?.[1] || 0,
					rotateZ: rotation?.[2] || 0,
					transition: {
						duration: 1 / returnSpeed,
						ease: "easeOut",
					},
				},
				spinning: {
					//rotateZ: degToRad(360),
					//rotateX: randomRotation.x,
					//rotateY: randomRotation.y,
					rotateX: degToRad(randomRotation.x),
					rotateY: degToRad(randomRotation.y),
					rotateZ: degToRad(randomRotation.z),
					transition: {
						duration: 1,
						repeat: Infinity,
						ease: "linear",
					},
				},
			}}
			//dispose={null}
			onPointerEnter={() => {
				setHovered(true);
			}}
			onPointerLeave={() => {
				setHovered(false);
			}}
			// onClick={() => {
			// 	console.log("clicked");
			// 	if (isScoringNumber) {
			// 		props.onClick();
			// 	}
			// }}
		>
			<mesh geometry={nodes.Cube_1.geometry} material={materials.Dot} />
			<mesh
				geometry={nodes.Cube_2.geometry}
				material={isScoringNumber ? diceMaterials : materials.Dice}
			/>
			<mesh geometry={nodes.Cube_3.geometry} material={materials["Red Dot"]} />
		</motion.group>
		//</Select>
	);
}

//useGLTF.preload("/dice-transformed.glb");
