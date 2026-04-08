#!/usr/bin/env python3
"""
Fine-tune Gemma 4 E2B (vision) for body measurement prediction.

Task: photo + height → bust_cm, waist_cm, hip_cm
Dataset: ud-biometrics/body-measurements-image-dataset (13K+ photos, 17+ measurements)

Requirements on A100:
  pip install unsloth datasets pillow
  # unsloth handles: transformers, trl, peft, bitsandbytes

Usage:
  python3 train-body-measurement.py

VRAM: ~4-6GB at 4-bit quantization (fits alongside other training)
Time: ~30-60 min on A100
"""

import json
import os
import sys

# ─── Install check ───
try:
    from unsloth import FastVisionModel
    from datasets import load_dataset
    from trl import SFTTrainer, SFTConfig
    import torch
except ImportError:
    print("Installing dependencies...")
    os.system("pip install unsloth datasets pillow")
    from unsloth import FastVisionModel
    from datasets import load_dataset
    from trl import SFTTrainer, SFTConfig
    import torch

print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'No GPU'}")
print(f"VRAM free: {torch.cuda.mem_get_info()[0] / 1e9:.1f} GB" if torch.cuda.is_available() else "")

# ─── Configuration ───
MODEL_NAME = "unsloth/gemma-4-4b-it"  # 4B vision model, good balance of size/quality
MAX_SEQ_LENGTH = 1024
EPOCHS = 3
BATCH_SIZE = 2
GRAD_ACCUM = 4
LR = 2e-4
OUTPUT_DIR = "./body-measurement-model"

# ─── Load Model ───
print("\n1. Loading model...")
model, tokenizer = FastVisionModel.from_pretrained(
    MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
    dtype=None,  # auto-detect
)

model = FastVisionModel.get_peft_model(
    model,
    finetune_vision_layers=True,
    finetune_language_layers=True,
    finetune_attention_modules=True,
    finetune_mlp_modules=True,
    r=16,
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    random_state=42,
)

print(f"  Model loaded: {MODEL_NAME}")
print(f"  Trainable params: {sum(p.numel() for p in model.parameters() if p.requires_grad):,}")

# ─── Load Dataset ───
print("\n2. Loading dataset...")
dataset = load_dataset("ud-biometrics/body-measurements-image-dataset", split="train")
print(f"  Total samples: {len(dataset)}")
print(f"  Columns: {dataset.column_names}")

# Inspect first sample to understand structure
sample = dataset[0]
print(f"  Sample keys: {list(sample.keys())}")
for k, v in sample.items():
    if isinstance(v, (int, float, str)):
        print(f"    {k}: {v}")
    elif hasattr(v, 'size'):
        print(f"    {k}: Image {v.size}")
    else:
        print(f"    {k}: {type(v).__name__}")

# ─── Detect measurement columns ───
measurement_cols = []
for col in dataset.column_names:
    col_lower = col.lower()
    if any(kw in col_lower for kw in ['bust', 'chest', 'waist', 'hip', 'shoulder', 'height',
                                        'arm', 'inseam', 'neck', 'thigh', 'circumference',
                                        'length', 'width', 'girth']):
        # Check if numeric
        val = sample.get(col)
        if isinstance(val, (int, float)):
            measurement_cols.append(col)

print(f"\n  Measurement columns found: {measurement_cols}")

# Find image column
image_col = None
for col in dataset.column_names:
    val = sample.get(col)
    if hasattr(val, 'size') or hasattr(val, 'mode'):  # PIL Image
        image_col = col
        break
    if col.lower() in ('image', 'photo', 'img', 'picture', 'front', 'front_image'):
        image_col = col
        break

print(f"  Image column: {image_col}")

if not image_col or not measurement_cols:
    print("\nERROR: Could not identify image and measurement columns.")
    print("Dataset columns:", dataset.column_names)
    print("\nLet me dump 3 samples for you to inspect:")
    for i in range(min(3, len(dataset))):
        s = dataset[i]
        print(f"\n  Sample {i}:")
        for k, v in s.items():
            if hasattr(v, 'size'):
                print(f"    {k}: Image({v.size})")
            else:
                print(f"    {k}: {repr(v)[:100]}")
    sys.exit(1)

# ─── Find key measurements ───
# Map to standard names
bust_col = next((c for c in measurement_cols if 'bust' in c.lower() or 'chest' in c.lower()), None)
waist_col = next((c for c in measurement_cols if 'waist' in c.lower()), None)
hip_col = next((c for c in measurement_cols if 'hip' in c.lower()), None)
height_col = next((c for c in measurement_cols if 'height' in c.lower()), None)

print(f"\n  Key columns: bust={bust_col}, waist={waist_col}, hip={hip_col}, height={height_col}")

# ─── Format training data ───
print("\n3. Formatting training data...")

def format_sample(sample):
    """Convert dataset sample to chat format for vision model fine-tuning."""
    image = sample[image_col]

    # Input: image + height (if available)
    height_text = f" Their height is {sample[height_col]}cm." if height_col and sample.get(height_col) else ""

    # Output: measurements
    measurements = {}
    if bust_col and sample.get(bust_col): measurements['bust_cm'] = round(float(sample[bust_col]), 1)
    if waist_col and sample.get(waist_col): measurements['waist_cm'] = round(float(sample[waist_col]), 1)
    if hip_col and sample.get(hip_col): measurements['hip_cm'] = round(float(sample[hip_col]), 1)

    # Add any other measurements
    for col in measurement_cols:
        if col not in (bust_col, waist_col, hip_col, height_col):
            val = sample.get(col)
            if val and isinstance(val, (int, float)) and val > 0:
                clean_name = col.lower().replace(' ', '_')
                measurements[clean_name] = round(float(val), 1)

    output_text = json.dumps(measurements)

    return {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": f"Analyze this person's body and estimate their body measurements in centimeters.{height_text} Return a JSON object with bust_cm, waist_cm, hip_cm, and any other measurements you can determine."}
                ]
            },
            {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": output_text}
                ]
            }
        ]
    }

# Format all samples
formatted = dataset.map(format_sample, remove_columns=dataset.column_names)
print(f"  Formatted {len(formatted)} samples")

# Split into train/eval
split = formatted.train_test_split(test_size=0.1, seed=42)
train_data = split['train']
eval_data = split['test']
print(f"  Train: {len(train_data)}, Eval: {len(eval_data)}")

# ─── Train ───
print("\n4. Starting training...")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_data,
    eval_dataset=eval_data,
    args=SFTConfig(
        output_dir=OUTPUT_DIR,
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        learning_rate=LR,
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=100,
        save_strategy="steps",
        save_steps=200,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        max_seq_length=MAX_SEQ_LENGTH,
        dataset_text_field="",
        dataset_kwargs={"skip_prepare_dataset": True},
        report_to="none",
        seed=42,
    ),
)

# Check GPU usage before training
if torch.cuda.is_available():
    print(f"  VRAM before training: {torch.cuda.memory_allocated()/1e9:.1f} GB allocated")

trainer.train()

# ─── Save ───
print("\n5. Saving model...")
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f"  Saved to: {OUTPUT_DIR}")

# ─── Evaluate ───
print("\n6. Evaluating on test set...")

FastVisionModel.for_inference(model)

errors = {'bust': [], 'waist': [], 'hip': []}
tested = 0

for i in range(min(50, len(eval_data))):
    sample = dataset[split['test'].indices[i]] if hasattr(split['test'], 'indices') else eval_data[i]

    image = sample[image_col] if image_col in sample else None
    if not image:
        continue

    # Get ground truth
    gt_bust = float(sample.get(bust_col, 0)) if bust_col else 0
    gt_waist = float(sample.get(waist_col, 0)) if waist_col else 0
    gt_hip = float(sample.get(hip_col, 0)) if hip_col else 0

    if not gt_bust or not gt_waist:
        continue

    # Predict
    height_text = f" Their height is {sample[height_col]}cm." if height_col and sample.get(height_col) else ""

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": f"Analyze this person's body and estimate their body measurements in centimeters.{height_text} Return a JSON object with bust_cm, waist_cm, hip_cm."}
            ]
        }
    ]

    inputs = tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to("cuda")

    with torch.no_grad():
        output = model.generate(
            **inputs if isinstance(inputs, dict) else {"input_ids": inputs},
            max_new_tokens=200,
            temperature=0.1,
        )

    response = tokenizer.decode(output[0], skip_special_tokens=True)

    # Parse JSON from response
    try:
        # Find JSON in response
        import re
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            pred = json.loads(json_match.group())
            pred_bust = pred.get('bust_cm', 0)
            pred_waist = pred.get('waist_cm', 0)
            pred_hip = pred.get('hip_cm', 0)

            if pred_bust: errors['bust'].append(abs(pred_bust - gt_bust))
            if pred_waist: errors['waist'].append(abs(pred_waist - gt_waist))
            if pred_hip: errors['hip'].append(abs(pred_hip - gt_hip))
            tested += 1
    except:
        pass

print(f"\n  Evaluated {tested} samples")
if tested > 0:
    for measure, errs in errors.items():
        if errs:
            avg = sum(errs) / len(errs)
            median = sorted(errs)[len(errs)//2]
            within_2cm = sum(1 for e in errs if e <= 2) / len(errs) * 100
            within_5cm = sum(1 for e in errs if e <= 5) / len(errs) * 100
            print(f"  {measure:>6}: avg error {avg:.1f}cm, median {median:.1f}cm, "
                  f"within 2cm: {within_2cm:.0f}%, within 5cm: {within_5cm:.0f}%")

print("\n" + "=" * 60)
print("TRAINING COMPLETE")
print(f"Model saved to: {OUTPUT_DIR}")
print("=" * 60)
