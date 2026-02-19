class ProviderError(Exception):
    """Base error for AI provider failures."""


class ProviderUnavailableError(ProviderError):
    """Provider is configured off or missing credentials."""


class ProviderRequestError(ProviderError):
    """Provider request failed."""
