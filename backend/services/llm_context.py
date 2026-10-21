"""
Credenciales del LLM por petición.

Cada usuario introduce su propia API key desde la interfaz (Configuración > IA).
Los agentes (GeminiService / OpenAIService) son singletons creados al arrancar el
servidor, así que NO pueden guardar la clave de un usuario concreto. En su lugar,
main.py fija la clave del usuario actual en una ContextVar al inicio de cada
petición que usa el LLM, y los servicios la leen justo antes de llamar al modelo.

Una ContextVar es local a cada petición/tarea asyncio, por lo que dos usuarios
concurrentes nunca ven la clave del otro.

Si el usuario no ha configurado clave, se usa (solo como alternativa para desarrollo
local) la variable de entorno del proveedor; si tampoco existe, se lanza
MissingLLMKeyError.
"""

import os
from contextvars import ContextVar
from typing import Optional


class MissingLLMKeyError(Exception):
    """El usuario actual no tiene API key del LLM configurada."""


# Clave del usuario de la petición en curso (None = sin clave del usuario).
_current_llm_key: ContextVar[Optional[str]] = ContextVar("current_llm_key", default=None)


def set_llm_key(api_key: Optional[str]) -> None:
    """Fija la API key del LLM para la petición actual."""
    _current_llm_key.set(api_key or None)


def resolve_llm_key(env_var_names: tuple) -> str:
    """
    Devuelve la API key a usar: primero la del usuario (ContextVar); si no hay,
    la de las variables de entorno indicadas (uso local opcional).
    Lanza MissingLLMKeyError si no hay ninguna.
    """
    key = _current_llm_key.get()
    if key:
        return key
    for name in env_var_names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    raise MissingLLMKeyError(
        "No hay una API key de IA configurada. Añádela en Configuración > IA."
    )


def classify_llm_error(exc: Exception) -> Optional[str]:
    """
    Traduce un error del proveedor del LLM a un código estable para el frontend:
      - "LLM_KEY_MISSING": el usuario no tiene clave configurada.
      - "LLM_KEY_INVALID": el proveedor rechazó la clave (inválida, revocada o sin permisos).
      - "LLM_RATE_LIMIT":  se agotó la cuota/límite de peticiones (típico del plan gratuito).
    Devuelve None si no es un error de este tipo.
    """
    if isinstance(exc, MissingLLMKeyError):
        return "LLM_KEY_MISSING"

    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    text = str(exc).lower()

    if status == 429 or "resource_exhausted" in text or "rate limit" in text:
        return "LLM_RATE_LIMIT"
    if (
        status in (401, 403)
        or "api key not valid" in text
        or "api_key_invalid" in text
        or "invalid api key" in text
        or "incorrect api key" in text
        or "unauthorized" in text
        or "permission_denied" in text
    ):
        return "LLM_KEY_INVALID"
    return None
