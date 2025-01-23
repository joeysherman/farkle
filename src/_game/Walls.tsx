import { RigidBody } from "@react-three/rapier";
import { ARENA_SIZE, WALL_HEIGHT } from "./constants";

/**
 * Walls component that creates invisible barriers around the arena
 * Prevents dice from falling off the edges
 */
export function Walls() {
  return (
    <>
      {/* Back wall */}
      <RigidBody type="fixed" position={[0, WALL_HEIGHT / 2, -ARENA_SIZE / 2]}>
        <mesh>
          <boxGeometry args={[ARENA_SIZE, WALL_HEIGHT, 0.1]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      
      {/* Front wall */}
      <RigidBody type="fixed" position={[0, WALL_HEIGHT / 2, ARENA_SIZE / 2]}>
        <mesh>
          <boxGeometry args={[ARENA_SIZE, WALL_HEIGHT, 0.1]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      
      {/* Left wall */}
      <RigidBody type="fixed" position={[-ARENA_SIZE / 2, WALL_HEIGHT / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.1, WALL_HEIGHT, ARENA_SIZE]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      
      {/* Right wall */}
      <RigidBody type="fixed" position={[ARENA_SIZE / 2, WALL_HEIGHT / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.1, WALL_HEIGHT, ARENA_SIZE]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
    </>
  );
} 