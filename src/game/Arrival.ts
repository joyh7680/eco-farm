// One timeline and one landing location shared by animation, movement and saving.
export const ARRIVAL = {
  flightEnd: 3.2,
  surfaceAt: 6.4,
  landedAt: 9.4,
  doorAt: 9.7,
  exitAt: 10.6,
  duration: 12.4,
} as const;
export const LANDING_SITE = { x: 16, z: 10.5, hx: 1.45, hz: 1.45 };
export const LANDING_EXIT = { x: 16, z: 13.1 };
export const SHORE_WATER = { x: 20, z: 4.5, rx: 2.8, rz: 4.2 };
export function arrivalPhase(time: number) {
  return time < ARRIVAL.flightEnd ? 'SPACE_FLIGHT' : time < ARRIVAL.surfaceAt ? 'PLANET_APPROACH' : time < ARRIVAL.landedAt ? 'LANDING' : time < ARRIVAL.exitAt ? 'DOOR_OPEN' : 'DISEMBARK';
}
