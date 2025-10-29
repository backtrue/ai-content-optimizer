#!/usr/bin/env python3
"""
SERP Data Collection Script
Fetches top 10 results from ValueSerp for given keywords and extracts features via our /analyze API.
"""

import os
import json
import csv
import time
import requests
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from serp_manager import get_manager as get_serp_manager
from cost_tracker import get_tracker as get_cost_tracker

# Configuration
SERPAPI_KEY = os.getenv('SERPAPI_KEY', '')
ANALYZE_API_URL = os.getenv('ANALYZE_API_URL', 'https://ragseo.thinkwithblack.com/api/analyze')
OUTPUT_DIR = './ml'
OUTPUT_CSV = os.path.join(OUTPUT_DIR, 'training_data.csv')
OUTPUT_JSON = os.path.join(OUTPUT_DIR, 'training_data.json')
STATUS_JSON = os.path.join(OUTPUT_DIR, 'collection_status.json')

# Rate limiting & retry configuration
KEYWORD_DELAY_SECONDS = float(os.getenv('SERP_KEYWORD_DELAY_SECONDS', '15'))
URL_DELAY_SECONDS = float(os.getenv('SERP_URL_DELAY_SECONDS', '12'))
ANALYZE_RETRY_ATTEMPTS = int(os.getenv('SERP_ANALYZE_RETRIES', '3'))
ANALYZE_RETRY_DELAY_SECONDS = float(os.getenv('SERP_ANALYZE_RETRY_DELAY_SECONDS', '20'))

# Keywords to analyze (100 keywords)
KEYWORDS = [
    "非洲豬瘟", "張峻", "水龍吟", "mizkif", "粉盒大王",
    "玉山金", "許紹雄", "樂天", "天地劍心", "atlas",
    "台中購物節", "藍眼淚", "炎亞綸", "國寶", "周孝安",
    "中華職棒", "肉肉大米", "鄭智化", "exo", "mlb世界大賽",
    "曾雅妮", "林又立", "詹江村", "人浮於愛", "馬傑森",
    "高通", "普發一萬登記", "伯恩安德森", "2025 mlb 球季", "易烊千璽",
    "新竹停水", "洲美國小預定地", "曲德義", "明天的天氣", "宏泰集團",
    "鄭浩均", "謝沛恩", "江和樹", "中華職棒直播", "平野惠一",
    "高雄捷運", "國王 對 湖人", "高通股價", "蔡璧名", "萬聖節",
    "巴黎大師賽", "cpbl直播", "坤達", "大榮貨運", "泰國國喪",
    "高橋藍", "austin reaves", "qcom", "威能帝", "泰國",
    "法國羽球公開賽", "阿信", "凱蒂佩芮", "白晝之夜", "yahoo",
    "徐嶔煌", "好味小姐", "台南藍眼淚", "山豬", "同志大遊行2025",
    "黃安", "桃園萬聖城", "余德龍", "黃金價格", "炸記",
    "賴雅妍", "南海", "閃兵", "河北彩伽 ig", "江坤宇",
    "女孩", "朱承洋", "光復節由來", "涼山特勤隊", "euphoria",
    "nba戰績", "00878", "粘鑫", "錦秀社區", "馬刺 對 籃網",
    "灰狼 對 溜馬", "陳以信", "persib bandung vs persis", "mlb fall classic 2025", "許基宏",
    "光復節", "晚安小雞", "f1", "拓荒者 對 勇士", "小野田紀美",
    "chatgpt atlas", "勇士 對 金塊", "牙買加"
]


def load_existing_data() -> List[Dict]:
    """載入既有訓練資料，若檔案不存在則回傳空陣列。"""
    if not os.path.exists(OUTPUT_JSON):
        return []

    try:
        with open(OUTPUT_JSON, 'r', encoding='utf-8') as file:
            data = json.load(file)
            if isinstance(data, list):
                return data
            print("⚠️ training_data.json 格式非陣列，將忽略既有資料。")
    except json.JSONDecodeError:
        print("⚠️ training_data.json 正在寫入或格式不完整，暫時忽略既有資料。")
    except Exception as exc:
        print(f"⚠️ 載入既有資料時發生錯誤：{exc}")

    return []


def save_csv(records: List[Dict]) -> None:
    """覆寫輸出 CSV，以便即時檢視最新資料。"""
    if not records:
        if os.path.exists(OUTPUT_CSV):
            os.remove(OUTPUT_CSV)
        return

    fieldnames = ['url', 'keyword', 'serp_rank', 'target_score', 'title'] + list(records[0]['features'].keys())
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            row = {
                'url': record['url'],
                'keyword': record['keyword'],
                'serp_rank': record['serp_rank'],
                'target_score': record['target_score'],
                'title': record['title']
            }
            row.update(record['features'])
            writer.writerow(row)


def update_status_file(records: List[Dict], current_keyword: Optional[str], keyword_index: int) -> None:
    """輸出蒐集狀態 JSON，提供監控腳本與人工快速檢視。"""
    unique_keywords = {item['keyword'] for item in records}
    status_payload = {
        'timestamp': datetime.now().isoformat(),
        'total_records': len(records),
        'unique_keywords': len(unique_keywords),
        'current_keyword': current_keyword,
        'current_keyword_index': keyword_index,
        'progress_percent': round(len(unique_keywords) / len(KEYWORDS) * 100, 2) if KEYWORDS else 0,
        'remaining_keywords': max(0, len(KEYWORDS) - len(unique_keywords))
    }

    with open(STATUS_JSON, 'w', encoding='utf-8') as status_file:
        json.dump(status_payload, status_file, ensure_ascii=False, indent=2)


def persist_progress(records: List[Dict], current_keyword: Optional[str], keyword_index: int) -> None:
    """即時寫入 JSON/CSV 並更新狀態檔。"""
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as json_file:
        json.dump(records, json_file, ensure_ascii=False, indent=2)

    save_csv(records)
    update_status_file(records, current_keyword, keyword_index)


def record_signature(keyword: str, url: str) -> Tuple[str, str]:
    return keyword, url


# SERP rank to score mapping
def rank_to_score(rank: int) -> int:
    """Convert SERP rank (1-10) to quality score (0-100)."""
    rank_score_map = {
        1: 100,
        2: 95,
        3: 90,
        4: 85,
        5: 80,
        6: 75,
        7: 70,
        8: 65,
        9: 60,
        10: 55
    }
    return rank_score_map.get(rank, 50)


def fetch_serp_results(keyword: str) -> List[Dict]:
    """Fetch top 10 SERP results using multi-service manager with automatic failover."""
    manager = get_serp_manager()
    tracker = get_cost_tracker()
    
    print(f"  Fetching SERP for: {keyword}")
    results, error, service = manager.fetch(keyword)
    
    # Track API usage
    service_name = service.lower().replace('api', '').replace('serp', '').strip() if service else 'unknown'
    tracker.record_request(service_name, success=(results is not None))
    
    if results:
        print(f"    ✓ Got {len(results)} results from {service}")
        return results
    else:
        print(f"    ✗ Error: {error}")
        return []


def analyze_url(url: str, keyword: str) -> Optional[Dict]:
    """Call our /analyze API to extract features for a URL, with retry support."""
    if not url:
        return None
    
    payload = {
        'contentUrl': url,
        'targetKeywords': [keyword],
        'returnChunks': False
    }
    
    for attempt in range(1, ANALYZE_RETRY_ATTEMPTS + 1):
        try:
            print(f"    Analyzing: {url[:60]}... (attempt {attempt}/{ANALYZE_RETRY_ATTEMPTS})")
            response = requests.post(ANALYZE_API_URL, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            # Extract features from response
            signals = data.get('contentSignals', {})
            flags = data.get('scoreGuards', {}).get('contentQualityFlags', {})
            hcu_counts = data.get('scoreGuards', {}).get('hcuCounts', {})
            
            # Build feature vector (matching scoring-model.js buildFeatureVector)
            total_hcu = hcu_counts.get('yes', 0) + hcu_counts.get('partial', 0) + hcu_counts.get('no', 0)
            hcu_yes_ratio = hcu_counts.get('yes', 0) / total_hcu if total_hcu > 0 else 0
            hcu_no_ratio = hcu_counts.get('no', 0) / total_hcu if total_hcu > 0 else 0
            
            features = {
                'wordCountNorm': min(1.0, signals.get('wordCount', 0) / 1500),
                'paragraphCountNorm': min(1.0, signals.get('paragraphCount', 0) / 12),
                'h2CountNorm': min(1.0, signals.get('h2Count', 0) / 8),
                'actionableScoreNorm': min(1.0, signals.get('actionableScore', 0) / 4),
                'evidenceCountNorm': min(1.0, signals.get('evidenceCount', 0) / 6),
                'experienceCueNorm': min(1.0, signals.get('experienceCueCount', 0) / 4),
                'recentYearNorm': min(1.0, signals.get('recentYearCount', 0) / 3),
                'uniqueWordRatio': signals.get('uniqueWordRatio', 0),
                'titleIntentMatch': signals.get('titleIntentMatch', 0),
                'referenceKeywordNorm': min(1.0, signals.get('referenceKeywordCount', 0) / 6),
                'hasH1Keyword': 1 if signals.get('h1ContainsKeyword') else 0,
                'hasUniqueTitle': 1 if signals.get('hasUniqueTitle') else 0,
                'hasAuthorInfo': 1 if signals.get('hasAuthorInfo') else 0,
                'hasPublisherInfo': 1 if signals.get('hasPublisherInfo') else 0,
                'hasArticleSchema': 1 if signals.get('hasArticleSchema') else 0,
                'hasPublishedDate': 1 if signals.get('hasPublishedDate') else 0,
                'hasModifiedDate': 1 if signals.get('hasModifiedDate') else 0,
                'hasVisibleDate': 1 if signals.get('hasVisibleDate') else 0,
                'metaDescriptionPresent': 1 if signals.get('hasMetaDescription') else 0,
                'canonicalPresent': 1 if signals.get('hasCanonical') else 0,
                'externalLinkPresent': 1 if signals.get('externalLinkCount', 0) > 0 else 0,
                'authorityLinkPresent': 1 if signals.get('externalAuthorityLinkCount', 0) > 0 else 0,
                'listPresent': 1 if signals.get('listCount', 0) > 0 else 0,
                'tablePresent': 1 if signals.get('tableCount', 0) > 0 else 0,
                'longParagraphPenalty': 1 if signals.get('paragraphAverageLength', 0) > 420 else 0,
                'avgSentenceLengthNorm': min(1.0, (signals.get('avgSentenceLength', 0) or 20) / 40),
                'depthLowFlag': 1 if flags.get('depthLow') else 0,
                'readabilityWeakFlag': 1 if flags.get('readabilityWeak') else 0,
                'actionableWeakFlag': 1 if flags.get('actionableWeak') else 0,
                'freshnessWeakFlag': 1 if flags.get('freshnessWeak') else 0,
                'titleMismatchFlag': 1 if flags.get('titleMismatch') else 0,
                'hcuYesRatio': hcu_yes_ratio,
                'hcuNoRatio': hcu_no_ratio
            }
            
            print(f"      ✓ Features extracted")
            return features
        
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else None
            print(f"      ✗ HTTP error analyzing URL: {e} (status {status_code})")
            if status_code == 429 and attempt < ANALYZE_RETRY_ATTEMPTS:
                wait_seconds = ANALYZE_RETRY_DELAY_SECONDS * attempt
                print(f"        → 等待 {wait_seconds:.0f} 秒後重試 (避免限流)")
                time.sleep(wait_seconds)
                continue
            if status_code in (500, 502, 503, 504) and attempt < ANALYZE_RETRY_ATTEMPTS:
                wait_seconds = ANALYZE_RETRY_DELAY_SECONDS * attempt
                print(f"        → 等待 {wait_seconds:.0f} 秒後重試 (伺服器錯誤)")
                time.sleep(wait_seconds)
                continue
            return None
        except requests.exceptions.RequestException as e:
            print(f"      ✗ Error analyzing URL: {e}")
            if attempt < ANALYZE_RETRY_ATTEMPTS:
                wait_seconds = ANALYZE_RETRY_DELAY_SECONDS * attempt
                print(f"        → 等待 {wait_seconds:.0f} 秒後重試")
                time.sleep(wait_seconds)
                continue
            return None
    
    return None


def collect_training_data():
    """Main collection flow."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    training_data = load_existing_data()
    seen_records = {record_signature(item['keyword'], item['url']) for item in training_data}
    if training_data:
        print(f"  ↻ 已載入既有資料 {len(training_data)} 筆（{len({item['keyword'] for item in training_data})} 組關鍵字）")
    else:
        persist_progress(training_data, None, -1)

    print(f"\n{'='*60}")
    print(f"SERP Data Collection - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    for keyword_index, keyword in enumerate(KEYWORDS):
        print(f"\n[{keyword_index + 1}/{len(KEYWORDS)}] Processing keyword: {keyword}")

        serp_results = fetch_serp_results(keyword)
        if not serp_results:
            update_status_file(training_data, keyword, keyword_index)
            continue

        if KEYWORD_DELAY_SECONDS > 0 and keyword_index > 0:
            time.sleep(KEYWORD_DELAY_SECONDS)  # Rate limiting between keywords

        for result in serp_results:
            url = result['url']
            signature = record_signature(keyword, url)
            if signature in seen_records:
                print(f"      ↻ 已存在記錄，略過 {url[:60]}...")
                continue

            rank = result['rank']
            target_score = rank_to_score(rank)

            features = analyze_url(url, keyword)
            if not features:
                continue

            record = {
                'url': url,
                'keyword': keyword,
                'serp_rank': rank,
                'target_score': target_score,
                'title': result.get('title', ''),
                'features': features
            }

            training_data.append(record)
            seen_records.add(signature)
            persist_progress(training_data, keyword, keyword_index)
            print(f"      ✓ 已儲存（累計 {len(training_data)} 筆）")

            if URL_DELAY_SECONDS > 0:
                time.sleep(URL_DELAY_SECONDS)  # Rate limiting between URLs

    persist_progress(training_data, None, len(KEYWORDS))

    print(f"\n{'='*60}")
    print(f"Collection completed: {len(training_data)} records")
    print(f"Output files:")
    print(f"  - {OUTPUT_JSON}")
    print(f"  - {OUTPUT_CSV}")
    print(f"  - {STATUS_JSON}")
    print(f"{'='*60}")

    # Print SERP manager status
    manager = get_serp_manager()
    manager.print_status()

    # Print cost summary
    tracker = get_cost_tracker()
    tracker.print_summary()
    tracker.export_csv()

if __name__ == '__main__':
    collect_training_data()
