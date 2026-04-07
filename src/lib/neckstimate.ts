/**
 * Neckstimate — estimate body measurements from neck circumference.
 * Ported from FreeSewing (MIT license): https://github.com/freesewing/freesewing
 *
 * Given a neck circumference and body type, estimates 30+ body measurements
 * using proportional scaling with correction ratios for different measurement
 * categories (circumference, arc, vertical).
 *
 * All values in millimeters internally, converted to cm for output.
 */

export type BodyType = 'female' | 'male';

// Index: 0 = female, 1 = male
const BODY_INDEX: Record<BodyType, number> = { female: 0, male: 1 };

// Base measurements for an average-sized body [female, male] in mm
const base: Record<string, [number, number]> = {
	ankle: [245, 235],
	biceps: [270, 350],
	bustFront: [480, 560],
	bustPointToUnderbust: [100, 60],
	bustSpan: [160, 190],
	chest: [925, 1000],
	crossSeam: [740, 870],
	crossSeamFront: [370, 410],
	crotchDepth: [270, 340],
	heel: [315, 360],
	head: [565, 590],
	highBust: [865, 1030],
	highBustFront: [440, 570],
	hips: [900, 840],
	hpsToBust: [275, 280],
	hpsToWaistBack: [395, 470],
	hpsToWaistFront: [400, 460],
	inseam: [765, 780],
	knee: [380, 410],
	neck: [340, 380],
	seat: [1010, 1020],
	seatBack: [520, 560],
	shoulderSlope: [13, 13],
	shoulderToElbow: [340, 360],
	shoulderToShoulder: [415, 450],
	shoulderToWrist: [590, 630],
	underbust: [780, 980],
	upperLeg: [570, 625],
	waist: [750, 810],
	waistBack: [380, 410],
	waistToArmpit: [170, 210],
	waistToFloor: [1050, 1160],
	waistToHips: [125, 130],
	waistToKnee: [600, 640],
	waistToSeat: [250, 270],
	waistToUnderbust: [80, 55],
	waistToUpperLeg: [285, 340],
	wrist: [165, 175]
};

// Correction ratios — different measurement types scale differently
const ratio: Record<string, number> = {
	// Arc measurements (0.5)
	bustFront: 0.5,
	bustPointToUnderbust: 0.5,
	bustSpan: 0.5,
	highBustFront: 0.5,
	// Circumference measurements (1.0)
	ankle: 1,
	biceps: 1,
	chest: 1,
	highBust: 1,
	hips: 1,
	neck: 1,
	underbust: 1,
	// Vertical measurements (0.65)
	crotchDepth: 0.65,
	hpsToBust: 0.65,
	hpsToWaistBack: 0.65,
	hpsToWaistFront: 0.65,
	waistToArmpit: 0.65,
	waistToHips: 0.65,
	waistToKnee: 0.65,
	waistToSeat: 0.65,
	waistToUnderbust: 0.65,
	waistToUpperLeg: 0.65,
	// Other
	crossSeam: 0.6,
	crossSeamFront: 0.6,
	head: 0.35,
	heel: 0.25,
	inseam: 0.25,
	knee: 0.65,
	seat: 0.6,
	seatBack: 0.6,
	shoulderToElbow: 0.5,
	shoulderToShoulder: 0.65,
	shoulderToWrist: 0.3,
	upperLeg: 0.45,
	waist: 0.85,
	waistBack: 0.85,
	waistToFloor: 0.4,
	wrist: 0.5
};

export const MEASUREMENT_NAMES = Object.keys(base);

/**
 * Estimate a single measurement from neck circumference.
 * @param neckMm - Neck circumference in millimeters
 * @param measurement - Measurement name (e.g. 'chest', 'hips')
 * @param bodyType - 'female' or 'male'
 * @returns Estimated measurement in millimeters, or null if invalid
 */
export function neckstimate(neckMm: number, measurement: string, bodyType: BodyType = 'female'): number | null {
	if (!(measurement in base)) return null;
	const i = BODY_INDEX[bodyType];

	// Shoulder slope is in degrees — always return the base
	if (measurement === 'shoulderSlope') return base.shoulderSlope[i];

	const baseVal = base[measurement][i];
	const baseNeck = base.neck[i];
	const r = ratio[measurement] ?? 0.5;

	const delta = (neckMm / baseNeck) * baseVal - baseVal;
	return Math.round(baseVal + delta * r);
}

/**
 * Estimate all body measurements from neck circumference.
 * @param neckCm - Neck circumference in centimeters
 * @param bodyType - 'female' or 'male'
 * @returns Object with all measurements in centimeters
 */
export function estimateAllFromNeck(
	neckCm: number,
	bodyType: BodyType = 'female'
): Record<string, number> {
	const neckMm = neckCm * 10;
	const result: Record<string, number> = {};

	for (const name of MEASUREMENT_NAMES) {
		const val = neckstimate(neckMm, name, bodyType);
		if (val !== null) {
			result[name] = name === 'shoulderSlope' ? val : val / 10; // convert mm to cm, except degrees
		}
	}

	return result;
}

/**
 * Estimate key measurements (bust, waist, hip) from neck.
 * These map directly to Rosys Patterns' size chart measurements.
 */
export function estimateKeyMeasurements(
	neckCm: number,
	bodyType: BodyType = 'female'
): { bust_cm: number; waist_cm: number; hip_cm: number; shoulder_cm: number } {
	const all = estimateAllFromNeck(neckCm, bodyType);
	return {
		bust_cm: all.chest, // FreeSewing calls it 'chest', it's the bust/chest circumference
		waist_cm: all.waist,
		hip_cm: all.hips,
		shoulder_cm: all.shoulderToShoulder
	};
}

/**
 * Cross-validate user measurements against proportional expectations.
 * Returns warnings for measurements that seem unusual relative to each other.
 */
export function validateProportions(
	bust_cm: number,
	waist_cm: number,
	hip_cm: number,
	bodyType: BodyType = 'female'
): string[] {
	const warnings: string[] = [];
	const i = BODY_INDEX[bodyType];

	// Expected ratios from base measurements
	const expectedWaistToBust = base.waist[i] / base.chest[i]; // ~0.81 female
	const expectedHipToBust = base.hips[i] / base.chest[i]; // ~0.97 female

	const actualWaistToBust = waist_cm / bust_cm;
	const actualHipToBust = hip_cm / bust_cm;

	// Flag if ratios are >20% off from expected
	if (Math.abs(actualWaistToBust - expectedWaistToBust) / expectedWaistToBust > 0.2) {
		warnings.push(`Your waist-to-bust ratio (${(actualWaistToBust * 100).toFixed(0)}%) is unusual. Please double-check your waist measurement.`);
	}

	if (Math.abs(actualHipToBust - expectedHipToBust) / expectedHipToBust > 0.2) {
		warnings.push(`Your hip-to-bust ratio (${(actualHipToBust * 100).toFixed(0)}%) is unusual. Please double-check your hip measurement.`);
	}

	return warnings;
}
