#!/usr/bin/env python3
"""
模型訓練 CLI 工具
支援非互動式訓練、模型轉檔、自動部署
"""

import os
import re
import sys
import json
import math
import argparse
import pickle
import tempfile
import subprocess
import urllib.request
import urllib.error
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
from sklearn.ensemble import XGBRegressor
from sklearn.model_selection import train_test_split, KFold
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error


FEATURE_REGISTRY = [
    # HCU ratios
    ('hcuYesRatio', {'type': 'ratio'}),
    ('hcuPartialRatio', {'type': 'ratio'}),
    ('hcuNoRatio', {'type': 'ratio'}),
    # Intent / narrative quality
    ('titleIntentMatch', {'type': 'ratio'}),
    ('firstParagraphAnswerQuality', {'type': 'ratio'}),
    ('qaFormatScore', {'type': 'ratio'}),
    ('topicCohesion', {'type': 'ratio'}),
    ('semanticParagraphFocus', {'type': 'ratio'}),
    ('semanticNaturalness', {'type': 'ratio'}),
    ('paragraphExtractability', {'type': 'ratio'}),
    ('richSnippetFormat', {'type': 'ratio'}),
    ('citabilityTrustScore', {'type': 'ratio'}),
    ('multimediaSupport', {'type': 'ratio'}),
    ('inspectability', {'type': 'ratio'}),
    # Pre-normalized features
    ('wordCountNorm', {'type': 'ratio'}),
    ('referenceKeywordNorm', {'type': 'ratio'}),
    ('actionableScoreNorm', {'type': 'ratio'}),
    ('avgSentenceLengthNorm', {'type': 'ratio'}),
    ('longParagraphPenalty', {'type': 'ratio'}),
    ('brandEntityClarity', {'type': 'ratio'}),
    # Counts (min-max or log scaling)
    ('wordCount', {'type': 'minmax', 'max': 2500}),
    ('paragraphCount', {'type': 'minmax', 'max': 60}),
    ('longParagraphCount', {'type': 'minmax', 'max': 30}),
    ('paragraphAverageLength', {'type': 'inverse_minmax', 'min': 60, 'max': 250}),
    ('avgSentenceLength', {'type': 'inverse_minmax', 'min': 12, 'max': 40}),
    ('listCount', {'type': 'minmax', 'max': 30}),
    ('tableCount', {'type': 'minmax', 'max': 15}),
    ('imageCount', {'type': 'minmax', 'max': 40}),
    ('imageWithAltCount', {'type': 'minmax', 'max': 40}),
    ('externalCitationCount', {'type': 'log', 'scale': 25}),
    ('externalAuthorityLinkCount', {'type': 'log', 'scale': 20}),
    ('externalLinkCount', {'type': 'log', 'scale': 40}),
    ('evidenceCount', {'type': 'log', 'scale': 15}),
    ('recentYearCount', {'type': 'minmax', 'max': 5}),
    ('experienceCueCount', {'type': 'minmax', 'max': 12}),
    ('caseStudyCount', {'type': 'minmax', 'max': 8}),
    ('h1Count', {'type': 'minmax', 'max': 4}),
    ('h2Count', {'type': 'minmax', 'max': 15}),
    ('actionableStepCount', {'type': 'minmax', 'max': 25}),
    ('actionableScore', {'type': 'minmax', 'max': 12}),
    # Unique and experience signals
    ('uniqueWordRatio', {'type': 'ratio'}),
    ('experienceCueNorm', {'type': 'ratio'}),
    ('entityRichnessNorm', {'type': 'ratio'}),
    # Boolean presence flags
    ('authorInfoPresent', {'type': 'boolean'}),
    ('socialMediaLinksPresent', {'type': 'boolean'}),
    ('reviewRatingPresent', {'type': 'boolean'}),
    ('hasFirstPersonNarrative', {'type': 'boolean'}),
    ('hasAuthorInfo', {'type': 'boolean'}),
    ('hasPublisherInfo', {'type': 'boolean'}),
    ('hasPublishedDate', {'type': 'boolean'}),
    ('hasModifiedDate', {'type': 'boolean'}),
    ('hasVisibleDate', {'type': 'boolean'}),
    ('hasFaqSchema', {'type': 'boolean'}),
    ('hasHowToSchema', {'type': 'boolean'}),
    ('hasArticleSchema', {'type': 'boolean'}),
    ('hasOrganizationSchema', {'type': 'boolean'}),
    ('hasCanonical', {'type': 'boolean'}),
    ('hasMetaDescription', {'type': 'boolean'}),
    ('hasChecklistLanguage', {'type': 'boolean'}),
    ('hasNumberedSteps', {'type': 'boolean'})
]

FEATURE_SPECS = {name: spec for name, spec in FEATURE_REGISTRY}
FEATURE_NAMES = [name for name, _ in FEATURE_REGISTRY]


def clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(max_value, float(value)))


def coerce_score(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        if isinstance(value, str):
            value = float(value.strip())
        elif isinstance(value, (int, float)):
            value = float(value)
        else:
            return None
    except (ValueError, TypeError):
        return None

    if not math.isfinite(value):
        return None
    return value


def resolve_feature_value(record: Dict, name: str) -> Any:
    features = record.get('features') or {}
    if name in features:
        return features.get(name)
    # 嘗試回退到頂層欄位
    return record.get(name)


def normalize_feature(name: str, value: Any) -> float:
    spec = FEATURE_SPECS.get(name)
    if spec is None or value is None:
        return 0.0

    try:
        if spec['type'] == 'ratio':
            return clamp(value)
        if spec['type'] == 'boolean':
            if isinstance(value, bool):
                return 1.0 if value else 0.0
            if isinstance(value, (int, float)):
                return 1.0 if value else 0.0
            if isinstance(value, str):
                return 1.0 if value.strip().lower() in {'true', '1', 'yes'} else 0.0
            return 0.0
        if spec['type'] == 'minmax':
            max_val = spec.get('max', 1.0) or 1.0
            if max_val <= 0:
                max_val = 1.0
            return clamp(float(value) / max_val)
        if spec['type'] == 'inverse_minmax':
            min_val = spec.get('min', 0.0)
            max_val = spec.get('max', 1.0)
            span = max(max_val - min_val, 1e-6)
            score = 1.0 - (float(value) - min_val) / span
            return clamp(score)
        if spec['type'] == 'log':
            scale = spec.get('scale', 10.0) or 10.0
            return clamp(math.log1p(max(0.0, float(value))) / math.log1p(scale))
    except (ValueError, TypeError):
        return 0.0

    return 0.0

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
    
    cleaned_records, cleaning_stats = clean_training_records(records)
    print(
        "✅ 已載入 {after} 筆訓練記錄 (移除 {dropped} 筆無效，重複 {dups} 筆)".format(
            after=cleaning_stats['after_deduplicate'],
            dropped=cleaning_stats['dropped_invalid'],
            dups=cleaning_stats['deduplicated']
        )
    )
    
    # 提取特徵與標籤
    X, y = extract_features_and_labels(cleaned_records)
    
    return cleaned_records, X, y


def extract_features_and_labels(records: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
    """
    從記錄中提取特徵與標籤
    
    Args:
        records: 訓練記錄清單
    
    Returns:
        (X, y) - 特徵矩陣與標籤向量
    """
    # 定義特徵欄位
    X_list = []
    y_list = []
    
    for record in records:
        feature_vector = []
        for name in FEATURE_NAMES:
            raw_value = resolve_feature_value(record, name)
            normalized = normalize_feature(name, raw_value)
            feature_vector.append(normalized)

        target_score = coerce_score(record.get('target_score'))
        if target_score is not None:
            X_list.append(feature_vector)
            y_list.append(target_score)
    
    if not X_list:
        raise ValueError("未找到有效的訓練資料")
    
    X = np.array(X_list)
    y = np.array(y_list)
    
    print(f"✅ 特徵提取完成: {X.shape[0]} 筆記錄, {X.shape[1]} 個特徵")
    
    return X, y


def clean_training_records(records: List[Dict]) -> Tuple[List[Dict], Dict[str, int]]:
    stats = Counter(
        dropped_invalid=0,
        dropped_invalid_score=0,
        dropped_out_of_range=0,
        deduplicated=0,
        after_deduplicate=0
    )

    dedup_map: Dict[Tuple[str, str], Dict] = {}
    fallback_base = datetime.now(timezone.utc)

    for idx, record in enumerate(records):
        score = coerce_score(record.get('target_score'))
        if score is None:
            stats['dropped_invalid_score'] += 1
            stats['dropped_invalid'] += 1
            continue
        if score < 0 or score > 100:
            stats['dropped_out_of_range'] += 1
            stats['dropped_invalid'] += 1
            continue

        normalized = dict(record)
        normalized['target_score'] = float(score)

        keyword = safe_lower(normalized.get('keyword'))
        url = safe_lower(normalized.get('url'))
        key = (keyword, url) if keyword or url else (f'__idx_{idx}', '')

        timestamp = extract_timestamp(normalized)
        if timestamp is None:
            timestamp = fallback_base + timedelta(seconds=idx)
        normalized['_ts'] = timestamp

        existing = dedup_map.get(key)
        if existing is None or existing['_ts'] <= timestamp:
            if existing is not None:
                stats['deduplicated'] += 1
            dedup_map[key] = normalized
        else:
            stats['deduplicated'] += 1

    cleaned: List[Dict] = []
    for record in dedup_map.values():
        record.pop('_ts', None)
        cleaned.append(record)

    stats['after_deduplicate'] = len(cleaned)
    return cleaned, stats


def safe_lower(value: Optional[str]) -> str:
    if isinstance(value, str):
        return value.strip().lower()
    return ''


def feature_present(features: Dict, name: str) -> bool:
    if name not in features:
        return False
    value = features.get(name)
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def train_model(
    X: np.ndarray,
    y: np.ndarray,
    test_size: float = 0.2,
    records: Optional[List[Dict]] = None,
    time_split: bool = False
) -> Tuple[XGBRegressor, Dict]:
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
    train_indices, test_indices = split_train_test_indices(
        total=len(X),
        test_size=test_size,
        records=records,
        time_split=time_split
    )

    X_train, X_test = X[train_indices], X[test_indices]
    y_train, y_test = y[train_indices], y[test_indices]
    
    print(f"  訓練集: {X_train.shape[0]} 筆")
    print(f"  測試集: {X_test.shape[0]} 筆")
    
    # 訓練模型
    model = create_regressor()
    
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


def create_regressor() -> XGBRegressor:
    return XGBRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )


def split_train_test_indices(
    total: int,
    test_size: float,
    records: Optional[List[Dict]] = None,
    time_split: bool = False
) -> Tuple[np.ndarray, np.ndarray]:
    if total < 2:
        return np.array([0]), np.array([])

    test_size = min(max(test_size, 0.05), 0.5)

    if time_split and records:
        train_idx, test_idx = split_indices_by_time(records, test_size)
        return np.array(train_idx), np.array(test_idx)

    indices = np.arange(total)
    train_idx, test_idx = train_test_split(indices, test_size=test_size, random_state=42)
    return train_idx, test_idx


def split_indices_by_time(records: List[Dict], test_size: float) -> Tuple[List[int], List[int]]:
    dated = []
    fallback_base = datetime.fromtimestamp(0, tz=timezone.utc)

    for idx, record in enumerate(records):
        ts = extract_timestamp(record)
        if ts is None:
            ts = fallback_base + (idx * (datetime.fromtimestamp(1, tz=timezone.utc) - fallback_base))
        dated.append((idx, ts))

    dated.sort(key=lambda item: item[1])
    split_point = max(1, min(len(dated) - 1, int(len(dated) * (1 - test_size))))
    train_indices = [idx for idx, _ in dated[:split_point]]
    test_indices = [idx for idx, _ in dated[split_point:]]
    return train_indices, test_indices


def extract_timestamp(record: Dict) -> Optional[datetime]:
    possible_fields = [
        record.get('timestamp'),
        record.get('createdAt'),
        record.get('analyzedAt'),
        record.get('updatedAt')
    ]

    for value in possible_fields:
        if value is None:
            continue
        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(float(value), tz=timezone.utc)
            except (OverflowError, OSError):
                continue
        if isinstance(value, str) and value.strip():
            ts_str = value.strip()
            if ts_str.endswith('Z'):
                ts_str = ts_str[:-1] + '+00:00'
            try:
                return datetime.fromisoformat(ts_str)
            except ValueError:
                continue
    return None


def run_kfold_evaluation(X: np.ndarray, y: np.ndarray, folds: int) -> Dict:
    kf = KFold(n_splits=folds, shuffle=True, random_state=42)
    fold_results = []

    print(f"\n📊 K-fold 交叉驗證（{folds} folds）")
    for fold, (train_idx, test_idx) in enumerate(kf.split(X), start=1):
        model = create_regressor()
        model.fit(X[train_idx], y[train_idx])
        y_pred = model.predict(X[test_idx])
        rmse = float(np.sqrt(mean_squared_error(y[test_idx], y_pred)))
        r2 = float(r2_score(y[test_idx], y_pred))
        fold_results.append({'fold': fold, 'rmse': rmse, 'r2': r2})
        print(f"  Fold {fold}: RMSE={rmse:.4f}, R²={r2:.4f}")

    avg_rmse = float(np.mean([item['rmse'] for item in fold_results]))
    avg_r2 = float(np.mean([item['r2'] for item in fold_results]))
    print(f"  平均: RMSE={avg_rmse:.4f}, R²={avg_r2:.4f}")

    return {
        'folds': fold_results,
        'average_rmse': avg_rmse,
        'average_r2': avg_r2
    }


def generate_health_report(records: List[Dict], X: np.ndarray, y: np.ndarray) -> Dict:
    keyword_counter = Counter()
    locale_counter = Counter()
    serp_rank_counter = Counter()
    feature_missing = Counter({name: 0 for name in FEATURE_NAMES})
    timestamps: List[datetime] = []

    for record in records:
        keyword = (record.get('keyword') or '').strip()
        if keyword:
            keyword_counter[keyword.lower()] += 1

        locale = (record.get('locale') or '').strip() or 'unknown'
        locale_counter[locale] += 1

        rank = record.get('serp_rank')
        if isinstance(rank, (int, float)):
            serp_rank_counter[int(rank)] += 1

        features = record.get('features') or {}
        for name in FEATURE_NAMES:
            if not feature_present(features, name):
                feature_missing[name] += 1

        ts = extract_timestamp(record)
        if ts:
            timestamps.append(ts)

    total_records = max(len(records), 1)
    feature_coverage = {
        name: {
            'missingCount': missing,
            'coverageRatio': 1 - (missing / total_records)
        }
        for name, missing in feature_missing.items()
    }

    keyword_top = keyword_counter.most_common(10)
    serp_distribution = {str(rank): count for rank, count in sorted(serp_rank_counter.items())}
    locale_distribution = dict(locale_counter)

    ts_min = min(timestamps).isoformat() if timestamps else None
    ts_max = max(timestamps).isoformat() if timestamps else None

    return {
        'dataset': {
            'records': len(records),
            'features': X.shape[1],
            'dateRange': {'start': ts_min, 'end': ts_max}
        },
        'targetStats': {
            'mean': float(np.mean(y)),
            'std': float(np.std(y)),
            'min': float(np.min(y)),
            'max': float(np.max(y))
        },
        'keywordStats': {
            'uniqueKeywords': len(keyword_counter),
            'topKeywords': [{'keyword': k, 'count': c} for k, c in keyword_top]
        },
        'localeStats': locale_distribution,
        'serpRankStats': serp_distribution,
        'featureCoverage': feature_coverage
    }


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
    output_path: str,
    evaluation_summary: Optional[Dict] = None
) -> Dict:
    """
    生成模型配置檔案（用於 Worker 部署）
    
    Args:
        model: 訓練好的模型
        metrics: 評估指標
        records_count: 訓練記錄數
        output_path: 輸出路徑
        evaluation_summary: 評估摘要
    
    Returns:
        模型配置字典
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
    
    if evaluation_summary:
        config['evaluationSummary'] = evaluation_summary
    
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    write_json(output_path, config)
    print(f"✅ 模型配置已生成: {output_path}")
    return config


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


def update_worker_model(worker_model_path: str, model_config: Dict) -> None:
    """在 scoring-model.js 中更新自動產生的模型區塊。"""
    js_text = Path(worker_model_path).read_text(encoding='utf-8')
    serialized = json.dumps(model_config, ensure_ascii=False, indent=2)
    replacement = (
        "/* AUTO-GENERATED:MODEL_CONFIG_START */\n"
        f"export const AUTO_GENERATED_MODEL_CONFIG = {serialized};\n"
        "/* AUTO-GENERATED:MODEL_CONFIG_END */"
    )

    pattern = re.compile(
        r"/\* AUTO-GENERATED:MODEL_CONFIG_START \*/[\s\S]*?/\* AUTO-GENERATED:MODEL_CONFIG_END \*/",
        re.MULTILINE
    )

    if not pattern.search(js_text):
        raise RuntimeError('找不到 scoring-model.js 的 AUTO-GENERATED 區塊')

    new_text = pattern.sub(replacement, js_text, count=1)
    Path(worker_model_path).write_text(new_text, encoding='utf-8')
    print(f"✅ 已更新 {worker_model_path} 的模型配置")


def send_webhook(webhook_url: str, data: Dict) -> None:
    if not webhook_url:
        return
    try:
        payload = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.getcode()
            if 200 <= status < 300:
                print(f"✅ 健康報表已送達 Webhook ({status})")
            else:
                print(f"⚠️ Webhook 回應狀態碼 {status}")
    except urllib.error.URLError as error:
        print(f"⚠️ Webhook 發送失敗: {error}")


def upload_health_report_to_r2(target: str, data: Dict) -> None:
    if ':' not in target:
        print('⚠️ health-report-r2 參數格式應為 bucket:key')
        return
    bucket, key = target.split(':', 1)
    with tempfile.NamedTemporaryFile(delete=False, suffix='.json', mode='w', encoding='utf-8') as tmp:
        json.dump(data, tmp, ensure_ascii=False, indent=2)
        tmp_path = tmp.name
    try:
        cmd = ['wrangler', 'r2', 'object', 'put', f'{bucket}/{key}', '--file', tmp_path]
        subprocess.run(cmd, check=True)
        print(f"✅ 健康報表已上傳至 R2 {bucket}/{key}")
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        print(f"⚠️ 無法上傳至 R2: {error}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def write_json(output_path: str, data: Dict) -> None:
    """
    寫入 JSON 檔案
    
    Args:
        output_path: 輸出路徑
        data: 寫入資料
    """
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


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
        '--time-split',
        action='store_true',
        help='啟用時間排序切分（以 timestamp 分割訓練/測試）'
    )
    parser.add_argument(
        '--kfold',
        type=int,
        default=0,
        help='若 >1，執行 K-fold 交叉驗證並輸出統計'
    )
    parser.add_argument(
        '--deploy',
        action='store_true',
        help='生成部署腳本'
    )
    parser.add_argument(
        '--worker-model-path',
        default='functions/api/scoring-model.js',
        help='Worker scoring-model.js 路徑（自動寫入模型 config）'
    )
    parser.add_argument(
        '--health-report',
        help='輸出資料健康報表 JSON 的路徑'
    )
    parser.add_argument(
        '--health-report-webhook',
        help='將健康報表 POST 至指定 URL'
    )
    parser.add_argument(
        '--health-report-r2',
        help='輸出健康報表至本地檔案以供後續上傳（格式：bucket:path)'
    )
    
    args = parser.parse_args()
    
    try:
        # 1. 載入訓練資料
        print("📥 載入訓練資料...")
        records, X, y = load_training_data(args.data_dir)

        # 1.1 產出資料健康報表
        health_report = generate_health_report(records, X, y)
        if args.health_report:
            write_json(args.health_report, health_report)
            print(f"  🩺 已輸出健康報表: {args.health_report}")
        if args.health_report_webhook:
            send_webhook(args.health_report_webhook, health_report)
        if args.health_report_r2:
            write_json(args.health_report_r2, health_report)
            print(f"  🪣 已輸出健康報表至 R2 準備檔案: {args.health_report_r2}")
        
        # 2. 訓練模型
        print("\n🤖 訓練模型...")
        model, metrics = train_model(
            X,
            y,
            test_size=args.test_size,
            records=records,
            time_split=args.time_split
        )

        kfold_report = None
        if args.kfold and args.kfold > 1:
            kfold_report = run_kfold_evaluation(X, y, args.kfold)
        
        # 3. 保存模型
        print("\n💾 保存模型...")
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        model_path = output_dir / f"{args.model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        save_model(model, str(model_path))
        
        # 4. 生成模型配置
        print("\n📋 生成模型配置...")
        config_path = output_dir / f"{args.model_name}_config_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        model_config = generate_model_config(
            model,
            metrics,
            len(records),
            str(config_path),
            evaluation_summary={
                'time_split': args.time_split,
                'test_size': args.test_size,
                'kfold': kfold_report
            }
        )

        update_worker_model(args.worker_model_path, model_config)
        
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
        
    except Exception as exc:
        print(f"\n❌ 發生錯誤: {exc}")
        sys.exit(1)


if __name__ == '__main__':
    main()
