#!/usr/bin/env python3
"""
Export trained XGBoost model to JavaScript-compatible format
Converts model to simplified linear approximation for scoring-model.js
"""

import json
from pathlib import Path

import pandas as pd

print('Exporting model to JavaScript format...')

CONFIG_PATH = Path('./ml/trained_model_config.json')

if not CONFIG_PATH.exists():
    raise SystemExit('找不到訓練後的模型組態，請先執行 train_baseline.py')

with CONFIG_PATH.open('r', encoding='utf-8') as f:
    model_config = json.load(f)

dataset_meta = model_config.get('dataset', {})
dataset_path = Path(dataset_meta.get('path', './ml/training_prepared.csv'))

if not dataset_path.exists():
    raise SystemExit(f'找不到資料集：{dataset_path}')

df = pd.read_csv(dataset_path)

exclude_columns = {
    'url',
    'keyword',
    'title',
}
exclude_columns.update(set(model_config.get('targets', {}).keys()))

feature_cols = [col for col in df.columns if col not in exclude_columns]

targets = {}
for target_name, payload in model_config.get('targets', {}).items():
    feature_importance = {
        item['feature']: item['importance']
        for item in payload.get('feature_importance_top20', [])
        if isinstance(item, dict) and 'feature' in item and 'importance' in item
    }

    targets[target_name] = {
        'metrics': payload.get('metrics', {}),
        'featureImportance': feature_importance,
        'modelPath': payload.get('model_path')
    }

js_export = {
    'version': model_config.get('version'),
    'createdAt': model_config.get('createdAt'),
    'description': model_config.get('description'),
    'features': feature_cols,
    'dataset': dataset_meta,
    'hyperparameters': model_config.get('hyperparameters', {}),
    'targets': targets
}

export_path = Path('./ml/model_export.json')
export_path.write_text(json.dumps(js_export, ensure_ascii=False, indent=2), encoding='utf-8')

print(f'✓ Model exported to {export_path}')
print('\nExport summary:')
print(f"  Version: {js_export.get('version')}")
print(f"  Features: {len(feature_cols)}")
print(f"  Training samples: {dataset_meta.get('records')}")
print(f"  Targets: {', '.join(targets.keys()) or '無'}")
print('\nNext: Update scoring-model.js to use this model config')
