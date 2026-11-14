import * as THREE from "three";

export const SKY_RADIUS = 80;
export const MOON_RADIUS_KM = 1737.4;
export const BODY_RADIUS_KM = { earth: 6371, sun: 696340 } as const;

export function skyDirection(azimuthDeg: number, elevationDeg: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export function skyPosition(azimuthDeg: number, elevationDeg: number): THREE.Vector3 {
  return skyDirection(azimuthDeg, elevationDeg).multiplyScalar(SKY_RADIUS);
}

export function apparentRadius(bodyRadiusKm: number, rangeKm: number): number {
  return SKY_RADIUS * Math.atan(bodyRadiusKm / rangeKm);
}

export const azimuthToYaw = (azimuthDeg: number) => -THREE.MathUtils.degToRad(azimuthDeg);
export const yawToHeadingDeg = (yaw: number) => ((-THREE.MathUtils.radToDeg(yaw) % 360) + 360) % 360;
