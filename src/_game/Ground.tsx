import { RigidBody } from "@react-three/rapier";
import { ARENA_SIZE } from "./constants";

/**
 * Ground component that creates the floor and its collision box
 * Includes both visible ground plane and invisible collision box
 */
export function Ground() {
  return (
    <RigidBody type="fixed" restitution={0.75} friction={0.5}>
      {/* Visible ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#e9e464" />
      </mesh>
      
      {/* Invisible collision box */}
      <mesh rotation={[0, 0, 0]} position={[0, -0.5, 0]}>
        <boxGeometry args={[ARENA_SIZE, 1, ARENA_SIZE]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
    </RigidBody>
  );
} 