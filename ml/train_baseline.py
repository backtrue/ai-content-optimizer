#!/usr/bin/env python3
"""多輸出 Baseline 模型訓練腳本
- 使用 `training_prepared.csv`（含 HCU / EEAT / AEO 代理分數）
- 為四個代理目標訓練獨立的 XGBoost Regressor
- 輸出模型檔、組態摘要與評估報告
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split

DATA_PATH = Path('./ml/training_prepared.csv')
MODEL_DIR = Path('./ml/models')
REPORT_DIR = Path('./ml/reports')
MODEL_CONFIG_PATH = Path('./ml/trained_model_config.json')
SUMMARY_PATH = Path('./ml/model_training_summary.json')

TARGET_COLUMNS = [
    'score_overall_proxy',
    'score_hcu_proxy',
    'score_eeat_proxy',
    'score_aeo_proxy',
]

DEFAULT_PARAMS: Dict[str, float | int] = {
    'n_estimators': 200,
    'max_depth': 5,
    'learning_rate': 0.08,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'random_state': 42,
    'reg_lambda': 1.0,
    'min_child_weight': 1.0,
}


def ensure_directories() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f'找不到訓練資料：{path}')
    df = pd.read_csv(path)
    print(f"✓ 已載入 {len(df)} 筆資料，{len(df.columns)} 個欄位")
    return df


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    numeric_cols = df.select_dtypes(include=['number', 'bool']).columns.tolist()
    feature_cols: List[str] = [col for col in numeric_cols if col not in TARGET_COLUMNS]
    X = df[feature_cols].copy().fillna(0)
    print(f"✓ 特徵欄位數：{len(feature_cols)}")
    return X


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    return {
        'rmse': float(np.sqrt(mean_squared_error(y_true, y_pred))),
        'mae': float(mean_absolute_error(y_true, y_pred)),
        'r2': float(r2_score(y_true, y_pred)),
    }


def compute_cv_scores(model: xgb.XGBRegressor, X: pd.DataFrame, y: pd.Series) -> Dict[str, float]:
    folds = min(5, len(y))
    if folds < 2:
        return {'cv_r2_mean': float('nan'), 'cv_r2_std': float('nan')}
    scores = cross_val_score(model, X, y, cv=folds, scoring='r2', n_jobs=-1)
    return {
        'cv_r2_mean': float(scores.mean()),
        'cv_r2_std': float(scores.std()),
    }


def train_single_target(name: str, X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
    print(f"\n=== 訓練 {name} 模型 ===")
    mask = y.notna()
    X_target = X.loc[mask]
    y_target = y.loc[mask]

    if len(X_target) < 25:
        raise ValueError(f'{name} 可用樣本僅 {len(X_target)} 筆，無法進行穩定訓練')

    X_train, X_test, y_train, y_test = train_test_split(
        X_target,
        y_target,
        test_size=0.2,
        random_state=42,
    )

    model = xgb.XGBRegressor(**DEFAULT_PARAMS)
    model.fit(X_train, y_train)

    train_metrics = compute_metrics(y_train, model.predict(X_train))
    test_metrics = compute_metrics(y_test, model.predict(X_test))
    cv_metrics = compute_cv_scores(model, X_target, y_target)

    feature_importance = (
        pd.DataFrame(
            {
                'feature': X_target.columns,
                'importance': model.feature_importances_,
            }
        )
        .sort_values('importance', ascending=False)
        .head(20)
        .to_dict('records')
    )

    payload: Dict[str, Any] = {
        'model': model,
        'train_size': int(len(X_train)),
        'test_size': int(len(X_test)),
        'total_size': int(len(X_target)),
        'metrics': {
            'train_rmse': train_metrics['rmse'],
            'train_mae': train_metrics['mae'],
            'train_r2': train_metrics['r2'],
            'test_rmse': test_metrics['rmse'],
            'test_mae': test_metrics['mae'],
            'test_r2': test_metrics['r2'],
            **cv_metrics,
        },
        'feature_importance_top20': feature_importance,
    }
    return payload


def save_models(result_map: Dict[str, Dict[str, Any]]) -> None:
    for target_name, output in result_map.items():
        model: xgb.XGBRegressor = output.pop('model')  # type: ignore[assignment]
        model_path = MODEL_DIR / f'{target_name}.json'
        model.save_model(model_path)
        output['model_path'] = str(model_path)


def write_json(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def build_config(results: Dict[str, Dict[str, Any]], df: pd.DataFrame, X: pd.DataFrame) -> Dict[str, Any]:
    return {
        'version': '2025-11-01-baseline-v2',
        'createdAt': datetime.now().isoformat(timespec='seconds'),
        'description': 'XGBoost 多輸出 baseline，使用 training_prepared.csv HCU/EEAT/AEO 代理分數訓練',
        'dataset': {
            'path': str(DATA_PATH),
            'records': int(len(df)),
            'feature_columns': list(X.columns),
        },
        'hyperparameters': DEFAULT_PARAMS,
        'targets': results,
    }


def build_summary(results: Dict[str, Dict[str, object]]) -> Dict[str, object]:
    table = {}
    for name, payload in results.items():
        m = payload['metrics']
        table[name] = {
            'train_rmse': m['train_rmse'],
            'test_rmse': m['test_rmse'],
            'test_r2': m['test_r2'],
            'cv_r2_mean': m['cv_r2_mean'],
            'cv_r2_std': m['cv_r2_std'],
        }
    return table


def render_markdown_report(results: Dict[str, Dict[str, Any]], df: pd.DataFrame, X: pd.DataFrame) -> None:
    lines = [
        '# Baseline 模型訓練報告',
        '',
        f'- 產出時間：{datetime.now().isoformat(timespec="seconds")}',
        f'- 訓練資料筆數：{len(df)}',
        f'- 特徵欄位數：{len(X.columns)}',
        '',
        '## 評估指標總覽',
        '',
        '| 目標 | Train RMSE | Test RMSE | Test R² | CV R² (mean±std) | 資料量 (train/test) |',
        '|---|---|---|---|---|',
    ]

    for name, payload in results.items():
        metrics = payload['metrics']
        lines.append(
            f"| {name} | {metrics['train_rmse']:.3f} | {metrics['test_rmse']:.3f} | "
            f"{metrics['test_r2']:.3f} | {metrics['cv_r2_mean']:.3f} ± {metrics['cv_r2_std']:.3f} | "
            f"{payload['train_size']}/{payload['test_size']} |"
        )

    lines.append('')
    lines.append('## 重要特徵（Top 10）')
    lines.append('')

    for name, payload in results.items():
        lines.append(f'### {name}')
        lines.append('| 排名 | 特徵 | 重要度 |')
        lines.append('|---|---|---|')
        for idx, feature in enumerate(payload['feature_importance_top20'][:10], start=1):
            lines.append(f"| {idx} | {feature['feature']} | {feature['importance']:.6f} |")
        lines.append('')

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / 'baseline_training_report.md').write_text('\n'.join(lines), encoding='utf-8')


def main() -> None:
    print('=' * 70)
    print('BASELINE 模型訓練（HCU / EEAT / AEO / 總分）')
    print('=' * 70)

    ensure_directories()

    print('\n[1/4] 載入資料…')
    df = load_dataset(DATA_PATH)

    print('\n[2/4] 準備特徵…')
    X = prepare_features(df)

    print('\n[3/4] 模型訓練與評估…')
    results: Dict[str, Dict[str, object]] = {}
    for target in TARGET_COLUMNS:
        if target not in df.columns:
            print(f"⚠️ 目標欄位 {target} 不存在，略過")
            continue
        outcome = train_single_target(target, X, df[target])
        results[target] = outcome
        m = outcome['metrics']
        print(
            f"  → {target}: test_RMSE={m['test_rmse']:.3f} "
            f"test_R²={m['test_r2']:.3f} cv_R²={m['cv_r2_mean']:.3f}"
        )

    if not results:
        raise RuntimeError('沒有任何模型成功訓練，請檢查資料來源')

    print('\n[4/4] 儲存成果…')
    save_models(results)

    config = build_config(results, df, X)
    write_json(MODEL_CONFIG_PATH, config)

    summary = build_summary(results)
    write_json(SUMMARY_PATH, summary)

    render_markdown_report(results, df, X)

    print('\n=== 訓練完成 ===')
    print(f'模型組態：{MODEL_CONFIG_PATH}')
    print(f'訓練摘要：{SUMMARY_PATH}')
    print(f'報告檔案：{REPORT_DIR / "baseline_training_report.md"}')
    for target, payload in results.items():
        metrics = payload['metrics']
        print(
            f"  • {target}: 模型路徑={payload['model_path']} "
            f"test_RMSE={metrics['test_rmse']:.3f} test_R²={metrics['test_r2']:.3f}"
        )


if __name__ == '__main__':
    main()
