// Códigos de error que devuelve el backend cuando falla algo relacionado con la API key de IA
// del usuario (ver backend/main.py: llm_http_error / bind_llm_key).

export const LLM_ERROR_MESSAGES = {
  LLM_KEY_MISSING:
    "Necesitas añadir tu API key de IA en Configuración > IA para usar esta función.",
  LLM_KEY_INVALID:
    "Tu API key de IA no es válida o ha sido revocada. Actualízala en Configuración > IA.",
  LLM_RATE_LIMIT:
    "Se ha alcanzado el límite de uso de tu API key gratuita. Espera un poco e inténtalo de nuevo (los límites del plan gratuito se renuevan por minuto y por día).",
};

// Devuelve el mensaje en español para un código conocido; si no lo es, devuelve el texto tal cual.
export function llmErrorMessage(detail) {
  return LLM_ERROR_MESSAGES[detail] || detail;
}

// True si el problema se arregla cambiando la API key (falta o es inválida).
export function isLlmKeyProblem(detail) {
  return detail === "LLM_KEY_MISSING" || detail === "LLM_KEY_INVALID";
}
