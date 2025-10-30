#!/usr/bin/env python3
"""將關鍵字批次加入 Cloud Tasks 佇列以觸發 SERP 收集 worker。"""

import json
import math
import os
import sys
import time
from typing import List, Dict

from google.cloud import tasks_v2

from serp_collection import KEYWORDS, load_env_variables


def chunk_keywords(keywords: List[str], batch_size: int) -> List[List[str]]:
    return [keywords[i : i + batch_size] for i in range(0, len(keywords), batch_size)]


def build_task_payload(batch_keywords: List[str], batch_index: int, total_batches: int, total_keywords: int) -> Dict:
    offset = batch_index * len(batch_keywords)
    return {
        "keywords": batch_keywords,
        "keywordOffset": offset,
        "totalKeywords": total_keywords,
        "persistLocal": False,
        "updateStatus": False,
        "syncToSheets": True,
        "keywordDelay": float(os.getenv("SERP_TASK_KEYWORD_DELAY", "0")),
        "urlDelay": float(os.getenv("SERP_TASK_URL_DELAY", os.getenv("SERP_URL_DELAY_SECONDS", "12"))),
        "meta": {
            "batchIndex": batch_index,
            "totalBatches": total_batches,
            "requestedAt": time.time()
        }
    }


def main() -> None:
    load_env_variables()

    project_id = os.getenv("SERP_GCP_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT")
    queue_name = os.getenv("SERP_TASK_QUEUE", "serp-collection")
    location = os.getenv("SERP_TASK_LOCATION", "asia-east1")
    worker_url = os.getenv("SERP_WORKER_URL")
    service_account = os.getenv("SERP_TASK_SERVICE_ACCOUNT")
    audience = os.getenv("SERP_TASK_AUDIENCE", worker_url)
    batch_size = int(os.getenv("SERP_TASK_BATCH_SIZE", "5"))
    spacing_seconds = float(os.getenv("SERP_TASK_SPACING_SECONDS", "15"))

    if not project_id:
        raise RuntimeError("缺少 SERP_GCP_PROJECT 或 GOOGLE_CLOUD_PROJECT 設定")
    if not worker_url:
        raise RuntimeError("缺少 SERP_WORKER_URL 設定")
    if batch_size <= 0:
        raise ValueError("SERP_TASK_BATCH_SIZE 必須為正整數")

    keywords = [kw for kw in KEYWORDS if kw.strip()]
    if not keywords:
        print("⚠️ 無可用關鍵字，停止 enqueue")
        return

    batches = chunk_keywords(keywords, batch_size)
    total_batches = len(batches)
    print(f"📤 準備投遞 {total_batches} 批任務（共 {len(keywords)} 個關鍵字）")

    client = tasks_v2.CloudTasksClient()
    parent = client.queue_path(project_id, location, queue_name)

    created_tasks = []
    schedule_time = time.time()

    for index, batch in enumerate(batches):
        payload = build_task_payload(batch, index, total_batches, len(keywords))
        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": worker_url,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(payload, ensure_ascii=False).encode("utf-8")
            }
        }

        if service_account:
            task["http_request"]["oidc_token"] = {
                "service_account_email": service_account,
                "audience": audience
            }

        if spacing_seconds > 0:
            schedule_time += spacing_seconds
            task["schedule_time"] = {"seconds": int(schedule_time), "nanos": int((schedule_time % 1) * 1e9)}

        response = client.create_task(parent=parent, task=task)
        created_tasks.append(response.name)
        print(f"  ✓ 已建立任務 {response.name}（批次 {index + 1}/{total_batches}）")

    print("🎯 佇列投遞完成")
    print(json.dumps({
        "queue": queue_name,
        "location": location,
        "project": project_id,
        "totalTasks": total_batches,
        "tasks": created_tasks
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pylint: disable=broad-except
        print(f"❌ 發送任務失敗：{exc}")
        sys.exit(1)
