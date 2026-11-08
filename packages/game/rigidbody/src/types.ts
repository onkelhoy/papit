/** Any `{ x, y, z? }`, a `Vector2`/`Vector3` included. `{ x, y }` is read as `z = 0`. */
export type VecInput = { x: number; y: number; z?: number };

/** Any `{ x, y, z, w }`, a `Quaternion` included. */
export type QuatInput = { x: number; y: number; z: number; w: number };

export type WorldOptions = {
    /** 2 locks every body to the xy plane, rotating only about z. Default 3. */
    dimensions?: 2 | 3;
    /** default `{ x: 0, y: -9.81, z: 0 }` */
    gravity?: VecInput;
    /** fixed step in seconds, default 1/120 */
    timestep?: number;
    /** most fixed steps per `update`, stops a slow frame from spiralling. Default 8. */
    maxSteps?: number;
    /** velocity solver passes per step, default 10 */
    iterations?: number;
    /** let resting bodies sleep, default true */
    allowSleep?: boolean;
    /** below this speed (m/s and rad/s) a body counts as resting, default 0.05 */
    sleepSpeed?: number;
    /** seconds resting before it sleeps, default 0.5 */
    sleepTime?: number;
};
