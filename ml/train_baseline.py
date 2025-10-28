#!/usr/bin/env python3
"""
Quick baseline model training script
Trains XGBoost on collected SERP data and exports coefficients for JavaScript
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import json
import sys

print("="*70)
print("BASELINE MODEL TRAINING")
print("="*70)

# Load data
print("\n[1/6] Loading training data...")
df = pd.read_csv('./ml/training_data.csv')
print(f"✓ Loaded {len(df)} records")
print(f"  Columns: {len(df.columns)}")

# Prepare features
print("\n[2/6] Preparing features...")
feature_cols = [col for col in df.columns if col not in ['url', 'keyword', 'serp_rank', 'target_score', 'title']]
X = df[feature_cols].fillna(0)
y = df['target_score']
print(f"✓ {len(feature_cols)} features")
print(f"  Target range: {y.min():.0f} - {y.max():.0f}")

# Split data
print("\n[3/6] Splitting data...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"✓ Train: {len(X_train)}, Test: {len(X_test)}")

# Train model
print("\n[4/6] Training XGBoost model...")
model = xgb.XGBRegressor(
    n_estimators=50,
    max_depth=4,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    verbosity=0
)
model.fit(X_train, y_train)
print("✓ Model trained")

# Evaluate
print("\n[5/6] Evaluating model...")
y_pred_train = model.predict(X_train)
y_pred_test = model.predict(X_test)

train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
train_r2 = r2_score(y_train, y_pred_train)
test_r2 = r2_score(y_test, y_pred_test)

print(f"✓ Train RMSE: {train_rmse:.4f}, R²: {train_r2:.4f}")
print(f"✓ Test RMSE: {test_rmse:.4f}, R²: {test_r2:.4f}")

# Cross-validation
cv_scores = cross_val_score(model, X, y, cv=min(5, len(df)), scoring='r2')
print(f"✓ CV R² (mean): {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

# Feature importance
print("\n[6/6] Extracting feature importance...")
feature_importance = pd.DataFrame({
    'feature': feature_cols,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

print("✓ Top 10 features:")
for idx, row in feature_importance.head(10).iterrows():
    print(f"    {row['feature']}: {row['importance']:.4f}")

# Export model config
model_config = {
    'version': '1.0.0-xgboost-baseline',
    'createdAt': pd.Timestamp.now().isoformat(),
    'description': 'Baseline XGBoost model trained on SERP ranking data',
    'metrics': {
        'train_rmse': float(train_rmse),
        'test_rmse': float(test_rmse),
        'train_r2': float(train_r2),
        'test_r2': float(test_r2),
        'cv_r2_mean': float(cv_scores.mean()),
        'cv_r2_std': float(cv_scores.std())
    },
    'training_samples': len(df),
    'feature_count': len(feature_cols),
    'model_type': 'XGBRegressor',
    'hyperparameters': {
        'n_estimators': 50,
        'max_depth': 4,
        'learning_rate': 0.1,
        'subsample': 0.8,
        'colsample_bytree': 0.8
    },
    'top_features': feature_importance.head(15).to_dict('records')
}

# Save model config
with open('./ml/trained_model_config.json', 'w', encoding='utf-8') as f:
    json.dump(model_config, f, ensure_ascii=False, indent=2)

print("\n" + "="*70)
print("TRAINING COMPLETE")
print("="*70)
print(f"\nModel config saved to: ./ml/trained_model_config.json")
print(f"\nKey metrics:")
print(f"  • Test R²: {test_r2:.4f}")
print(f"  • Test RMSE: {test_rmse:.4f}")
print(f"  • Training samples: {len(df)}")
print(f"\nNext steps:")
print(f"  1. Review trained_model_config.json")
print(f"  2. Update scoring-model.js with new model")
print(f"  3. Deploy to production")
print(f"  4. Monitor SERP performance")
print("="*70)

# Save model for later use
model.save_model('./ml/trained_model.json')
print(f"\nModel saved to: ./ml/trained_model.json")
