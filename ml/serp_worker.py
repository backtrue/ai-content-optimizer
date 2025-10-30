#!/usr/bin/env python3
"""Cloud Run Worker：接收 Cloud Tasks 觸發的 SERP 收集請求。"""

import json
import logging
import os
from typing import Any, Dict

from flask import Flask, jsonify, request

from serp_collection import (
    KEYWORDS,
    collect_keywords,
    load_env_variables,
)

load_env_variables()

logging.basicConfig(level=os.getenv("SERP_WORKER_LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.route("/healthz", methods=["GET"])
def healthz() -> Any:
    return jsonify({"status": "ok", "keywords": len(KEYWORDS)})


@app.route("/collect", methods=["POST"])
def collect() -> Any:
    try:
        payload: Dict[str, Any] = request.get_json(force=True, silent=False) or {}
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Invalid JSON payload: %s", exc)
        return jsonify({"error": "invalid_json", "details": str(exc)}), 400

    keywords = payload.get("keywords")
    if not isinstance(keywords, list) or not all(isinstance(item, str) for item in keywords):
        return jsonify({"error": "invalid_keywords", "details": "keywords 應為字串陣列"}), 400

    keyword_offset = int(payload.get("keywordOffset", 0))
    total_keywords = payload.get("totalKeywords")
    total_keywords = int(total_keywords) if total_keywords is not None else None

    persist_local = bool(payload.get("persistLocal", False))
    update_status = bool(payload.get("updateStatus", False))
    sync_to_sheets = bool(payload.get("syncToSheets", True))

    keyword_delay = payload.get("keywordDelay")
    url_delay = payload.get("urlDelay")

    logger.info(
        "Received batch: size=%d offset=%d total=%s persist_local=%s",
        len(keywords),
        keyword_offset,
        total_keywords,
        persist_local,
    )

    try:
        result = collect_keywords(
            keywords,
            keyword_offset=keyword_offset,
            total_keywords=total_keywords,
            persist_local=persist_local,
            update_status=update_status,
            sync_to_sheets=sync_to_sheets,
            keyword_delay=keyword_delay,
            url_delay=url_delay,
        )
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Batch failed: %s", exc)
        return jsonify({"error": "collect_failed", "details": str(exc)}), 500

    return jsonify({"status": "ok", "result": result})


def create_app() -> Flask:
    return app


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    app.run(host="0.0.0.0", port=port)
