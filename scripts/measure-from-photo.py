#!/usr/bin/env python3
"""
Body measurement estimation from a single front-facing photo.

Uses MediaPipe Pose for landmark detection + MiDaS for depth estimation
to convert 2D pixel measurements into 3D circumference estimates.

Usage:
  python3 scripts/measure-from-photo.py <photo.jpg> --height 168
  python3 scripts/measure-from-photo.py /path/to/front-photo.jpg --height 175

Requirements: mediapipe, torch, torchvision, opencv-python, numpy, Pillow
"""

import argparse
import sys
import math
import json
import numpy as np
import cv2
import mediapipe as mp
import torch

# MediaPipe Pose landmarks
LANDMARKS = {
    'NOSE': 0,
    'LEFT_SHOULDER': 11, 'RIGHT_SHOULDER': 12,
    'LEFT_ELBOW': 13, 'RIGHT_ELBOW': 14,
    'LEFT_WRIST': 15, 'RIGHT_WRIST': 16,
    'LEFT_HIP': 23, 'RIGHT_HIP': 24,
    'LEFT_KNEE': 25, 'RIGHT_KNEE': 26,
    'LEFT_ANKLE': 27, 'RIGHT_ANKLE': 28,
    'LEFT_HEEL': 29, 'RIGHT_HEEL': 30,
    'LEFT_EAR': 7, 'RIGHT_EAR': 8,
}


def load_midas():
    """Load MiDaS depth estimation model."""
    model_type = "MiDaS_small"  # Fast, works on CPU/MPS
    midas = torch.hub.load("intel-isl/MiDaS", model_type, trust_repo=True)

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    midas.to(device)
    midas.eval()

    midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
    transform = midas_transforms.small_transform

    return midas, transform, device


def get_depth_map(image_bgr, midas, transform, device):
    """Get relative depth map from MiDaS."""
    img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    input_batch = transform(img_rgb).to(device)

    with torch.no_grad():
        prediction = midas(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=image_bgr.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth = prediction.cpu().numpy()
    # Normalize to 0-1 range
    depth = (depth - depth.min()) / (depth.max() - depth.min() + 1e-8)
    return depth


def detect_pose(image_bgr):
    """Detect body landmarks using MediaPipe Pose (Tasks API)."""
    from mediapipe.tasks.python import vision, BaseOptions
    import urllib.request
    import os

    # Download model if not present
    model_path = "/tmp/pose_landmarker_heavy.task"
    if not os.path.exists(model_path):
        print("  Downloading pose model...")
        urllib.request.urlretrieve(
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
            model_path
        )

    options = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        num_poses=1,
        min_pose_detection_confidence=0.5,
    )

    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect(mp_image)

    if not result.pose_landmarks or len(result.pose_landmarks) == 0:
        return None

    h, w = image_bgr.shape[:2]
    pose_landmarks = result.pose_landmarks[0]
    landmarks = {}
    for name, idx in LANDMARKS.items():
        lm = pose_landmarks[idx]
        landmarks[name] = {
            'x': lm.x * w,
            'y': lm.y * h,
            'z': lm.z,
            'visibility': lm.visibility,
            'nx': lm.x,
            'ny': lm.y,
        }

    return landmarks


def pixel_distance(a, b):
    """Euclidean distance between two landmark dicts."""
    return math.sqrt((a['x'] - b['x'])**2 + (a['y'] - b['y'])**2)


def get_depth_at_point(depth_map, x, y, h, w, radius=5):
    """Get average depth value at a point (with small radius for stability)."""
    ix, iy = int(x), int(y)
    ix = max(radius, min(ix, w - radius - 1))
    iy = max(radius, min(iy, h - radius - 1))
    region = depth_map[iy-radius:iy+radius+1, ix-radius:ix+radius+1]
    return float(np.mean(region))


def estimate_measurements(landmarks, depth_map, known_height_cm, img_h, img_w):
    """
    Estimate body measurements from landmarks + depth.

    Strategy:
    1. Use head-to-heel distance for cm/pixel calibration
    2. Use front-view widths for left-right span (a)
    3. Use MiDaS depth for front-to-back depth (b)
    4. Apply elliptical circumference: C = π √(2(a² + b²))
    """

    # ── Calibration ──
    # Head top to heel distance ≈ full height
    nose = landmarks['NOSE']
    l_heel = landmarks['LEFT_HEEL']
    r_heel = landmarks['RIGHT_HEEL']
    heel_y = max(l_heel['y'], r_heel['y'])

    # Add ~12cm above nose for top of head
    head_top_offset_cm = 12
    pixel_height = heel_y - nose['y']
    effective_height_cm = known_height_cm - head_top_offset_cm

    if pixel_height <= 0:
        print("ERROR: Cannot determine height from landmarks")
        return None

    cm_per_pixel = effective_height_cm / pixel_height

    # ── Shoulder Width ──
    l_shoulder = landmarks['LEFT_SHOULDER']
    r_shoulder = landmarks['RIGHT_SHOULDER']
    shoulder_width_px = pixel_distance(l_shoulder, r_shoulder)
    shoulder_width_cm = shoulder_width_px * cm_per_pixel

    # ── Width measurements at key body levels ──
    # For bust/waist/hip, we need the body width at specific Y-positions
    # We'll use contour detection on a body segmentation or estimate from landmarks

    l_hip = landmarks['LEFT_HIP']
    r_hip = landmarks['RIGHT_HIP']
    hip_width_px = pixel_distance(l_hip, r_hip)

    # Bust level: between shoulders and a bit below (roughly shoulder_y + 20% of torso)
    torso_length_px = l_hip['y'] - l_shoulder['y']
    bust_y = l_shoulder['y'] + torso_length_px * 0.25

    # Waist level: narrowest point, roughly 55% down the torso
    waist_y = l_shoulder['y'] + torso_length_px * 0.55

    # Bust width: shoulders define the outer edge at bust level
    # Bust is slightly wider than shoulder-to-shoulder for women
    bust_width_cm = shoulder_width_cm * 1.05

    # Waist width: typically narrower than both bust and hips
    # Interpolate between shoulder and hip width, scaled down
    hip_width_cm = hip_width_px * cm_per_pixel
    waist_width_cm = min(bust_width_cm, hip_width_cm) * 0.85

    # ── Depth estimation using MiDaS ──
    # Get depth values at bust, waist, and hip levels
    # The depth gives us the front-to-back dimension

    body_center_x = (l_shoulder['x'] + r_shoulder['x']) / 2

    depth_bust = get_depth_at_point(depth_map, body_center_x, bust_y, img_h, img_w)
    depth_waist = get_depth_at_point(depth_map, body_center_x, waist_y, img_h, img_w)
    depth_hip = get_depth_at_point(depth_map, body_center_x, l_hip['y'], img_h, img_w)

    # MiDaS gives relative depth (closer = higher value)
    # We use it to estimate the depth-to-width ratio at each level
    # Higher depth value = body is closer to camera = larger depth dimension

    # Base depth ratio (from anthropometric averages)
    # Female body: depth ≈ 60-70% of width at bust, 55-65% at waist, 65-75% at hip
    base_depth_ratios = {
        'bust': 0.65,
        'waist': 0.60,
        'hip': 0.70,
    }

    # Adjust ratios based on MiDaS depth differences
    # If bust depth is higher than waist depth, bust is more protruding
    avg_depth = (depth_bust + depth_waist + depth_hip) / 3
    bust_depth_adj = 1 + (depth_bust - avg_depth) * 0.5
    waist_depth_adj = 1 + (depth_waist - avg_depth) * 0.5
    hip_depth_adj = 1 + (depth_hip - avg_depth) * 0.5

    bust_depth_ratio = base_depth_ratios['bust'] * bust_depth_adj
    waist_depth_ratio = base_depth_ratios['waist'] * waist_depth_adj
    hip_depth_ratio = base_depth_ratios['hip'] * hip_depth_adj

    # ── Circumference estimation ──
    # Elliptical approximation: C ≈ π √(2(a² + b²))
    # where a = half-width, b = half-depth

    def elliptical_circumference(width_cm, depth_ratio):
        a = width_cm / 2
        b = a * depth_ratio
        return math.pi * math.sqrt(2 * (a**2 + b**2))

    bust_cm = elliptical_circumference(bust_width_cm, bust_depth_ratio)
    waist_cm = elliptical_circumference(waist_width_cm, waist_depth_ratio)
    hip_cm = elliptical_circumference(hip_width_cm, hip_depth_ratio)

    # ── Arm length ──
    l_elbow = landmarks['LEFT_ELBOW']
    l_wrist = landmarks['LEFT_WRIST']
    arm_upper_px = pixel_distance(l_shoulder, l_elbow)
    arm_lower_px = pixel_distance(l_elbow, l_wrist)
    arm_length_cm = (arm_upper_px + arm_lower_px) * cm_per_pixel

    # ── Inseam ──
    l_ankle = landmarks['LEFT_ANKLE']
    inseam_px = pixel_distance(l_hip, l_ankle)
    inseam_cm = inseam_px * cm_per_pixel

    # ── Confidence ──
    key_landmarks = [l_shoulder, r_shoulder, l_hip, r_hip, landmarks['NOSE'], l_heel]
    avg_visibility = sum(lm['visibility'] for lm in key_landmarks) / len(key_landmarks)

    return {
        'bust_cm': round(bust_cm, 1),
        'waist_cm': round(waist_cm, 1),
        'hip_cm': round(hip_cm, 1),
        'shoulder_cm': round(shoulder_width_cm, 1),
        'height_cm': known_height_cm,
        'arm_length_cm': round(arm_length_cm, 1),
        'inseam_cm': round(inseam_cm, 1),
        'confidence': round(avg_visibility, 2),
        'depth_info': {
            'bust_depth_ratio': round(bust_depth_ratio, 3),
            'waist_depth_ratio': round(waist_depth_ratio, 3),
            'hip_depth_ratio': round(hip_depth_ratio, 3),
        }
    }


def visualize(image_bgr, landmarks, measurements, output_path):
    """Draw landmarks and measurements on image."""
    vis = image_bgr.copy()
    h, w = vis.shape[:2]

    # Draw skeleton
    connections = [
        ('LEFT_SHOULDER', 'RIGHT_SHOULDER'),
        ('LEFT_SHOULDER', 'LEFT_ELBOW'), ('LEFT_ELBOW', 'LEFT_WRIST'),
        ('RIGHT_SHOULDER', 'RIGHT_ELBOW'), ('RIGHT_ELBOW', 'RIGHT_WRIST'),
        ('LEFT_SHOULDER', 'LEFT_HIP'), ('RIGHT_SHOULDER', 'RIGHT_HIP'),
        ('LEFT_HIP', 'RIGHT_HIP'),
        ('LEFT_HIP', 'LEFT_KNEE'), ('LEFT_KNEE', 'LEFT_ANKLE'),
        ('RIGHT_HIP', 'RIGHT_KNEE'), ('RIGHT_KNEE', 'RIGHT_ANKLE'),
    ]

    for a, b in connections:
        if a in landmarks and b in landmarks:
            pt1 = (int(landmarks[a]['x']), int(landmarks[a]['y']))
            pt2 = (int(landmarks[b]['x']), int(landmarks[b]['y']))
            cv2.line(vis, pt1, pt2, (0, 105, 232), 2)

    # Draw key points
    for name, lm in landmarks.items():
        pt = (int(lm['x']), int(lm['y']))
        cv2.circle(vis, pt, 5, (0, 105, 232), -1)

    # Draw measurement labels
    y_offset = 30
    for label, value in [
        ('Bust', measurements['bust_cm']),
        ('Waist', measurements['waist_cm']),
        ('Hip', measurements['hip_cm']),
        ('Shoulder', measurements['shoulder_cm']),
        ('Arm', measurements['arm_length_cm']),
        ('Confidence', f"{measurements['confidence']*100:.0f}%"),
    ]:
        cv2.putText(vis, f"{label}: {value}cm" if isinstance(value, (int, float)) else f"{label}: {value}",
                    (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 105, 232), 2)
        y_offset += 30

    cv2.imwrite(output_path, vis)
    return output_path


def main():
    parser = argparse.ArgumentParser(description='Estimate body measurements from a photo')
    parser.add_argument('photo', help='Path to front-facing photo')
    parser.add_argument('--height', type=float, required=True, help='Actual height in cm')
    parser.add_argument('--output', '-o', help='Output visualization path')
    parser.add_argument('--json', action='store_true', help='Output measurements as JSON')
    args = parser.parse_args()

    # Load image
    img = cv2.imread(args.photo)
    if img is None:
        print(f"ERROR: Cannot load image: {args.photo}")
        sys.exit(1)

    h, w = img.shape[:2]
    print(f"Image: {w}x{h}")

    # Step 1: Detect pose
    print("Detecting pose landmarks...")
    landmarks = detect_pose(img)
    if not landmarks:
        print("ERROR: No person detected in the image")
        sys.exit(1)
    print(f"  Found {len(landmarks)} landmarks (avg visibility: {sum(l['visibility'] for l in landmarks.values())/len(landmarks):.2f})")

    # Step 2: Use MediaPipe's z-coordinates as depth proxy (skip MiDaS for speed)
    print("Using MediaPipe 3D landmarks for depth estimation...")
    # Create a simple depth map from z-coordinates
    depth_map = np.zeros((h, w), dtype=np.float32)
    # MediaPipe z uses the midpoint of hips as origin, with values relative to image width
    # We just need relative depth at key body points, which landmarks already provide
    for name, lm in landmarks.items():
        ix, iy = int(min(lm['x'], w-1)), int(min(lm['y'], h-1))
        # Z is negative when closer to camera in MediaPipe
        depth_map[max(0,iy-10):min(h,iy+10), max(0,ix-10):min(w,ix+10)] = 0.5 - lm['z']
    # Normalize
    if depth_map.max() > depth_map.min():
        depth_map = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min())

    # Step 3: Calculate measurements
    print("Calculating measurements...")
    measurements = estimate_measurements(landmarks, depth_map, args.height, h, w)
    if not measurements:
        print("ERROR: Could not calculate measurements")
        sys.exit(1)

    # Output
    if args.json:
        print(json.dumps(measurements, indent=2))
    else:
        print(f"\n{'='*40}")
        print(f"ESTIMATED MEASUREMENTS")
        print(f"{'='*40}")
        print(f"  Bust:     {measurements['bust_cm']} cm")
        print(f"  Waist:    {measurements['waist_cm']} cm")
        print(f"  Hip:      {measurements['hip_cm']} cm")
        print(f"  Shoulder: {measurements['shoulder_cm']} cm")
        print(f"  Height:   {measurements['height_cm']} cm")
        print(f"  Arm:      {measurements['arm_length_cm']} cm")
        print(f"  Inseam:   {measurements['inseam_cm']} cm")
        print(f"  Confidence: {measurements['confidence']*100:.0f}%")
        print(f"\n  Depth ratios: bust={measurements['depth_info']['bust_depth_ratio']:.2f}, "
              f"waist={measurements['depth_info']['waist_depth_ratio']:.2f}, "
              f"hip={measurements['depth_info']['hip_depth_ratio']:.2f}")

    # Visualization
    if args.output:
        out = visualize(img, landmarks, measurements, args.output)
        print(f"\nVisualization saved: {out}")

    return measurements


if __name__ == '__main__':
    main()
