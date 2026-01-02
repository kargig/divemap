/**
 * Core physics module for dive calculations.
 * Aligned with backend/app/physics.py
 * Based on algorithms from Subsurface (https://github.com/subsurface/subsurface).
 */

// Subsurface uses 1.01325 bar as standard surface pressure for volume conversions
export const SURFACE_PRESSURE_BAR = 1.01325;

/**
 * Calculates the gas compressibility factor (Z) using the Virial equation.
 * Based on Subsurface implementation (core/compressibility.c / core/gas.c).
 *
 * @param {number} bar Pressure in bar
 * @param {Object} gas Gas mix object { o2: 21, he: 0 }
 * @returns {number} The compressibility factor Z
 */
export const calculateZFactor = (bar, gas) => {
  // Clamp pressure to 0-500 bar range as per Subsurface
  const p = Math.max(0, Math.min(bar, 500));

  // Coefficients from Subsurface (3rd order virial expansion)
  const O2_COEFFS = [-7.18092073703e-4, 2.81852572808e-6, -1.50290620492e-9];
  const N2_COEFFS = [-2.19260353292e-4, 2.92844845532e-6, -2.07613482075e-9];
  const HE_COEFFS = [4.87320026468e-4, -8.83632921053e-8, 5.33304543646e-11];

  const virial = (coeffs, x) => {
    return x * coeffs[0] + x * x * coeffs[1] + x * x * x * coeffs[2];
  };

  const o2 = (gas?.o2 || 21) * 10;
  const he = (gas?.he || 0) * 10;
  // Subsurface uses permille (0-1000)
  const n2 = 1000 - o2 - he;

  const z_m1 = virial(O2_COEFFS, p) * o2 + virial(HE_COEFFS, p) * he + virial(N2_COEFFS, p) * n2;

  // Convert back: Z = 1 + (Weighted_Virial_Sum / 1000)
  return z_m1 * 0.001 + 1.0;
};

/**
 * Calculates the actual volume of gas (at surface pressure) in a tank.
 * Real Volume = (Tank_Water_Vol * Pressure) / Z
 *
 * @param {number} bar Current pressure in bar
 * @param {number} tankSizeLitres Wet volume of tank (e.g. 12)
 * @param {Object} gas Gas mix { o2: 21, he: 0 }
 * @returns {number} Equivalent surface volume in liters
 */
export const calculateRealVolume = (bar, tankSizeLitres, gas) => {
  if (!bar || !tankSizeLitres) return 0;
  const z = calculateZFactor(bar, gas);
  // Adjusted for surface pressure reference
  return (tankSizeLitres * (bar / SURFACE_PRESSURE_BAR)) / z;
};

/**
 * Inverse of calculateRealVolume. Solves for pressure given a gas volume.
 * Used for "How much pressure do I need for X liters of gas?"
 *
 * @param {number} volumeLitres Required gas volume at surface
 * @param {number} tankSizeLitres Tank wet volume
 * @param {Object} gas Gas mix
 * @returns {number} Required pressure in bar
 */
export const calculatePressureFromVolume = (volumeLitres, tankSizeLitres, gas) => {
  if (!tankSizeLitres || tankSizeLitres === 0) return 0;

  // Initial guess using Ideal Gas Law
  let p_guess = (volumeLitres * SURFACE_PRESSURE_BAR) / tankSizeLitres;

  // Simple iteration to converge
  for (let i = 0; i < 5; i++) {
    const z = calculateZFactor(p_guess, gas);
    const p_new = (volumeLitres * SURFACE_PRESSURE_BAR * z) / tankSizeLitres;
    if (Math.abs(p_new - p_guess) < 0.1) return p_new;
    p_guess = p_new;
  }

  return p_guess;
};

/**
 * Calculates Maximum Operating Depth (MOD) in meters.
 * MOD = (ppO2_max / fO2 - surface_pressure) * 10
 *
 * @param {Object} gas Gas mix { o2: 21, he: 0 }
 * @param {number} ppO2Max Maximum partial pressure of Oxygen (e.g. 1.4)
 * @returns {number} MOD in meters
 */
export const calculateMOD = (gas, ppO2Max) => {
  const o2 = parseFloat(gas?.o2) || 21;
  if (o2 <= 0) return 0;

  const fO2 = o2 / 100;
  const maxAta = ppO2Max / fO2;
  // (ATA - Surface) * 10m/bar
  return Math.max(0, (maxAta - SURFACE_PRESSURE_BAR) * 10); // Using exact surface pressure
};

/**
 * Calculates Equivalent Narcotic Depth (END).
 * Assumes O2 is narcotic (standard recreational/tech view).
 * Formula: END = (Depth + 10) * (1 - fHe) - 10
 *
 * @param {number} depth Depth in meters
 * @param {Object} gas Gas mix { o2: 21, he: 0 }
 * @returns {number} END in meters
 */
export const calculateEND = (depth, gas) => {
  const he = parseFloat(gas?.he) || 0;
  const fHe = he / 100;
  return (depth + 10) * (1 - fHe) - 10;
};

/**
 * Calculates Equivalent Air Depth (EAD) for Nitrox.
 * EAD = (Depth + 10) * (fN2 / 0.79) - 10
 *
 * @param {number} depth Depth in meters
 * @param {Object} gas Gas mix { o2: 21, he: 0 }
 * @returns {number} EAD in meters
 */
export const calculateEAD = (depth, gas) => {
  const o2 = parseFloat(gas?.o2) || 21;
  const he = parseFloat(gas?.he) || 0;
  const fN2 = (100 - o2 - he) / 100;
  return (depth + 10) * (fN2 / 0.79) - 10;
};

/**
 * Checks for Isobaric Counterdiffusion (ICD) risks when switching gases.
 * Implements the 'Rule of Fifths': Nitrogen increase should not exceed 1/5th of Helium decrease.
 *
 * @param {Object} currentGas The gas being breathed currently { o2, he }
 * @param {Object} nextGas The gas being switched to { o2, he }
 * @returns {Object} { warning: boolean, deltaN2: number, deltaHe: number, message: string | null }
 */
export const checkIsobaricCounterdiffusion = (currentGas, nextGas) => {
  const curO2 = parseFloat(currentGas?.o2) || 21;
  const curHe = parseFloat(currentGas?.he) || 0;
  const curN2 = 100 - curO2 - curHe;

  const nextO2 = parseFloat(nextGas?.o2) || 21;
  const nextHe = parseFloat(nextGas?.he) || 0;
  const nextN2 = 100 - nextO2 - nextHe;

  // Delta N2 (increase is positive)
  const dN2 = nextN2 - curN2;

  // Delta He (decrease is negative)
  const dHe = nextHe - curHe;

  let warning = false;
  let message = null;

  // Logic:
  // 1. Current gas must have Helium (>0)
  // 2. Switching results in N2 increase (>0)
  // 3. Switching results in He decrease (<0)
  // 4. Rule check: 5 * delta_N2 > -delta_He
  if (curHe > 0 && dN2 > 0 && dHe < 0) {
    if (5 * dN2 > -dHe) {
      warning = true;
      message = `ICD Warning: N2 increase (${dN2.toFixed(1)}%) > 1/5th of He drop (${Math.abs(dHe).toFixed(1)}%). Risk of inner-ear DCS.`;
    }
  }

  return { warning, deltaN2: dN2, deltaHe: dHe, message };
};
