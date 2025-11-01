# Baseline 模型訓練報告

- 產出時間：2025-11-01T13:53:53
- 訓練資料筆數：1345
- 特徵欄位數：62

## 評估指標總覽

| 目標 | Train RMSE | Test RMSE | Test R² | CV R² (mean±std) | 資料量 (train/test) |
|---|---|---|---|---|
| score_overall_proxy | 0.137 | 0.667 | 1.000 | 0.923 ± 0.144 | 1076/269 |
| score_hcu_proxy | 0.149 | 1.014 | 0.980 | 0.939 ± 0.095 | 705/177 |
| score_eeat_proxy | 0.157 | 0.394 | 1.000 | 0.963 ± 0.062 | 1076/269 |
| score_aeo_proxy | 0.085 | 2.929 | 0.812 | 0.736 ± 0.244 | 705/177 |

## 重要特徵（Top 10）

### score_overall_proxy
| 排名 | 特徵 | 重要度 |
|---|---|---|
| 1 | actionableWeakFlag | 0.520324 |
| 2 | uniqueWordRatio | 0.340275 |
| 3 | depthLowFlag | 0.101728 |
| 4 | avgSentenceLengthNorm | 0.028041 |
| 5 | hasVisibleDate | 0.003636 |
| 6 | hcuNoRatio | 0.001420 |
| 7 | listPresent | 0.000938 |
| 8 | hcuYesRatio | 0.000846 |
| 9 | referenceKeywordNorm | 0.000786 |
| 10 | hasUniqueTitle | 0.000526 |

### score_hcu_proxy
| 排名 | 特徵 | 重要度 |
|---|---|---|
| 1 | hcuNoRatio | 0.409491 |
| 2 | listPresent | 0.202614 |
| 3 | hcuYesRatio | 0.165184 |
| 4 | hcuContentHelpfulness | 0.064954 |
| 5 | tablePresent | 0.041340 |
| 6 | wordCountNorm | 0.032087 |
| 7 | avgSentenceLengthNorm | 0.018944 |
| 8 | hasArticleSchema | 0.017743 |
| 9 | hcuPartialRatio | 0.014515 |
| 10 | h2CountNorm | 0.009196 |

### score_eeat_proxy
| 排名 | 特徵 | 重要度 |
|---|---|---|
| 1 | actionableWeakFlag | 0.502204 |
| 2 | uniqueWordRatio | 0.380714 |
| 3 | depthLowFlag | 0.050320 |
| 4 | avgSentenceLengthNorm | 0.026921 |
| 5 | hasVisibleDate | 0.022467 |
| 6 | canonicalPresent | 0.007255 |
| 7 | hasUniqueTitle | 0.004541 |
| 8 | hasH1Keyword | 0.003181 |
| 9 | metaDescriptionPresent | 0.001043 |
| 10 | referenceKeywordNorm | 0.000782 |

### score_aeo_proxy
| 排名 | 特徵 | 重要度 |
|---|---|---|
| 1 | listPresent | 0.384841 |
| 2 | metaDescriptionPresent | 0.216392 |
| 3 | hasArticleSchema | 0.085487 |
| 4 | tablePresent | 0.082332 |
| 5 | hcuContentHelpfulness | 0.050367 |
| 6 | hcuYesRatio | 0.035306 |
| 7 | hcuPartialRatio | 0.033704 |
| 8 | hcuNoRatio | 0.024237 |
| 9 | hasUniqueTitle | 0.023297 |
| 10 | target_score | 0.014980 |
