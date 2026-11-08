import { World, RigidBody, Plane, Box, Sphere } from "@papit/rigidbody";
const world = new World();
world.add(new RigidBody({ shape: new Plane() }));
for (let i = 0; i < 100; i++) world.add(new RigidBody({ shape: i % 2 ? new Box(1, 1, 1) : new Sphere(0.5), mass: 1, position: { x: (i % 10) * 1.1, y: 0.5 + Math.floor(i / 10) * 1.05, z: 0 } }));
const t = performance.now();
for (let i = 0; i < 120; i++) world.step();
console.log("ms/step", ((performance.now() - t) / 120).toFixed(3));
