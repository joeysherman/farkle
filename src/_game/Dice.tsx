import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DICE_URL, DROP_HEIGHT } from "./constants";

// Preload the dice model
useGLTF.preload(DICE_URL);

/**
 * Helper function to generate random initial position for the die
 */
function getRandomPosition() {
  return {
    x: (Math.random() * 4 - 2),  // -2 to 2
    y: DROP_HEIGHT,
    z: (Math.random() * 4 - 2)   // -2 to 2
  };
}

/**
 * Dice component that handles the physics and animation of a single die
 * Includes automatic correction to ensure it lands with 6 facing up
 */
export function Dice() {
  const diceRef = useRef<any>(null);
  const { scene } = useGLTF(DICE_URL);
  const isSettling = useRef(false);
  const startTime = useRef<number | null>(null);
  
  // Clone the scene for each die instance
  const clonedScene = scene.clone(true);

  useEffect(() => {
    if (diceRef.current) {
      const pos = getRandomPosition();
      diceRef.current.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
      
      // Simple initial spin
      diceRef.current.setAngvel(
        { 
          x: Math.random() * 2 - 1,    // Gentle spin
          y: Math.random() * 2 - 1, 
          z: Math.random() * 2 - 1
        }, 
        true
      );
    }
  }, []);

  useFrame((_, delta) => {
    if (diceRef.current) {
      const velocity = diceRef.current.linvel();
      const position = diceRef.current.translation();

      // Check if die has mostly stopped and is near the ground
      if (!isSettling.current && 
          Math.abs(velocity.y) < 0.1 && 
          position.y < 1.0) {
        
        isSettling.current = true;
        startTime.current = Date.now();
      }

      // If we're settling, smoothly rotate to correct orientation
      if (isSettling.current && startTime.current) {
        const elapsedTime = (Date.now() - startTime.current) / 1000; // Convert to seconds
        const duration = 0.5; // Half second transition
        
        if (elapsedTime <= duration) {
          const progress = elapsedTime / duration;
          const smoothProgress = Math.sin((progress * Math.PI) / 2); // Smooth easing
          
          const currentQuat = new THREE.Quaternion();
          const targetQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-Math.PI / 2, 0, 0)
          );
          
          currentQuat.slerpQuaternions(
            diceRef.current.rotation() as THREE.Quaternion,
            targetQuat,
            smoothProgress
          );
          
          diceRef.current.setRotation(currentQuat, true);
          
          // Gradually reduce angular velocity
          const currentAngVel = diceRef.current.angvel();
          diceRef.current.setAngvel({
            x: currentAngVel.x * (1 - smoothProgress),
            y: currentAngVel.y * (1 - smoothProgress),
            z: currentAngVel.z * (1 - smoothProgress)
          }, true);
        }
      }
    }
  });

  return (
    <RigidBody 
      ref={diceRef} 
      colliders="cuboid"
      mass={2}
      position={[0, DROP_HEIGHT, 0]}
      rotation={[0, 0, 0]}
      restitution={0.3}    // Less bounce
      friction={0.8}       // More friction
      angularDamping={0.8} // More angular damping
      linearDamping={0.8}  // More linear damping
      ccd={true}          // Continuous collision detection
    >
      <primitive object={clonedScene} scale={[1, 1, 1]} />
    </RigidBody>
  );
} 