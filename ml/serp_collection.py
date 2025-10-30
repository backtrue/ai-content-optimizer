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
from sheets_writer import get_sheets_writer


def load_env_variables() -> Optional[str]:
    """嘗試載入本地環境檔，讓腳本可直接使用 .env 設定。"""
    candidate_files = ['.env.serp', '.env', '.env.serp.local', '.env.serp.example']

    def _parse_and_set(path: str) -> None:
        with open(path, 'r', encoding='utf-8') as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' not in line:
                    continue
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                if value and len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                    value = value[1:-1]
                os.environ[key] = value

    for filename in candidate_files:
        if os.path.exists(filename):
            _parse_and_set(filename)
            print(f"⚙️ 已載入環境設定檔：{filename}")
            return filename

    return None


load_env_variables()

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
    """載入既有訓練資料，若本地檔案不存在則嘗試從 Google Sheets 讀取。"""
    if os.path.exists(OUTPUT_JSON):
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

    sheets_writer = get_sheets_writer()
    if not sheets_writer:
        return []

    try:
        sheet_records = sheets_writer.fetch_all_records()
        records: List[Dict] = []
        for row in sheet_records:
            features = {k: v for k, v in row.items() if k not in BASE_COLUMNS}
            record = {
                'url': row.get('url', ''),
                'keyword': row.get('keyword', ''),
                'serp_rank': row.get('serp_rank', ''),
                'target_score': row.get('target_score', ''),
                'title': row.get('title', ''),
                'features': features
            }
            records.append(record)
        if records:
            print(f"🧾 已從 Google Sheets 讀入 {len(records)} 筆既有資料")
        return records
    except Exception as exc:  # pylint: disable=broad-except
        print(f"⚠️ 從 Google Sheets 讀取資料時失敗：{exc}")
        return []


def save_csv(records: List[Dict]) -> None:
    """覆寫輸出 CSV，以便即時檢視最新資料。"""
    if not records:
        if os.path.exists(OUTPUT_CSV):
            os.remove(OUTPUT_CSV)
        return

    feature_fields: List[str] = []
    for record in records:
        features = record.get('features', {})
        if not isinstance(features, dict):
            continue
        for key in features.keys():
            if key not in feature_fields:
                feature_fields.append(key)

    fieldnames = ['url', 'keyword', 'serp_rank', 'target_score', 'title'] + feature_fields
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
            row.update(record.get('features', {}))
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
    """即時寫入 JSON/CSV 並更新狀態檔，並嘗試同步至 Google Sheets。"""
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as json_file:
        json.dump(records, json_file, ensure_ascii=False, indent=2)

    save_csv(records)
    update_status_file(records, current_keyword, keyword_index)

    if current_keyword is None or not records:
        return

    sheets_writer = get_sheets_writer()
    if not sheets_writer:
        return

    try:
        sheets_writer.append_record(records[-1])
        print("  ↻ 已同步最新紀錄至 Google Sheets")
    except Exception as exc:  # pylint: disable=broad-except
        print(f"⚠️ 寫入 Google Sheets 失敗：{exc}")


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
            
            # 計算 HCU 相關特徵
            total_hcu = hcu_counts.get('yes', 0) + hcu_counts.get('partial', 0) + hcu_counts.get('no', 0)
            hcu_yes_ratio = hcu_counts.get('yes', 0) / total_hcu if total_hcu > 0 else 0
            hcu_partial_ratio = hcu_counts.get('partial', 0) / total_hcu if total_hcu > 0 else 0
            hcu_no_ratio = hcu_counts.get('no', 0) / total_hcu if total_hcu > 0 else 0
            hcu_content_helpfulness = (hcu_yes_ratio + hcu_partial_ratio * 0.5) if total_hcu > 0 else 0
            
            # 內容結構特徵
            qa_format_score = min(1.0, signals.get('qaFormatScore', 0))
            first_para_answer_quality = min(1.0, signals.get('firstParagraphAnswerQuality', 0))
            semantic_paragraph_focus = min(1.0, signals.get('semanticParagraphFocus', 0))
            heading_hierarchy_quality = min(1.0, signals.get('headingHierarchyQuality', 0))
            topic_cohesion = min(1.0, signals.get('topicCohesion', 0))
            
            # 技術與標記特徵
            faq_schema_present = 1 if signals.get('faqSchemaPresent') else 0
            howto_schema_present = 1 if signals.get('howtoSchemaPresent') else 0
            article_schema_present = 1 if signals.get('articleSchemaPresent') else 0
            organization_schema_present = 1 if signals.get('organizationSchemaPresent') else 0
            og_tags_complete = min(1.0, signals.get('ogTagsComplete', 0))
            meta_tags_quality = min(1.0, signals.get('metaTagsQuality', 0))
            html_structure_validity = min(1.0, signals.get('htmlStructureValidity', 0))
            
            # 品牌實體與信任特徵
            author_info_present = 1 if signals.get('authorInfoPresent') else 0
            brand_entity_clarity = min(1.0, signals.get('brandEntityClarity', 0))
            external_citation_count = min(1.0, signals.get('externalCitationCount', 0) / 10)
            social_media_links_present = 1 if signals.get('socialMediaLinksPresent') else 0
            review_rating_present = 1 if signals.get('reviewRatingPresent') else 0
            
            # AI 搜尋適配特徵
            semantic_naturalness = min(1.0, signals.get('semanticNaturalness', 0))
            paragraph_extractability = min(1.0, signals.get('paragraphExtractability', 0))
            rich_snippet_format = min(1.0, signals.get('richSnippetFormat', 0))
            citability_trust_score = min(1.0, signals.get('citabilityTrustScore', 0))
            multimedia_support = min(1.0, signals.get('multimediaSupport', 0))
            
            # 保留既有的基礎特徵（向後相容）
            features = {
                # HCU 特徵
                'hcuYesRatio': hcu_yes_ratio,
                'hcuPartialRatio': hcu_partial_ratio,
                'hcuNoRatio': hcu_no_ratio,
                'hcuContentHelpfulness': hcu_content_helpfulness,
                
                # 內容結構
                'qaFormatScore': qa_format_score,
                'firstParagraphAnswerQuality': first_para_answer_quality,
                'semanticParagraphFocus': semantic_paragraph_focus,
                'headingHierarchyQuality': heading_hierarchy_quality,
                'topicCohesion': topic_cohesion,
                
                # 技術與標記
                'faqSchemaPresent': faq_schema_present,
                'howtoSchemaPresent': howto_schema_present,
                'articleSchemaPresent': article_schema_present,
                'organizationSchemaPresent': organization_schema_present,
                'ogTagsComplete': og_tags_complete,
                'metaTagsQuality': meta_tags_quality,
                'htmlStructureValidity': html_structure_validity,
                
                # 品牌實體與信任
                'authorInfoPresent': author_info_present,
                'brandEntityClarity': brand_entity_clarity,
                'externalCitationCount': external_citation_count,
                'socialMediaLinksPresent': social_media_links_present,
                'reviewRatingPresent': review_rating_present,
                
                # AI 搜尋適配
                'semanticNaturalness': semantic_naturalness,
                'paragraphExtractability': paragraph_extractability,
                'richSnippetFormat': rich_snippet_format,
                'citabilityTrustScore': citability_trust_score,
                'multimediaSupport': multimedia_support,
                
                # 保留既有特徵（向後相容）
                'wordCountNorm': min(1.0, signals.get('wordCount', 0) / 1500),
                'paragraphCountNorm': min(1.0, signals.get('paragraphCount', 0) / 12),
                'h2CountNorm': min(1.0, signals.get('h2Count', 0) / 8),
                'uniqueWordRatio': signals.get('uniqueWordRatio', 0),
                'referenceKeywordNorm': min(1.0, signals.get('referenceKeywordCount', 0) / 6),
                'hasH1Keyword': 1 if signals.get('h1ContainsKeyword') else 0,
                'hasUniqueTitle': 1 if signals.get('hasUniqueTitle') else 0,
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
