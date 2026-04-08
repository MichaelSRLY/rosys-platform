/**
 * MLP Body Profile Predictor — runs inference on the trained model.
 * Input: bust, waist, hip, height → Output: 10 body measurements
 *
 * Pure TypeScript matrix math — no Python, no PyTorch needed.
 * Model: 4-layer MLP trained on 59K subjects (NHANES + BodyM + Kaggle + synthetic).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ModelWeights {
	[key: string]: number[] | number[][] | string[];
	mean: number[];
	std: number[];
	cols: string[];
	input_cols: string[];
}

let weights: ModelWeights | null = null;

function loadWeights(): ModelWeights {
	if (weights) return weights;
	const raw = readFileSync(join(process.cwd(), 'src/lib/mlp-weights.json'), 'utf-8');
	weights = JSON.parse(raw);
	return weights!;
}

// Matrix operations
// PyTorch stores weights as [out_features, in_features]
function matmul(a: number[], w: number[][], bias: number[]): number[] {
	const outSize = w.length; // out_features
	const out = new Array(outSize);
	for (let j = 0; j < outSize; j++) {
		let sum = bias[j];
		for (let i = 0; i < a.length; i++) {
			sum += a[i] * w[j][i]; // w[out][in] — PyTorch layout
		}
		out[j] = sum;
	}
	return out;
}

function gelu(x: number[]): number[] {
	return x.map(v => v * 0.5 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (v + 0.044715 * v * v * v))));
}

function batchnorm(x: number[], mean: number[], variance: number[], weight: number[], bias: number[]): number[] {
	return x.map((v, i) => {
		const norm = (v - mean[i]) / Math.sqrt(variance[i] + 1e-5);
		return norm * weight[i] + bias[i];
	});
}

export interface BodyProfile {
	bust_cm: number;
	waist_cm: number;
	hip_cm: number;
	height_cm: number;
	weight_kg: number | null;
	arm_length_cm: number;
	shoulder_cm: number;
	neck_cm: number | null;
	leg_length_cm: number;
	arm_circ_cm: number;
}

/**
 * Predict full body profile from bust, waist, hip, height.
 */
export function predictBodyProfile(
	bust_cm: number,
	waist_cm: number,
	hip_cm: number,
	height_cm: number
): BodyProfile {
	const w = loadWeights();

	// Input: [height, chest, waist, hip] (model's input order)
	const input = [height_cm, bust_cm, waist_cm, hip_cm];

	// Forward pass through MLP:
	// Linear(4→512) → GELU → BN → Dropout(skip) →
	// Linear(512→1024) → GELU → BN → Dropout(skip) →
	// Linear(1024→512) → GELU → BN → Dropout(skip) →
	// Linear(512→256) → GELU → Linear(256→10)

	// Layer 0: Linear(4, 512)
	let x = matmul(input, w['net.0.weight'] as number[][], w['net.0.bias'] as number[]);
	x = gelu(x);
	x = batchnorm(x, w['net.2.running_mean'] as number[], w['net.2.running_var'] as number[], w['net.2.weight'] as number[], w['net.2.bias'] as number[]);

	// Layer 4: Linear(512, 1024)
	x = matmul(x, w['net.4.weight'] as number[][], w['net.4.bias'] as number[]);
	x = gelu(x);
	x = batchnorm(x, w['net.6.running_mean'] as number[], w['net.6.running_var'] as number[], w['net.6.weight'] as number[], w['net.6.bias'] as number[]);

	// Layer 8: Linear(1024, 512)
	x = matmul(x, w['net.8.weight'] as number[][], w['net.8.bias'] as number[]);
	x = gelu(x);
	x = batchnorm(x, w['net.10.running_mean'] as number[], w['net.10.running_var'] as number[], w['net.10.weight'] as number[], w['net.10.bias'] as number[]);

	// Layer 12: Linear(512, 256)
	x = matmul(x, w['net.12.weight'] as number[][], w['net.12.bias'] as number[]);
	x = gelu(x);

	// Layer 14: Linear(256, 10)
	x = matmul(x, w['net.14.weight'] as number[][], w['net.14.bias'] as number[]);

	// Denormalize: output * std + mean
	const mean = w.mean;
	const std = w.std;
	const output = x.map((v, i) => v * std[i] + mean[i]);

	// Map to named measurements
	// cols: ['chest', 'waist', 'hip', 'height', 'weight', 'arm_length', 'shoulder', 'neck', 'leg_length', 'arm_circ']
	return {
		bust_cm: Math.round(output[0] * 10) / 10,
		waist_cm: Math.round(output[1] * 10) / 10,
		hip_cm: Math.round(output[2] * 10) / 10,
		height_cm: Math.round(output[3] * 10) / 10,
		weight_kg: output[4] > 10 ? Math.round(output[4] * 10) / 10 : null,
		arm_length_cm: Math.round(output[5] * 10) / 10,
		shoulder_cm: Math.round(output[6] * 10) / 10,
		neck_cm: output[7] > 10 && output[7] < 60 ? Math.round(output[7] * 10) / 10 : null,
		leg_length_cm: Math.round(output[8] * 10) / 10,
		arm_circ_cm: Math.round(output[9] * 10) / 10,
	};
}
