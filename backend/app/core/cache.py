import hashlib
import json
import logging
import os

from redis import Redis
from redis.exceptions import RedisError


logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "")
_client = Redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None
CACHE_TTL_SECONDS = 300


def cache_key(namespace: str, identity: str, parameters: dict) -> str:
    canonical = json.dumps(parameters, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"retail-pulse:{namespace}:{identity}:{digest}"


def get_cached_json(key: str):
    if _client is None:
        return None
    try:
        value = _client.get(key)
        return json.loads(value) if value is not None else None
    except (RedisError, json.JSONDecodeError) as error:
        logger.warning("Redis cache read failed; recalculating response: %s", error)
        return None


def set_cached_json(key: str, value):
    if _client is None:
        return
    try:
        _client.setex(key, CACHE_TTL_SECONDS, json.dumps(value, separators=(",", ":")))
    except (RedisError, TypeError) as error:
        logger.warning("Redis cache write failed; serving calculated response: %s", error)


def invalidate_dataset_cache(dataset_id: int):
    if _client is None:
        return
    pattern = f"retail-pulse:dashboard:*dataset-{dataset_id}:*"
    try:
        keys = list(_client.scan_iter(match=pattern, count=200))
        if keys:
            _client.delete(*keys)
    except RedisError as error:
        logger.warning("Redis cache invalidation failed for dataset %s: %s", dataset_id, error)


def cache_status() -> str:
    if _client is None:
        return "not_configured"
    try:
        return "available" if _client.ping() else "unavailable"
    except RedisError:
        return "unavailable"
