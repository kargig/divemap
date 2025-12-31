import { z } from 'zod';

// Reusable schemas
const depthSchema = z
  .number()
  .min(0, 'Depth must be non-negative')
  .max(300, 'Depth exceeds 300m limit');
const pressureSchema = z
  .number()
  .min(0, 'Pressure must be non-negative')
  .max(400, 'Pressure exceeds 400 bar');
const timeSchema = z
  .number()
  .min(1, 'Time must be at least 1 minute')
  .max(1440, 'Time exceeds 24 hours');
const volumeSchema = z.number().min(1, 'Volume must be at least 1L').max(50, 'Volume exceeds 50L');
const sacSchema = z
  .number()
  .min(5, 'SAC must be at least 5 L/min')
  .max(100, 'SAC exceeds 100 L/min');
const pO2Schema = z.number().min(0.16, 'pO2 too low').max(2.0, 'pO2 exceeds 2.0 bar');

// Gas Mix Schema (object)
const gasMixSchema = z
  .object({
    o2: z.number().min(15, 'O2 must be at least 15%').max(100),
    he: z.number().min(0).max(85, 'He cannot exceed 85%'),
  })
  .refine(data => data.o2 + data.he <= 100, {
    message: 'O2 + He cannot exceed 100%',
    path: ['o2'], // Mark O2 as invalid
  });

// MOD Calculator Schema
export const modSchema = z.object({
  gas: gasMixSchema,
  pO2: pO2Schema,
});

// Best Mix Calculator Schema
export const bestMixSchema = z
  .object({
    depth: depthSchema,
    pO2: pO2Schema,
    isTrimix: z.boolean(),
    targetEAD: depthSchema,
  })
  .refine(data => !data.isTrimix || data.targetEAD <= data.depth, {
    message: 'Target EAD cannot be deeper than actual depth',
    path: ['targetEAD'],
  });

// SAC Rate Calculator Schema
export const sacRateSchema = z
  .object({
    depth: depthSchema,
    time: timeSchema,
    tankSize: volumeSchema,
    startPressure: pressureSchema,
    endPressure: pressureSchema,
    gas: gasMixSchema,
  })
  .refine(data => data.endPressure <= data.startPressure, {
    message: 'End pressure cannot be higher than start pressure',
    path: ['endPressure'],
  });

// Gas Planning Calculator Schema
export const gasPlanningSchema = z.object({
  depth: depthSchema,
  time: timeSchema,
  sac: sacSchema,
  tankSize: volumeSchema,
  pressure: pressureSchema,
  isAdvanced: z.boolean(),
});

// Min Gas Calculator Schema
export const minGasSchema = z
  .object({
    depth: depthSchema,
    sac: sacSchema,
    solveTime: z.number().min(0).max(30, 'Solve time > 30 min?'),
    ascentRate: z.number().min(1).max(30, 'Ascent rate > 30 m/min?'),
    safetyStopDuration: z.number().min(0).max(20),
    tankSize: volumeSchema,
    isTech: z.boolean(),
    targetDepth: depthSchema,
  })
  .refine(data => !data.isTech || data.targetDepth <= data.depth, {
    message: 'Target depth cannot be deeper than start depth',
    path: ['targetDepth'],
  });

// Weight Calculator - simplified schema as inputs are mostly handled by specialized components
export const weightSchema = z.object({
  bodyWeight: z.number().min(30).max(250),
  experience: z.enum(['novice', 'proficient', 'expert']),
  suitIdx: z.number(),
  isSaltWater: z.boolean(),
  // Tank config is complex JSON, we validate it loosely or rely on component internal validation
  gasConfig: z.string().refine(val => {
    try {
      const parsed = JSON.parse(val);
      return parsed && typeof parsed === 'object';
    } catch {
      return false;
    }
  }, 'Invalid tank configuration'),
});
