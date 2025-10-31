#!/usr/bin/env python3
"""本地端 SERP 蒐集啟動腳本。

預設行為：
1. 載入 `.env.serp` 等設定。
2. 針對預設的 98 個關鍵字呼叫 `collect_keywords`。
3. 同步進度與最新紀錄到 Google Sheet，維持 collection_progress 記錄。
4. 同步輸出 JSON/CSV 與本地進度檔。

可使用 `--disable-sheets` 關閉 Google Sheet 同步。"""

import argparse
import os
from datetime import datetime
from typing import Iterable, List

from serp_collection import KEYWORDS, collect_keywords, load_env_variables
from sheets_writer import get_sheets_writer, reset_sheets_writer_cache


def _print_summary(result: dict) -> None:
    print("\n" + "=" * 60)
    print("本地 SERP 蒐集完成")
    print("- 完成時間:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("- 已處理關鍵字數:", result.get("keywordsProcessed"))
    print("- 新增紀錄數:", result.get("newRecords"))
    print("- 略過既有紀錄數:", result.get("skippedExisting"))
    print("- 總筆數:", result.get("totalRecords"))

    errors: Iterable[str] = result.get("errors") or []
    if errors:
        print("- 發生錯誤 (僅列前 5 筆):")
        for message in list(errors)[:5]:
            print("    ·", message)
    else:
        print("- 發生錯誤: 無")

    print("=" * 60 + "\n")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="本地 SERP 蒐集工具")
    parser.add_argument(
        "--disable-sheets",
        action="store_true",
        help="關閉 Google Sheet 同步（僅寫入本地檔案）",
    )
    parser.add_argument(
        "--keywords",
        type=str,
        help="以逗號分隔的關鍵字清單，未提供則使用預設列表",
    )
    return parser.parse_args()


def _resolve_keywords(arg_keywords: str | None) -> List[str]:
    if not arg_keywords:
        return KEYWORDS
    custom = [kw.strip() for kw in arg_keywords.split(",") if kw.strip()]
    return custom or KEYWORDS


def _filter_processed_keywords(keywords: List[str], disable_sheets: bool) -> List[str]:
    if disable_sheets:
        return keywords

    writer = get_sheets_writer()
    if not writer:
        print("⚠️ 取得 Sheets 寫入器失敗，將略過 collection_progress 檢查")
        return keywords

    processed = writer.get_processed_keywords()
    processed_sample = list(processed)[:5]
    print(f"ℹ️ collection_progress 已記錄 {len(processed)} 個關鍵字：{processed_sample}")

    if not processed:
        return keywords

    remaining = [kw for kw in keywords if kw not in processed]
    if not remaining:
        print("⚠️ Google Sheets collection_progress 顯示所有關鍵字皆已處理")
        return []

    skipped = len(keywords) - len(remaining)
    if skipped:
        print(f"ℹ️ 依據 Google Sheets collection_progress 略過 {skipped} 個已處理關鍵字")

    return remaining


def run_local_collection() -> None:
    """執行本地版 SERP 蒐集流程。"""
    args = _parse_args()

    load_env_variables()

    # 硬編碼 Google Sheet 設定（暫時策略）
    os.environ["SHEETS_TRAINING_DATA_ID"] = "1TFi2lUHtlft4XuJBxTlnvi9Svd_9pXDVOLttCDB248Y"
    os.environ["SHEETS_TRAINING_DATA_TAB"] = "training_data"

    # 重新初始化 Sheets writer（避免沿用載入前的快取）
    reset_sheets_writer_cache()

    keywords = _resolve_keywords(args.keywords)
    keywords = _filter_processed_keywords(keywords, args.disable_sheets)

    if not keywords:
        print("✅ 無剩餘關鍵字需要處理。")
        return

    result = collect_keywords(
        keywords,
        total_keywords=len(keywords),
        persist_local=True,
        update_status=True,
        sync_to_sheets=not args.disable_sheets,
    )

    _print_summary(result)


if __name__ == "__main__":
    run_local_collection()
