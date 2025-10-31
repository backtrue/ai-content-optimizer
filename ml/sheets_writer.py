"""Utility for appending SERP training data to Google Sheets."""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Set

import gspread
from google.oauth2.service_account import Credentials

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
BASE_COLUMNS = ["url", "keyword", "serp_rank", "target_score", "title"]
PROGRESS_COLUMNS = ["keyword", "processed_at"]


class SheetsWriterConfigError(RuntimeError):
    """Raised when Google Sheets integration is not fully configured."""


class SheetsWriter:
    """Append training data rows to a Google Sheets worksheet and track progress."""

    def __init__(self, spreadsheet: gspread.Spreadsheet, worksheet: gspread.Worksheet, progress_title: Optional[str]) -> None:
        self._spreadsheet = spreadsheet
        self._worksheet = worksheet
        self._progress_title = progress_title or None
        self._progress_sheet: Optional[gspread.Worksheet] = None
        self._header: Optional[List[str]] = None
        self._processed_cache: Optional[Set[str]] = None

    @classmethod
    def from_env(cls) -> "SheetsWriter":
        sheet_id = os.getenv("SHEETS_TRAINING_DATA_ID")
        if not sheet_id:
            raise SheetsWriterConfigError("Missing SHEETS_TRAINING_DATA_ID env variable")

        worksheet_title = os.getenv("SHEETS_TRAINING_DATA_TAB")
        progress_title = os.getenv("SHEETS_PROGRESS_TAB", "collection_progress")
        credentials = _load_credentials()

        client = gspread.authorize(credentials)
        spreadsheet = client.open_by_key(sheet_id)
        if worksheet_title:
            worksheet = spreadsheet.worksheet(worksheet_title)
        else:
            worksheet = spreadsheet.sheet1

        return cls(spreadsheet, worksheet, progress_title)

    def append_record(self, record: Dict) -> None:
        if not record:
            return

        features = record.get("features", {}) or {}
        try:
            self._ensure_header(features)
        except Exception as e:
            print(f"⚠️ 更新 Sheets 表頭失敗：{e}")
            return

        flat: Dict[str, object] = {
            "url": record.get("url", ""),
            "keyword": record.get("keyword", ""),
            "serp_rank": record.get("serp_rank", ""),
            "target_score": record.get("target_score", ""),
            "title": record.get("title", ""),
        }
        flat.update(features)

        assert self._header is not None  # defensive: ensured in _ensure_header
        row = [flat.get(column, "") for column in self._header]
        if not self._append_row_with_retry(self._worksheet, row):
            print("⚠️ 追加列至 Google Sheets 失敗（非致命）：超出重試次數")

    def fetch_all_records(self) -> List[Dict[str, object]]:
        """Return all rows (excluding header) as dicts keyed by header."""
        self._ensure_header({})
        return self._worksheet.get_all_records()

    def get_processed_keywords(self) -> Set[str]:
        sheet = self._get_or_create_progress_sheet()
        if sheet is None:
            return set()

        if self._processed_cache is not None:
            return set(self._processed_cache)

        records = sheet.get_all_records()
        keywords = {row.get("keyword") for row in records if row.get("keyword")}
        self._processed_cache = keywords
        return set(keywords)

    def mark_keyword_processed(self, keyword: str) -> None:
        if not keyword:
            return

        sheet = self._get_or_create_progress_sheet()
        if sheet is None:
            return

        keywords = self.get_processed_keywords()
        if keyword in keywords:
            return

        timestamp = datetime.utcnow().isoformat()
        if self._append_row_with_retry(sheet, [keyword, timestamp]):
            keywords.add(keyword)
            self._processed_cache = keywords

    def _append_row_with_retry(self, sheet: gspread.Worksheet, row: List[object], retries: int = 3, base_delay: float = 1.5) -> bool:
        for attempt in range(1, retries + 1):
            try:
                sheet.append_row(row, value_input_option="RAW")
                return True
            except gspread.exceptions.APIError as exc:
                status = getattr(exc.response, "status_code", None)
                print(
                    f"⚠️ append_row APIError (attempt {attempt}/{retries}) 狀態={status} 訊息={exc}"
                )
            except Exception as exc:  # pylint: disable=broad-except
                print(
                    f"⚠️ append_row 發生非預期錯誤 (attempt {attempt}/{retries}): {exc}"
                )

            if attempt < retries:
                sleep_seconds = base_delay * attempt
                time.sleep(sleep_seconds)

        return False

    def _ensure_header(self, features: Dict[str, object]) -> None:
        if self._header is None:
            existing = [value.strip() for value in self._worksheet.row_values(1) if value.strip()]
            if existing:
                self._header = existing
            else:
                self._header = BASE_COLUMNS + sorted(features.keys())
                self._worksheet.update("A1", [self._header])
                return

        assert self._header is not None
        expected = BASE_COLUMNS + sorted(features.keys())
        missing = [column for column in expected if column not in self._header]
        if missing:
            self._header.extend(missing)
            self._worksheet.update("A1", [self._header])

    def _get_or_create_progress_sheet(self) -> Optional[gspread.Worksheet]:
        if not self._progress_title:
            return None

        if self._progress_sheet is not None:
            return self._progress_sheet

        try:
            sheet = self._spreadsheet.worksheet(self._progress_title)
        except gspread.WorksheetNotFound:
            sheet = self._spreadsheet.add_worksheet(title=self._progress_title, rows=200, cols=len(PROGRESS_COLUMNS))
            sheet.update("A1", [PROGRESS_COLUMNS])

        self._progress_sheet = sheet
        return sheet


_writer_lock = threading.Lock()
_writer_instance: Optional[SheetsWriter] = None
_writer_disabled = False


def get_sheets_writer() -> Optional[SheetsWriter]:
    global _writer_instance, _writer_disabled

    with _writer_lock:
        if _writer_instance is not None:
            return _writer_instance
        if _writer_disabled:
            return None

        try:
            _writer_instance = SheetsWriter.from_env()
        except SheetsWriterConfigError as exc:
            print(f"ℹ️ 已停用 Google Sheets 寫入功能：{exc}")
            _writer_disabled = True
        except Exception as exc:  # pylint: disable=broad-except
            print(f"⚠️ 初始化 Google Sheets 寫入器失敗：{exc}")
            _writer_disabled = True

        return _writer_instance


def _load_credentials() -> Credentials:
    embedded = os.getenv("SHEETS_CREDENTIALS")
    path = os.getenv("SHEETS_CREDENTIALS_PATH")

    credentials_info: Optional[Dict] = None

    if embedded:
        data = embedded.strip()
        if data.startswith("{"):
            credentials_info = json.loads(data)
        else:
            path = path or data

    if credentials_info is None:
        if not path:
            raise SheetsWriterConfigError("Missing SHEETS_CREDENTIALS or SHEETS_CREDENTIALS_PATH")
        with open(path, "r", encoding="utf-8") as handle:
            credentials_info = json.load(handle)

    return Credentials.from_service_account_info(credentials_info, scopes=SCOPES)


def reset_sheets_writer_cache() -> None:
    """重置 SheetsWriter 的單例快取，讓環境變數變更後可重新初始化。"""
    global _writer_instance, _writer_disabled
    with _writer_lock:
        _writer_instance = None
        _writer_disabled = False
