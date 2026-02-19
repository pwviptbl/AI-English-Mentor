import json
import time
from pathlib import Path

import requests

from app.core.config import settings
from app.core.logging import get_logger
from app.services.errors import ProviderRequestError, ProviderUnavailableError

logger = get_logger(__name__)

GITHUB_COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token"


class CopilotTokenManager:
    def __init__(self, token_file: Path | None = None, cache_file: Path | None = None) -> None:
        self.token_file = token_file or settings.copilot_token_file
        self.cache_file = cache_file or settings.copilot_cache_file

    def has_oauth_token(self) -> bool:
        token = self._load_oauth_token()
        return bool(token)

    def _load_oauth_token(self) -> str | None:
        if not self.token_file.exists():
            return None
        try:
            data = json.loads(self.token_file.read_text(encoding="utf-8"))
            token = data.get("access_token")
            return token if isinstance(token, str) else None
        except Exception as exc:
            logger.warning("Failed to read oauth token file: %s", exc)
            return None

    def _load_external_token(self) -> str | None:
        """Tenta carregar token de fontes externas como OpenClaw."""
        external_paths = [
            Path.home() / ".openclaw" / "credentials" / "github-copilot.token.json",
            Path.home() / ".openclaw" / "credentials" / "github-copilot.json",
        ]
        for p in external_paths:
            if p.exists():
                try:
                    data = json.loads(p.read_text(encoding="utf-8"))
                    token = data.get("token")
                    expires_at = int(data.get("expiresAt", 0))
                    now_ms = int(time.time() * 1000)
                    if token and expires_at > now_ms + 60_000:
                        logger.info("Using Copilot token from external cache: %s", p)
                        return token
                except Exception:
                    continue
        return None

    def _load_cached_internal_token(self) -> str | None:
        # 1. Tenta o cache local do projeto
        if self.cache_file.exists():
            try:
                data = json.loads(self.cache_file.read_text(encoding="utf-8"))
                token = data.get("token")
                expires_at = int(data.get("expiresAt", 0))
                now_ms = int(time.time() * 1000)
                if token and expires_at > now_ms + 60_000:
                    return token
            except Exception as exc:
                logger.warning("Failed to read copilot cache: %s", exc)

        # 2. Tenta fontes externas (OpenClaw, etc)
        return self._load_external_token()

    def _write_cache(self, token: str, expires_at_ms: int) -> None:
        payload = {
            "token": token,
            "expiresAt": expires_at_ms,
            "updatedAt": int(time.time() * 1000),
        }
        self.cache_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        self.cache_file.chmod(0o600)

    def _refresh_internal_token(self, oauth_token: str) -> str:
        response = requests.get(
            GITHUB_COPILOT_TOKEN_URL,
            headers={"Authorization": f"Bearer {oauth_token}", "Accept": "application/json"},
            timeout=10,
        )
        if response.status_code != 200:
            raise ProviderRequestError(
                f"copilot token exchange failed with status {response.status_code}: {response.text}"
            )
        data = response.json()
        token = data.get("token")
        expires_at = int(data.get("expires_at", 0))
        if not token:
            raise ProviderRequestError("copilot token exchange returned empty token")

        if expires_at < 10_000_000_000:
            expires_at = expires_at * 1000

        self._write_cache(token, expires_at)
        return token

    def get_internal_token(self, force_refresh: bool = False) -> str:
        if not force_refresh:
            cached = self._load_cached_internal_token()
            if cached:
                return cached

        oauth_token = self._load_oauth_token()
        if not oauth_token:
            raise ProviderUnavailableError("missing GitHub OAuth token")

        return self._refresh_internal_token(oauth_token)
