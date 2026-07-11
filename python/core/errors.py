class ZeroHubError(Exception):
    """Erro esperado de um módulo do ZeroHub."""


class InvalidRequestError(ZeroHubError):
    """A requisição recebida possui formato inválido."""


class UnknownActionError(ZeroHubError):
    """A ação solicitada não existe."""
