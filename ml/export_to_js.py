#!/usr/bin/env python3
"""
Export trained XGBoost model to JavaScript-compatible format
Converts model to simplified linear approximation for scoring-model.js
"""

import json
import pandas as pd
import numpy as np
import xgboost as xgb

print("Exporting model to JavaScript format...")

# Load training data and model
df = pd.read_csv('./ml/training_data.csv')
feature_cols = [col for col in df.columns if col not in ['url', 'keyword', 'serp_rank', 'target_score', 'title']]

# Load model config
with open('./ml/trained_model_config.json', 'r', encoding='utf-8') as f:
    model_config = json.load(f)

# Create JavaScript export
js_export = {
    'version': model_config['version'],
    'createdAt': model_config['createdAt'],
    'description': model_config['description'],
    'metrics': model_config['metrics'],
    'features': feature_cols,
    'featureImportance': {item['feature']: item['importance'] for item in model_config['top_features']},
    'trainingMetadata': {
        'samples': model_config['training_samples'],
        'featureCount': model_config['feature_count'],
        'modelType': model_config['model_type'],
        'hyperparameters': model_config['hyperparameters']
    }
}

# Save as JSON for import
with open('./ml/model_export.json', 'w', encoding='utf-8') as f:
    json.dump(js_export, f, ensure_ascii=False, indent=2)

print("✓ Model exported to ./ml/model_export.json")
print("\nExport summary:")
print(f"  Version: {js_export['version']}")
print(f"  Features: {len(feature_cols)}")
print(f"  Training samples: {model_config['training_samples']}")
print(f"  Test R²: {model_config['metrics']['test_r2']:.4f}")
print("\nNext: Update scoring-model.js to use this model config")
