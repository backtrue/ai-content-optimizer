#!/usr/bin/env python3
"""資料前處理腳本：
- 載入 training_data.csv
- 轉換欄位型別（如 uniqueWordRatio）
- 計算 HCU / EEAT / AEO 代理分數
- 輸出整理後的 training_prepared.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, Iterable, Tuple

import numpy as np
import pandas as pd

# 需要反轉的弱點旗標或負向指標（1 代表弱 -> 轉成 0 代表差 / 1 代表好）
INVERT_FEATURES = {
    'depthLowFlag',
    'readabilityWeakFlag',
    'actionableWeakFlag',
    'freshnessWeakFlag',
    'titleMismatchFlag',
}

# HCU / EEAT / AEO 分組與權重設定
HCU_GROUPS: Dict[str, Dict[str, Iterable[str]]] = {
    'helpful_ratio': {
        'features': ['hcuContentHelpfulness', 'hcuYesRatio', 'hcuPartialRatio'],
    },
    'intent_alignment': {
        'features': ['qaFormatScore', 'firstParagraphAnswerQuality', 'semanticParagraphFocus', 'topicCohesion', 'titleIntentMatch'],
    },
    'actionability': {
        'features': ['actionableScoreNorm', 'referenceKeywordNorm', 'listPresent', 'tablePresent'],
    },
    'completeness': {
        'features': ['wordCountNorm', 'paragraphCountNorm', 'h2CountNorm', 'avgSentenceLengthNorm'],
    },
}
HCU_WEIGHTS = {
    'helpful_ratio': 0.15,
    'intent_alignment': 0.10,
    'actionability': 0.05,
    'completeness': 0.05,
}

EEAT_GROUPS = {
    'trust_signals': {
        'features': ['authorInfoPresent', 'brandEntityClarity', 'socialMediaLinksPresent', 'organizationSchemaPresent'],
    },
    'expertise_evidence': {
        'features': ['externalCitationCount', 'authorityLinkPresent', 'evidenceCountNorm', 'experienceCueNorm'],
    },
    'integrity': {
        'features': ['canonicalPresent', 'metaDescriptionPresent', 'hasUniqueTitle', 'hasH1Keyword'],
    },
    'freshness': {
        'features': ['recentYearNorm', 'hasVisibleDate', 'hasModifiedDate'],
    },
    'safety': {
        'features': ['readabilityWeakFlag', 'actionableWeakFlag', 'titleMismatchFlag'],
        'invert': True,
    },
}
EEAT_WEIGHTS = {
    'trust_signals': 0.10,
    'expertise_evidence': 0.12,
    'integrity': 0.06,
    'freshness': 0.05,
    'safety': 0.02,
}

AEO_GROUPS = {
    'snippet_friendliness': {
        'features': ['qaFormatScore', 'richSnippetFormat', 'paragraphExtractability', 'semanticNaturalness'],
    },
    'structured_data': {
        'features': ['faqSchemaPresent', 'howtoSchemaPresent', 'articleSchemaPresent', 'multimediaSupport'],
    },
    'citability': {
        'features': ['citabilityTrustScore', 'externalCitationCount', 'metaTagsQuality'],
    },
    'action_guidance': {
        'features': ['listPresent', 'tablePresent', 'actionableScoreNorm'],
    },
}
AEO_WEIGHTS = {
    'snippet_friendliness': 0.12,
    'structured_data': 0.08,
    'citability': 0.06,
    'action_guidance': 0.04,
}

OUTPUT_FILENAME = 'training_prepared.csv'


def safe_float(value) -> float:
    """嘗試將資料轉成浮點數，失敗時回傳 NaN。"""
    if pd.isna(value):
        return np.nan
    try:
        return float(value)
    except (TypeError, ValueError):
        return np.nan


def extract_feature_value(row: pd.Series, feature: str, invert: bool = False) -> float:
    """取得特徵值並視情況反轉後回傳 0~1 範圍。"""
    value = safe_float(row.get(feature))
    if np.isnan(value):
        return np.nan
    if feature in INVERT_FEATURES or invert:
        value = 1.0 - value
    return float(np.clip(value, 0.0, 1.0))


def aggregate_group(row: pd.Series, features: Iterable[str], invert: bool = False) -> float:
    values = [extract_feature_value(row, feature, invert) for feature in features]
    values = [v for v in values if not np.isnan(v)]
    if not values:
        return np.nan
    return float(np.mean(values))


def compute_weighted_score(row: pd.Series, groups: Dict[str, Dict[str, Iterable[str]]], weights: Dict[str, float]) -> Tuple[float, Dict[str, float]]:
    group_scores: Dict[str, float] = {}
    total_weight = 0.0
    weighted_sum = 0.0

    for name, meta in groups.items():
        features = meta.get('features', [])
        invert = bool(meta.get('invert', False))
        group_value = aggregate_group(row, features, invert=invert)
        if np.isnan(group_value):
            continue
        group_scores[name] = group_value
        weight = float(weights.get(name, 1.0))
        total_weight += weight
        weighted_sum += (group_value * weight)

    if total_weight == 0:
        return np.nan, group_scores
    return float(np.clip(weighted_sum / total_weight, 0.0, 1.0)), group_scores


def compute_scores(df: pd.DataFrame) -> pd.DataFrame:
    hcu_values = []
    eeat_values = []
    aeo_values = []
    hcu_breakdown = []
    eeat_breakdown = []
    aeo_breakdown = []

    for _, row in df.iterrows():
        hcu_score, hcu_groups = compute_weighted_score(row, HCU_GROUPS, HCU_WEIGHTS)
        eeat_score, eeat_groups = compute_weighted_score(row, EEAT_GROUPS, EEAT_WEIGHTS)
        aeo_score, aeo_groups = compute_weighted_score(row, AEO_GROUPS, AEO_WEIGHTS)

        hcu_values.append(hcu_score)
        eeat_values.append(eeat_score)
        aeo_values.append(aeo_score)
        hcu_breakdown.append(hcu_groups)
        eeat_breakdown.append(eeat_groups)
        aeo_breakdown.append(aeo_groups)

    df = df.copy()
    df['score_hcu_proxy'] = np.array(hcu_values) * 100
    df['score_eeat_proxy'] = np.array(eeat_values) * 100
    df['score_aeo_proxy'] = np.array(aeo_values) * 100
    df['score_overall_proxy'] = (
        df[['score_hcu_proxy', 'score_eeat_proxy', 'score_aeo_proxy']]
        .mean(axis=1, skipna=True)
    )

    df['score_hcu_components'] = hcu_breakdown
    df['score_eeat_components'] = eeat_breakdown
    df['score_aeo_components'] = aeo_breakdown

    return df


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='準備 HCU/EEAT/AEO 訓練資料集')
    parser.add_argument('--input', default='./ml/training_data.csv', help='輸入 CSV 路徑')
    parser.add_argument('--output', default=f'./ml/{OUTPUT_FILENAME}', help='輸出 CSV 路徑')
    return parser


def main() -> None:
    parser = build_argument_parser()
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"找不到輸入檔案：{input_path}")

    print('=' * 70)
    print('PREPARING TRAINING DATASET')
    print('=' * 70)

    print(f"\n[1/4] 載入資料：{input_path}")
    df = pd.read_csv(input_path)
    print(f"✓ 讀入 {len(df)} 筆資料，共 {len(df.columns)} 欄位")

    print("\n[2/4] 型別與缺失值處理…")
    if 'uniqueWordRatio' in df.columns:
        df['uniqueWordRatio'] = pd.to_numeric(df['uniqueWordRatio'], errors='coerce')
    for feature in INVERT_FEATURES:
        if feature in df.columns:
            df[feature] = pd.to_numeric(df[feature], errors='coerce').fillna(0)
    print('✓ 基本欄位轉換完成')

    print("\n[3/4] 計算 HCU / EEAT / AEO 代理分數…")
    prepared_df = compute_scores(df)
    available_counts = prepared_df[['score_hcu_proxy', 'score_eeat_proxy', 'score_aeo_proxy']].notna().sum()
    print('✓ 分數計算完成')
    print('  可用紀錄：')
    for column, count in available_counts.items():
        print(f'    {column}: {count} 筆')

    print("\n[4/4] 輸出整理後資料…")
    prepared_df.to_csv(output_path, index=False)
    print(f"✓ 已輸出至 {output_path}")

    print('\n摘要統計：')
    summary = prepared_df[['score_hcu_proxy', 'score_eeat_proxy', 'score_aeo_proxy', 'score_overall_proxy']].describe()
    print(summary)

    print('\n完成。')


if __name__ == '__main__':
    main()
