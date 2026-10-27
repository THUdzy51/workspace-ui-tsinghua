"""Dependency-free local server for the portable personal workspace."""

from __future__ import annotations

import argparse
import json
import threading
import uuid
from datetime import date, datetime, timedelta
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
USER_DATA = ROOT / "user_data"
SCHEDULE_PATH = USER_DATA / "schedule.json"
TODO_PATH = USER_DATA / "todos.json"
HYDRATION_PATH = USER_DATA / "hydration.json"
GITHUB_FEEDBACK_PATH = USER_DATA / "github_feedback.json"
BING_CACHE = ROOT / "assets" / "bing_daily"
GITHUB_CACHE = ROOT / "assets" / "github_weekly"
DATA_LOCK = threading.Lock()


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def github_feedback_payload() -> dict[str, Any]:
    payload = read_json(GITHUB_FEEDBACK_PATH, {"version": 1, "not_interested": [], "archived": []}) or {}
    disliked = payload.get("not_interested", []) if isinstance(payload, dict) else []
    archived = payload.get("archived", []) if isinstance(payload, dict) else []
    return {"version": 1, "not_interested": sorted({str(name) for name in disliked if name}), "archived": sorted({str(name) for name in archived if name})}


def _github_search(search_text: str, since: str, per_page: int = 30) -> list[dict[str, Any]]:
    qualifiers = f"created:>={since} stars:>5"
    query = urlencode({"q": f"{search_text} {qualifiers}".strip(), "sort": "stars", "order": "desc", "per_page": per_page})
    request = Request(f"https://api.github.com/search/repositories?{query}", headers={"Accept": "application/vnd.github+json", "User-Agent": "Portable-Workspace/1.0", "X-GitHub-Api-Version": "2022-11-28"})
    with urlopen(request, timeout=10) as response:
        raw = json.loads(response.read().decode("utf-8"))
    return [{
        "name": item.get("name", ""), "full_name": item.get("full_name", ""),
        "description": item.get("description") or "这个项目暂时没有简介。",
        "url": item.get("html_url", ""), "language": item.get("language") or "多语言",
        "stars": int(item.get("stargazers_count", 0) or 0), "forks": int(item.get("forks_count", 0) or 0),
        "owner": (item.get("owner") or {}).get("login", ""),
    } for item in (raw.get("items") or []) if item.get("html_url") and item.get("full_name")]


def github_weekly_payload() -> dict[str, Any]:
    """Return 8 general and 4 research-related high-star repositories from the last 60 days."""
    today = date.today()
    cache_path = GITHUB_CACHE / f"github-weekly-{today.isoformat()}.json"
    cached = read_json(cache_path, None)
    since = (today - timedelta(days=59)).isoformat()
    source = "github"
    if not (isinstance(cached, dict) and cached.get("general_candidates") and cached.get("window_days") == 60 and cached.get("recommendation_version") == 2):
        try:
            general_candidates = _github_search("", since, 40)
            research_by_name: dict[str, dict[str, Any]] = {}
            for term in ("climate", "hydrology", "remote-sensing", "geospatial", "permafrost", "CESM"):
                for item in _github_search(f"{term} in:name,description", since, 15):
                    metadata = f"{item.get('name', '')} {item.get('description', '')}".lower()
                    if any(key in metadata for key in ("climate", "hydrolog", "remote sensing", "geospatial", "permafrost", "freeze-thaw", "earth observation", "earth system model", "cesm", "meteorolog", "ecosystem")):
                        research_by_name[item["full_name"]] = item
            research_candidates = sorted(research_by_name.values(), key=lambda item: item["stars"], reverse=True)
            if not general_candidates:
                raise ValueError("GitHub returned no repositories")
            cached = {"day": today.isoformat(), "since": since, "until": today.isoformat(), "window_days": 60, "recommendation_version": 2, "general_candidates": general_candidates, "research_candidates": research_candidates}
            GITHUB_CACHE.mkdir(parents=True, exist_ok=True)
            write_json(cache_path, cached)
            for old_path in GITHUB_CACHE.glob("github-weekly-*.json"):
                if old_path != cache_path:
                    old_path.unlink(missing_ok=True)
        except Exception:
            previous = sorted(GITHUB_CACHE.glob("github-weekly-*.json"), reverse=True) if GITHUB_CACHE.exists() else []
            cached = next((value for value in (read_json(path, None) for path in previous) if isinstance(value, dict) and value.get("general_candidates") and value.get("recommendation_version") == 2), None)
            source = "cache"
    if not cached:
        return {"day": today.isoformat(), "since": since, "until": today.isoformat(), "window_days": 60, "source": "unavailable", "items": []}
    feedback = github_feedback_payload()
    excluded = set(feedback["not_interested"]) | set(feedback["archived"])
    research = [item for item in cached.get("research_candidates", []) if item.get("full_name") not in excluded][:4]
    research_names = {item.get("full_name") for item in research}
    general = [item for item in cached.get("general_candidates", []) if item.get("full_name") not in excluded and item.get("full_name") not in research_names][:8]
    for item in general:
        item["recommendation_type"] = "全站热门"
    for item in research:
        item["recommendation_type"] = "研究相关"
    return {"day": today.isoformat(), "since": cached.get("since", since), "until": today.isoformat(), "window_days": 60, "source": source, "general": general, "research": research, "items": research + general, "not_interested_count": len(feedback["not_interested"]), "archived_count": len(feedback["archived"])}


def schedule_payload() -> dict[str, Any]:
    payload = read_json(SCHEDULE_PATH, {"version": 1, "events": []})
    events = payload.get("events", []) if isinstance(payload, dict) else []
    return {"version": 1, "events": events, "storage": "user_data/schedule.json"}


def todo_payload() -> dict[str, Any]:
    payload = read_json(TODO_PATH, {"version": 1, "items": []})
    items = payload.get("items", []) if isinstance(payload, dict) else []
    return {"version": 1, "items": items, "storage": "user_data/todos.json"}


def hydration_payload() -> dict[str, Any]:
    today = date.today().isoformat()
    payload = read_json(HYDRATION_PATH, {"version": 1, "goal_ml": 2000, "daily": {}})
    goal = max(100, int(payload.get("goal_ml", 2000) or 2000))
    daily = payload.get("daily", {}) if isinstance(payload.get("daily"), dict) else {}
    amount = max(0, int(daily.get(today, 0) or 0))
    return {
        "goal_ml": goal,
        "amount_ml": amount,
        "remaining_ml": max(0, goal - amount),
        "percent": min(100, round(amount / goal * 100)),
        "date": today,
    }


def bing_background_payload() -> dict[str, Any]:
    day = date.today().isoformat()
    fallback = {
        "image_url": f"/assets/tsinghua-gate-background.png?day={day}",
        "title": "Local fallback background",
        "source": "local",
        "day": day,
    }
    endpoint = f"https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN&ui_day={day}"
    try:
        request = Request(endpoint, headers={"User-Agent": "Portable-Workspace/1.0"})
        with urlopen(request, timeout=5) as response:
            metadata = json.loads(response.read().decode("utf-8"))
        image = (metadata.get("images") or [{}])[0]
        remote_url = str(image.get("url") or "").strip()
        if remote_url.startswith("/"):
            remote_url = "https://www.bing.com" + remote_url
        if not remote_url:
            return fallback
        BING_CACHE.mkdir(parents=True, exist_ok=True)
        image_path = BING_CACHE / f"bing-{day}.jpg"
        if not image_path.exists():
            with urlopen(Request(remote_url, headers={"User-Agent": "Portable-Workspace/1.0"}), timeout=8) as response:
                content = response.read()
            if len(content) < 10_000 or not content.startswith(b"\xff\xd8"):
                raise ValueError("Invalid Bing JPEG response")
            temporary = image_path.with_suffix(".tmp")
            temporary.write_bytes(content)
            temporary.replace(image_path)
        for old_path in BING_CACHE.glob("bing-*"):
            if old_path != image_path and old_path.is_file():
                old_path.unlink()
        return {
            "image_url": f"/assets/bing_daily/{image_path.name}?day={day}",
            "title": str(image.get("title") or image.get("copyright") or "Bing daily image"),
            "source": "bing",
            "day": day,
        }
    except Exception:
        return fallback


def weather_payload() -> dict[str, Any]:
    endpoint = (
        "https://api.open-meteo.com/v1/forecast?latitude=22.5431&longitude=114.0579"
        "&current=temperature_2m,weather_code&timezone=Asia%2FShanghai"
    )
    try:
        with urlopen(Request(endpoint, headers={"User-Agent": "Portable-Workspace/1.0"}), timeout=5) as response:
            current = json.loads(response.read().decode("utf-8")).get("current", {})
        return {
            "city": "Shenzhen",
            "temperature": current.get("temperature_2m"),
            "unit": current.get("temperature_2m_unit", "°C"),
            "code": current.get("weather_code"),
            "source": "open-meteo",
        }
    except Exception:
        return {"city": "Shenzhen", "temperature": None, "unit": "°C", "code": None, "source": "unavailable"}


class Handler(SimpleHTTPRequestHandler):
    server_version = "Portable-Workspace/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def send_json(self, payload: Any, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_body(self) -> dict[str, Any]:
        length = min(int(self.headers.get("Content-Length", "0")), 1_000_000)
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        routes = {
            "/api/schedule": schedule_payload,
            "/api/todos": todo_payload,
            "/api/hydration": hydration_payload,
            "/api/bing-background": bing_background_payload,
            "/api/weather": weather_payload,
            "/api/github-weekly": github_weekly_payload,
            "/api/github-feedback": github_feedback_payload,
        }
        if path in routes:
            self.send_json(routes[path]())
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        try:
            path = urlparse(self.path).path
            body = self.read_body()
            with DATA_LOCK:
                if path == "/api/github-feedback":
                    full_name = str(body.get("full_name", "")).strip()
                    action = str(body.get("action", "not_interested"))
                    if not full_name or "/" not in full_name or len(full_name) > 200:
                        raise ValueError("无效的 GitHub 仓库名称。")
                    if action not in ("not_interested", "archive"):
                        raise ValueError("未知的 GitHub 反馈操作。")
                    payload = github_feedback_payload()
                    target = "archived" if action == "archive" else "not_interested"
                    other = "not_interested" if target == "archived" else "archived"
                    payload[target] = sorted(set(payload[target]) | {full_name})
                    payload[other] = sorted(set(payload[other]) - {full_name})
                    payload["updated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
                    write_json(GITHUB_FEEDBACK_PATH, payload)
                    self.send_json(github_weekly_payload())
                    return
                if path == "/api/schedule":
                    payload = schedule_payload()
                    payload["events"].append({
                        "id": uuid.uuid4().hex,
                        "date": str(body.get("date", "")),
                        "time": str(body.get("time", "09:00")),
                        "title": str(body.get("title", "")).strip()[:120],
                    })
                    payload.pop("storage", None)
                    write_json(SCHEDULE_PATH, payload)
                    self.send_json(schedule_payload())
                    return
                if path == "/api/todos":
                    payload = todo_payload()
                    action = str(body.get("action", "add"))
                    if action == "add":
                        payload["items"].append({"id": uuid.uuid4().hex, "date": str(body.get("date", "")), "title": str(body.get("title", "")).strip()[:120], "done": False})
                    elif action == "toggle":
                        for item in payload["items"]:
                            if item.get("id") == body.get("id"):
                                item["done"] = not bool(item.get("done"))
                    elif action == "delete":
                        payload["items"] = [item for item in payload["items"] if item.get("id") != body.get("id")]
                    payload.pop("storage", None)
                    write_json(TODO_PATH, payload)
                    self.send_json(todo_payload())
                    return
                if path == "/api/hydration":
                    today = date.today().isoformat()
                    payload = read_json(HYDRATION_PATH, {"version": 1, "goal_ml": 2000, "daily": {}})
                    payload.setdefault("daily", {})
                    action = str(body.get("action", ""))
                    if action == "add":
                        payload["daily"][today] = int(payload["daily"].get(today, 0) or 0) + int(body.get("amount_ml", 0) or 0)
                    elif action == "reset":
                        payload["daily"][today] = 0
                    elif action == "set_goal":
                        payload["goal_ml"] = max(100, min(10_000, int(body.get("goal_ml", 2000) or 2000)))
                    write_json(HYDRATION_PATH, payload)
                    self.send_json(hydration_payload())
                    return
            self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        except Exception as exc:
            self.send_json({"error": f"{type(exc).__name__}: {exc}"}, HTTPStatus.BAD_REQUEST)

    def do_DELETE(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if not path.startswith("/api/schedule/"):
            self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return
        event_id = path.rsplit("/", 1)[-1]
        with DATA_LOCK:
            payload = schedule_payload()
            payload["events"] = [event for event in payload["events"] if event.get("id") != event_id]
            payload.pop("storage", None)
            write_json(SCHEDULE_PATH, payload)
        self.send_json(schedule_payload())


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the portable personal workspace.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8770)
    args = parser.parse_args()
    USER_DATA.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Personal workspace: http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
