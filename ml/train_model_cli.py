#!/usr/bin/env python3
"""
模型訓練 CLI 工具
支援非互動式訓練、模型轉檔、自動部署
"""

import os
import sys
import json
import argparse
import pickle
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np
from sklearn.ensemble import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error

# 假設已有的訓練資料載入函數
def load_training_data(data_dir: str) -> Tuple[List[Dict], np.ndarray, np.ndarray]:
    """
    從指定目錄載入訓練資料
    
    Args:
        data_dir: 訓練資料目錄（包含 CSV/JSON 檔案）
    
    Returns:
        (records, X, y) - 記錄、特徵、標籤
    """
    data_path = Path(data_dir)
    
    if not data_path.exists():
        raise FileNotFoundError(f"資料目錄不存在: {data_dir}")
    
    records = []
    
    # 載入 JSON 檔案
    json_files = list(data_path.glob('*.json'))
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    records.extend(data)
                elif isinstance(data, dict) and 'records' in data:
                    records.extend(data['records'])
        except Exception as e:
            print(f"⚠️ 載入 {json_file} 失敗: {e}")
    
    if not records:
        raise ValueError(f"未找到訓練資料: {data_dir}")
    
    print(f"✅ 已載入 {len(records)} 筆訓練記錄")
    
    # 提取特徵與標籤
    X, y = extract_features_and_labels(records)
    
    return records, X, y


def extract_features_and_labels(records: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
    """
    從記錄中提取特徵與標籤
    
    Args:
        records: 訓練記錄清單
    
    Returns:
        (X, y) - 特徵矩陣與標籤向量
    """
    # 定義特徵欄位
    feature_fields = [
        'hcuYesRatio', 'hcuPartialRatio', 'hcuNoRatio',
        'titleIntentMatch', 'firstParagraphAnswerQuality', 'qaFormatScore',
        'wordCountNorm', 'topicCohesion', 'semanticParagraphFocus',
        'referenceKeywordNorm', 'actionableScoreNorm',
        'avgSentenceLengthNorm', 'longParagraphPenalty',
        'listCount', 'tableCount',
        'authorInfoPresent', 'brandEntityClarity', 'externalCitationCount',
        'socialMediaLinksPresent', 'reviewRatingPresent',
        'semanticNaturalness', 'paragraphExtractability', 'richSnippetFormat',
        'citabilityTrustScore', 'multimediaSupport'
    ]
    
    X_list = []
    y_list = []
    
    for record in records:
        # 提取特徵
        features = record.get('features', {})
        feature_vector = []
        
        for field in feature_fields:
            value = features.get(field, 0)
            # 確保值在 0-1 範圍內
            if isinstance(value, (int, float)):
                feature_vector.append(max(0, min(1, float(value))))
            else:
                feature_vector.append(0)
        
        # 提取標籤（目標分數）
        target_score = record.get('target_score')
        if target_score is not None:
            X_list.append(feature_vector)
            y_list.append(float(target_score))
    
    if not X_list:
        raise ValueError("未找到有效的訓練資料")
    
    X = np.array(X_list)
    y = np.array(y_list)
    
    print(f"✅ 特徵提取完成: {X.shape[0]} 筆記錄, {X.shape[1]} 個特徵")
    
    return X, y


def train_model(X: np.ndarray, y: np.ndarray, test_size: float = 0.2) -> Tuple[XGBRegressor, Dict]:
    """
    訓練 XGBoost 模型
    
    Args:
        X: 特徵矩陣
        y: 標籤向量
        test_size: 測試集比例
    
    Returns:
        (model, metrics) - 訓練好的模型與評估指標
    """
    print("🤖 開始訓練模型...")
    
    # 分割訓練/測試集
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )
    
    print(f"  訓練集: {X_train.shape[0]} 筆")
    print(f"  測試集: {X_test.shape[0]} 筆")
    
    # 訓練模型
    model = XGBRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # 評估模型
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    
    metrics = {
        'train_mse': float(mean_squared_error(y_train, y_pred_train)),
        'test_mse': float(mean_squared_error(y_test, y_pred_test)),
        'train_rmse': float(np.sqrt(mean_squared_error(y_train, y_pred_train))),
        'test_rmse': float(np.sqrt(mean_squared_error(y_test, y_pred_test))),
        'train_mae': float(mean_absolute_error(y_train, y_pred_train)),
        'test_mae': float(mean_absolute_error(y_test, y_pred_test)),
        'train_r2': float(r2_score(y_train, y_pred_train)),
        'test_r2': float(r2_score(y_test, y_pred_test))
    }
    
    print(f"✅ 模型訓練完成")
    print(f"  訓練 RMSE: {metrics['train_rmse']:.4f}")
    print(f"  測試 RMSE: {metrics['test_rmse']:.4f}")
    print(f"  訓練 R²: {metrics['train_r2']:.4f}")
    print(f"  測試 R²: {metrics['test_r2']:.4f}")
    
    return model, metrics


def extract_model_coefficients(model: XGBRegressor) -> Dict:
    """
    從訓練好的模型提取係數與配置
    
    Args:
        model: 訓練好的 XGBoost 模型
    
    Returns:
        模型配置字典
    """
    # 提取特徵重要性
    feature_importance = model.get_booster().get_score(importance_type='weight')
    
    # 提取樹結構（簡化版本）
    booster = model.get_booster()
    
    config = {
        'model_type': 'xgboost',
        'n_estimators': model.n_estimators,
        'max_depth': model.max_depth,
        'learning_rate': float(model.learning_rate),
        'subsample': model.subsample,
        'colsample_bytree': model.colsample_bytree,
        'feature_importance': feature_importance,
        'feature_names': [
            'hcuYesRatio', 'hcuPartialRatio', 'hcuNoRatio',
            'titleIntentMatch', 'firstParagraphAnswerQuality', 'qaFormatScore',
            'wordCountNorm', 'topicCohesion', 'semanticParagraphFocus',
            'referenceKeywordNorm', 'actionableScoreNorm',
            'avgSentenceLengthNorm', 'longParagraphPenalty',
            'listCount', 'tableCount',
            'authorInfoPresent', 'brandEntityClarity', 'externalCitationCount',
            'socialMediaLinksPresent', 'reviewRatingPresent',
            'semanticNaturalness', 'paragraphExtractability', 'richSnippetFormat',
            'citabilityTrustScore', 'multimediaSupport'
        ]
    }
    
    return config


def save_model(model: XGBRegressor, output_path: str) -> str:
    """
    保存訓練好的模型
    
    Args:
        model: 訓練好的模型
        output_path: 輸出路徑
    
    Returns:
        保存的檔案路徑
    """
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'wb') as f:
        pickle.dump(model, f)
    
    print(f"✅ 模型已保存: {output_path}")
    return output_path


def generate_model_config(
    model: XGBRegressor,
    metrics: Dict,
    records_count: int,
    output_path: str
) -> str:
    """
    生成模型配置檔案（用於 Worker 部署）
    
    Args:
        model: 訓練好的模型
        metrics: 評估指標
        records_count: 訓練記錄數
        output_path: 輸出路徑
    
    Returns:
        配置檔案路徑
    """
    coefficients = extract_model_coefficients(model)
    
    config = {
        'version': f"2025-11-11-ml-v{datetime.now().strftime('%H%M%S')}",
        'createdAt': datetime.now().isoformat(),
        'description': 'XGBoost scoring model trained on SERP data',
        'trainingMetrics': metrics,
        'trainingRecords': records_count,
        'modelConfig': coefficients,
        'deployment': {
            'type': 'xgboost',
            'format': 'json',
            'compatibility': 'scoring-model.js v2.0+'
        }
    }
    
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 模型配置已生成: {output_path}")
    return output_path


def generate_deployment_script(
    model_config_path: str,
    output_path: str
) -> str:
    """
    生成部署腳本（用於更新 scoring-model.js）
    
    Args:
        model_config_path: 模型配置檔案路徑
        output_path: 輸出腳本路徑
    
    Returns:
        部署腳本路徑
    """
    with open(model_config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    script = f"""#!/bin/bash
# 自動部署腳本 - 更新 scoring-model.js
# 生成時間: {datetime.now().isoformat()}

echo "📦 開始部署新模型..."

# 1. 備份現有模型
cp functions/api/scoring-model.js functions/api/scoring-model.js.backup

# 2. 更新模型配置
# 此處應將 {model_config_path} 的內容合併到 scoring-model.js

# 3. 驗證語法
node -c functions/api/scoring-model.js

# 4. 部署到 Cloudflare
wrangler deploy

# 5. 驗證部署
curl -X GET "https://api.example.com/api/health"

echo "✅ 部署完成"
echo "模型版本: {config['version']}"
echo "訓練記錄: {config['trainingRecords']}"
echo "測試 R²: {config['trainingMetrics']['test_r2']:.4f}"
"""
    
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(script)
    
    # 設定執行權限
    os.chmod(output_path, 0o755)
    
    print(f"✅ 部署腳本已生成: {output_path}")
    return output_path


def main():
    """主程式"""
    parser = argparse.ArgumentParser(
        description='非互動式模型訓練工具'
    )
    parser.add_argument(
        '--data-dir',
        required=True,
        help='訓練資料目錄'
    )
    parser.add_argument(
        '--output-dir',
        default='./ml/models',
        help='輸出目錄'
    )
    parser.add_argument(
        '--model-name',
        default='xgboost_model',
        help='模型名稱'
    )
    parser.add_argument(
        '--test-size',
        type=float,
        default=0.2,
        help='測試集比例'
    )
    parser.add_argument(
        '--deploy',
        action='store_true',
        help='生成部署腳本'
    )
    
    args = parser.parse_args()
    
    try:
        # 1. 載入訓練資料
        print("📥 載入訓練資料...")
        records, X, y = load_training_data(args.data_dir)
        
        # 2. 訓練模型
        print("\n🤖 訓練模型...")
        model, metrics = train_model(X, y, test_size=args.test_size)
        
        # 3. 保存模型
        print("\n💾 保存模型...")
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        model_path = output_dir / f"{args.model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        save_model(model, str(model_path))
        
        # 4. 生成模型配置
        print("\n📋 生成模型配置...")
        config_path = output_dir / f"{args.model_name}_config_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        generate_model_config(model, metrics, len(records), str(config_path))
        
        # 5. 生成部署腳本（可選）
        if args.deploy:
            print("\n🚀 生成部署腳本...")
            deploy_script_path = output_dir / f"deploy_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sh"
            generate_deployment_script(str(config_path), str(deploy_script_path))
        
        # 6. 生成摘要
        print("\n📊 訓練摘要")
        print(f"  訓練記錄: {len(records)}")
        print(f"  特徵數: {X.shape[1]}")
        print(f"  測試 RMSE: {metrics['test_rmse']:.4f}")
        print(f"  測試 R²: {metrics['test_r2']:.4f}")
        print(f"  模型路徑: {model_path}")
        print(f"  配置路徑: {config_path}")
        
        print("\n✅ 訓練完成")
        
    except Exception as e:
        print(f"\n❌ 訓練失敗: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
