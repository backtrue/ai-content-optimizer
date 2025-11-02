# Baseline 模型訓練報告

- 產出時間：2025-11-02T03:58:46
- 訓練資料筆數：1345
- 特徵欄位數：70

## 評估指標總覽

| 目標 | Train RMSE | Test RMSE | Test R² | CV R² (mean±std) | 資料量 (train/test) |
|---|---|---|---|---|
| score_hcu_proxy | 0.146 | 1.039 | 0.979 | 0.927 ± 0.116 | 705/177 |
| score_eeat_proxy | 0.157 | 0.369 | 1.000 | 0.964 ± 0.064 | 1076/269 |
| score_aeo_proxy | 0.069 | 2.955 | 0.809 | 0.737 ± 0.246 | 705/177 |

## 重要特徵（Top 10）

### score_hcu_proxy
| 排名 | 特徵 | 重要度 |
|---|---|---|
| 1 | hcuNoRatio | 0.385930 |
| 2 | listPresent | 0.181733 |
| 3 | hcuYesRatio | 0.178391 |
| 4 | hcuContentHelpfulness | 0.082328 |
| 5 | tablePresent | 0.043843 |
| 6 | hcuPartialRatio | 0.028852 |
| 7 | wordCountNorm | 0.026983 |
| 8 | avgSentenceLengthNorm | 0.017625 |
| 9 | h2CountNorm | 0.008577 |
| 10 | hasArticleSchema | 0.008088 |

### score_eeat_proxy
| 排名 | 特徵 | 重要度 |
|---|---|---|
| 1 | depthLowFlag | 0.957585 |
| 2 | uniqueWordRatio | 0.033596 |
| 3 | avgSentenceLengthNorm | 0.004509 |
| 4 | hasVisibleDate | 0.002496 |
| 5 | canonicalPresent | 0.000705 |
| 6 | hasUniqueTitle | 0.000642 |
| 7 | referenceKeywordNorm | 0.000198 |
| 8 | metaDescriptionPresent | 0.000146 |
| 9 | hasH1Keyword | 0.000055 |
| 10 | readabilityWeakFlag | 0.000023 |

### score_aeo_proxy
| 排名 | 特徵 | 重要度 |
|---|---|---|
| 1 | listPresent | 0.380929 |
| 2 | metaDescriptionPresent | 0.283350 |
| 3 | tablePresent | 0.091956 |
| 4 | hcuYesRatio | 0.061685 |
| 5 | hcuContentHelpfulness | 0.055710 |
| 6 | hcuPartialRatio | 0.032913 |
| 7 | hasUniqueTitle | 0.031187 |
| 8 | hcuNoRatio | 0.008556 |
| 9 | hasH1Keyword | 0.008519 |
| 10 | hasArticleSchema | 0.007287 |
