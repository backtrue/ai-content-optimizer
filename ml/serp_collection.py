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
from collections import Counter
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
from serp_manager import get_manager as get_serp_manager
from cost_tracker import get_tracker as get_cost_tracker
from sheets_writer import get_sheets_writer, BASE_COLUMNS


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
MIN_RESULTS_PER_KEYWORD = int(os.getenv('SERP_MIN_RESULTS_PER_KEYWORD', '10'))
ANALYZE_RETRY_ATTEMPTS = int(os.getenv('SERP_ANALYZE_RETRIES', '3'))
ANALYZE_RETRY_DELAY_SECONDS = float(os.getenv('SERP_ANALYZE_RETRY_DELAY_SECONDS', '20'))

# Keywords to analyze (可由環境變數覆寫)
def _load_keywords() -> List[str]:
    env_keywords = os.getenv('SERP_KEYWORDS_JSON')
    if env_keywords:
        try:
            data = json.loads(env_keywords)
            if isinstance(data, list):
                return [str(item) for item in data if isinstance(item, str) and item.strip()]
        except json.JSONDecodeError:
            print('⚠️ SERP_KEYWORDS_JSON 解析失敗，改用預設關鍵字清單')
    return [
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


KEYWORDS = _load_keywords()


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


def update_status_file(
    records: List[Dict],
    current_keyword: Optional[str],
    keyword_index: int,
    keyword_total: Optional[int] = None
) -> None:
    """輸出蒐集狀態 JSON，提供監控腳本與人工快速檢視。"""
    keyword_total = keyword_total if keyword_total is not None else len(KEYWORDS)
    unique_keywords = {item['keyword'] for item in records}
    status_payload = {
        'timestamp': datetime.now().isoformat(),
        'total_records': len(records),
        'unique_keywords': len(unique_keywords),
        'current_keyword': current_keyword,
        'current_keyword_index': keyword_index,
        'progress_percent': round(len(unique_keywords) / keyword_total * 100, 2) if keyword_total else 0,
        'remaining_keywords': max(0, keyword_total - len(unique_keywords)) if keyword_total else 0
    }

    with open(STATUS_JSON, 'w', encoding='utf-8') as status_file:
        json.dump(status_payload, status_file, ensure_ascii=False, indent=2)


def persist_progress(
    records: List[Dict],
    current_keyword: Optional[str],
    keyword_index: int,
    *,
    keyword_total: Optional[int] = None,
    persist_local: bool = True,
    update_status: bool = True,
    sync_to_sheets: bool = True,
    sheets_writer=None
) -> None:
    """根據設定寫入進度檔案、狀態與 Google Sheets。"""
    if persist_local:
        with open(OUTPUT_JSON, 'w', encoding='utf-8') as json_file:
            json.dump(records, json_file, ensure_ascii=False, indent=2)
        save_csv(records)

    if update_status:
        update_status_file(records, current_keyword, keyword_index, keyword_total)

    if not sync_to_sheets or current_keyword is None or not records:
        return

    writer = sheets_writer or get_sheets_writer()
    if not writer:
        return

    try:
        writer.append_record(records[-1])
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


def collect_keywords(
    keywords: List[str],
    *,
    keyword_offset: int = 0,
    total_keywords: Optional[int] = None,
    persist_local: bool = True,
    sync_to_sheets: bool = True,
    update_status: bool = True,
    keyword_delay: Optional[float] = None,
    url_delay: Optional[float] = None,
    sheets_writer=None
) -> Dict[str, Any]:
    """針對指定關鍵字批次蒐集 SERP 資料並回傳摘要。"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total_keywords = total_keywords if total_keywords is not None else max(keyword_offset + len(keywords), len(KEYWORDS))
    keyword_delay = KEYWORD_DELAY_SECONDS if keyword_delay is None else keyword_delay
    url_delay = URL_DELAY_SECONDS if url_delay is None else url_delay

    training_data = load_existing_data()
    seen_records = {record_signature(item['keyword'], item['url']) for item in training_data}
    keyword_counts = Counter(item['keyword'] for item in training_data)

    writer = sheets_writer or get_sheets_writer()
    processed_keywords = writer.get_processed_keywords() if writer else set()

    if training_data and persist_local:
        print(f"  ↻ 已載入既有資料 {len(training_data)} 筆（{len({item['keyword'] for item in training_data})} 組關鍵字）")
    elif not training_data and persist_local:
        persist_progress(training_data, None, -1, keyword_total=total_keywords, persist_local=persist_local, update_status=update_status, sync_to_sheets=False, sheets_writer=writer)

    start_time = time.time()
    new_records = 0
    skipped_existing = 0
    errors: List[str] = []

    if persist_local:
        print(f"\n{'='*60}")
        print(f"SERP Data Collection - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")

    for batch_index, keyword in enumerate(keywords):
        global_index = keyword_offset + batch_index
        if persist_local:
            print(f"\n[{global_index + 1}/{total_keywords}] Processing keyword: {keyword}")

        if writer and keyword in processed_keywords:
            if persist_local:
                print("  ↻ 已標記完成，略過關鍵字")
            if update_status:
                update_status_file(training_data, keyword, global_index, total_keywords)
            continue

        if keyword_counts.get(keyword, 0) >= MIN_RESULTS_PER_KEYWORD:
            if persist_local:
                print(f"  ↻ 已累積 {keyword_counts[keyword]} 筆結果，略過 SERP 叫用")
            if update_status:
                update_status_file(training_data, keyword, global_index, total_keywords)
            if writer:
                writer.mark_keyword_processed(keyword)
                processed_keywords.add(keyword)
            continue

        serp_results = fetch_serp_results(keyword)
        if not serp_results:
            if update_status:
                update_status_file(training_data, keyword, global_index, total_keywords)
            errors.append(f"SERP fetch failed: {keyword}")
            continue

        if keyword_delay and keyword_delay > 0 and batch_index > 0:
            time.sleep(keyword_delay)

        for result in serp_results:
            url = result['url']
            signature = record_signature(keyword, url)
            if signature in seen_records:
                skipped_existing += 1
                if persist_local:
                    print(f"      ↻ 已存在記錄，略過 {url[:60]}...")
                continue

            rank = result['rank']
            target_score = rank_to_score(rank)

            features = analyze_url(url, keyword)
            if not features:
                errors.append(f"Analyze failed: {url}")
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
            keyword_counts[keyword] += 1
            new_records += 1

            persist_progress(
                training_data,
                keyword,
                global_index,
                keyword_total=total_keywords,
                persist_local=persist_local,
                update_status=update_status,
                sync_to_sheets=sync_to_sheets,
                sheets_writer=writer
            )

            if persist_local:
                print(f"      ✓ 已儲存（累計 {len(training_data)} 筆）")

            if url_delay and url_delay > 0:
                time.sleep(url_delay)

        if writer:
            writer.mark_keyword_processed(keyword)
            processed_keywords.add(keyword)

    if update_status:
        persist_progress(
            training_data,
            None,
            keyword_offset + len(keywords),
            keyword_total=total_keywords,
            persist_local=persist_local,
            update_status=update_status,
            sync_to_sheets=False,
            sheets_writer=writer
        )

    elapsed = time.time() - start_time

    if persist_local:
        print(f"\n{'='*60}")
        print(f"Collection completed: {len(training_data)} records (新增 {new_records} 筆，略過 {skipped_existing} 筆)")
        if persist_local:
            print(f"Output files:")
            print(f"  - {OUTPUT_JSON}")
            print(f"  - {OUTPUT_CSV}")
            print(f"  - {STATUS_JSON}")
        print(f"耗時：{elapsed:.1f} 秒")
        print(f"{'='*60}")

        manager = get_serp_manager()
        manager.print_status()

        tracker = get_cost_tracker()
        tracker.print_summary()
        tracker.export_csv()

    return {
        'keywordsProcessed': len(keywords),
        'newRecords': new_records,
        'skippedExisting': skipped_existing,
        'errors': errors,
        'elapsedSeconds': elapsed,
        'totalRecords': len(training_data)
    }


def collect_training_data():
    return collect_keywords(KEYWORDS)


if __name__ == '__main__':
    collect_training_data()
