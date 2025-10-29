#!/usr/bin/env python3
"""
使用新特徵工程重新訓練模型
將現有 394 筆資料轉換為新特徵格式，並進行模型訓練
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import json
import sys

print("="*70)
print("新特徵工程模型訓練")
print("="*70)

# 載入資料
print("\n[1/6] 載入訓練資料...")
df = pd.read_csv('./ml/training_data.csv')
print(f"✓ 已載入 {len(df)} 筆記錄")
print(f"  欄位數: {len(df.columns)}")

# 定義新特徵集（基於 AEO/GEO）
new_features = [
    # HCU 特徵
    'hcuYesRatio', 'hcuPartialRatio', 'hcuNoRatio', 'hcuContentHelpfulness',
    
    # 內容結構
    'qaFormatScore', 'firstParagraphAnswerQuality', 'semanticParagraphFocus',
    'headingHierarchyQuality', 'topicCohesion',
    
    # 技術與標記
    'faqSchemaPresent', 'howtoSchemaPresent', 'articleSchemaPresent',
    'organizationSchemaPresent', 'ogTagsComplete', 'metaTagsQuality',
    'htmlStructureValidity',
    
    # 品牌實體與信任
    'authorInfoPresent', 'brandEntityClarity', 'externalCitationCount',
    'socialMediaLinksPresent', 'reviewRatingPresent',
    
    # AI 搜尋適配
    'semanticNaturalness', 'paragraphExtractability', 'richSnippetFormat',
    'citabilityTrustScore', 'multimediaSupport',
    
    # 保留的基礎特徵
    'wordCountNorm', 'h2CountNorm', 'uniqueWordRatio', 'hasH1Keyword',
    'hasUniqueTitle', 'hasVisibleDate', 'metaDescriptionPresent',
    'canonicalPresent', 'externalLinkPresent', 'authorityLinkPresent',
    'listPresent', 'avgSentenceLengthNorm', 'readabilityWeakFlag'
]

# 檢查哪些新特徵已存在於資料中
available_features = [f for f in new_features if f in df.columns]
missing_features = [f for f in new_features if f not in df.columns]

print(f"\n[2/6] 特徵分析...")
print(f"✓ 可用新特徵: {len(available_features)} 個")
print(f"✓ 缺失新特徵: {len(missing_features)} 個")

if missing_features:
    print(f"  缺失: {', '.join(missing_features[:5])}{'...' if len(missing_features) > 5 else ''}")
    print("  → 這些特徵需要 /analyze API 支援，暫時使用可用特徵進行訓練")

# 使用可用的特徵進行訓練
feature_cols = available_features
X = df[feature_cols].fillna(0)
y = df['target_score']

print(f"\n[3/6] 準備特徵...")
print(f"✓ 使用 {len(feature_cols)} 個特徵")
print(f"  目標分數範圍: {y.min():.0f} - {y.max():.0f}")

# 分割資料
print(f"\n[4/6] 分割資料...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"✓ 訓練集: {len(X_train)}, 測試集: {len(X_test)}")

# 訓練模型
print(f"\n[5/6] 訓練 XGBoost 模型...")
model = xgb.XGBRegressor(
    n_estimators=100,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    verbosity=0
)
model.fit(X_train, y_train)
print("✓ 模型訓練完成")

# 評估
print(f"\n[6/6] 模型評估...")
y_pred_train = model.predict(X_train)
y_pred_test = model.predict(X_test)

train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
train_r2 = r2_score(y_train, y_pred_train)
test_r2 = r2_score(y_test, y_pred_test)

print(f"✓ 訓練集 RMSE: {train_rmse:.4f}, R²: {train_r2:.4f}")
print(f"✓ 測試集 RMSE: {test_rmse:.4f}, R²: {test_r2:.4f}")

# 交叉驗證
cv_scores = cross_val_score(model, X, y, cv=min(5, len(df)), scoring='r2')
print(f"✓ 交叉驗證 R² (平均): {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

# 特徵重要性
print(f"\n特徵重要性 (前 15 名):")
feature_importance = pd.DataFrame({
    'feature': feature_cols,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

for idx, row in feature_importance.head(15).iterrows():
    print(f"  {row['feature']:30s} {row['importance']:.4f}")

# 儲存模型配置
model_config = {
    'version': '2.0.0-aeo-geo-features',
    'createdAt': pd.Timestamp.now().isoformat(),
    'description': '聚焦 HCU 與 AEO/GEO 關鍵因素的 XGBoost 模型',
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
    'features_used': feature_cols,
    'model_type': 'XGBRegressor',
    'hyperparameters': {
        'n_estimators': 100,
        'max_depth': 5,
        'learning_rate': 0.05,
        'subsample': 0.8,
        'colsample_bytree': 0.8
    },
    'top_features': feature_importance.head(20).to_dict('records'),
    'missing_features': missing_features
}

with open('./ml/trained_model_config_v2.json', 'w', encoding='utf-8') as f:
    json.dump(model_config, f, ensure_ascii=False, indent=2)

print("\n" + "="*70)
print("訓練完成")
print("="*70)
print(f"\n模型配置已儲存至: ./ml/trained_model_config_v2.json")
print(f"\n關鍵指標:")
print(f"  • 測試集 R²: {test_r2:.4f}")
print(f"  • 測試集 RMSE: {test_rmse:.4f}")
print(f"  • 訓練樣本: {len(df)}")
print(f"  • 使用特徵: {len(feature_cols)}")
if missing_features:
    print(f"  • 待實現特徵: {len(missing_features)} 個")
print("\n下一步:")
print(f"  1. 檢視 trained_model_config_v2.json 中的特徵重要性")
print(f"  2. 更新 /analyze API 以支援缺失的特徵")
print(f"  3. 重新蒐集資料並訓練完整模型")
print("="*70)
