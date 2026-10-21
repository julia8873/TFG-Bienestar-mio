"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "");

/**
 * Panel para que cada usuario añada su propia API key del modelo de IA (gratuita).
 * La clave se envía al backend, que la valida con el proveedor y la guarda cifrada.
 * Nunca se vuelve a mostrar completa: solo se enseñan los 4 últimos caracteres.
 *
 * Props:
 * - isActive: cuándo (re)consultar el estado (p.ej. cuando se abre el modal). Por defecto true.
 * - onChange: callback con el estado (true/false) de si hay una clave utilizable, tras
 *   consultar el estado o tras guardar/eliminar la clave.
 */
export default function LlmConfigPanel({ isActive = true, onChange }) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    if (isActive) {
      fetchStatus();
      setMessage(null);
      setApiKey("");
      setShowKey(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const fetchStatus = async () => {
    const jwt = localStorage.getItem("token");
    if (!jwt) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/llm-status`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (onChange) onChange(Boolean(data.connected));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const jwt = localStorage.getItem("token");
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/llm-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo guardar la API key");
      setMessage({ type: "success", text: "¡API key guardada correctamente!" });
      setApiKey("");
      await fetchStatus();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const jwt = localStorage.getItem("token");
    if (!jwt) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/llm-credentials`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error();
      setMessage({ type: "success", text: "API key eliminada." });
      await fetchStatus();
    } catch {
      setMessage({ type: "error", text: "Error al eliminar la API key. Inténtalo de nuevo." });
    } finally {
      setLoading(false);
    }
  };

  const isConnected = Boolean(status?.connected);
  const isOwnKey = status?.source === "user";
  const providerLabel = status?.provider_label || "el proveedor de IA";
  const keyUrl = status?.key_url || "";
  const isGemini = status?.provider === "gemini";

  const steps = [
    {
      step: "1",
      text: "Entra en ",
      link: keyUrl ? { label: providerLabel, href: keyUrl } : null,
      after: isGemini ? " e inicia sesión con tu cuenta de Google (no hace falta tarjeta)." : " e inicia sesión.",
    },
    {
      step: "2",
      text: isGemini
        ? "Pulsa «Create API key» y copia la clave generada."
        : "Genera una API key y cópiala.",
    },
    {
      step: "3",
      text: "Pégala aquí abajo y pulsa «Guardar». La clave se guarda cifrada y solo se usa para tus conversaciones.",
    },
  ];

  return (
    <div>
      {/* Badge de estado */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "10px",
          marginBottom: "20px",
          backgroundColor: isConnected ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${isConnected ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}`,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
            {isConnected ? "API key configurada" : "Sin API key de IA"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {isConnected && isOwnKey && (
              <>
                {providerLabel} · clave{" "}
                <strong style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{status.key_hint}</strong>
              </>
            )}
            {isConnected && !isOwnKey && "Se está usando la clave configurada en el servidor."}
            {!isConnected && "Introduce tu API key para poder usar el chat"}
          </div>
        </div>
        {isConnected && isOwnKey && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={loading}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(239,68,68,0.4)",
              backgroundColor: "transparent",
              color: "#dc2626",
              fontSize: "12px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            Eliminar
          </button>
        )}
      </div>

      {/* Guía paso a paso (desplegable) */}
      <div
        style={{
          borderRadius: "10px",
          border: "1px solid var(--border)",
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "11px 14px",
            backgroundColor: "var(--bg-input)",
            borderBottom: showGuide ? "1px solid var(--border)" : "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: "700",
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            textAlign: "left",
            transition: "background 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--border)")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-input)")}
        >
          <span>¿Cómo obtengo mi API key gratuita?</span>
          <ChevronDown
            size={14}
            strokeWidth={2.5}
            style={{
              flexShrink: 0,
              transform: showGuide ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </button>
        {showGuide &&
          steps.map((item, i) => (
            <div
              key={item.step}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "10px 14px",
                borderBottom: i < steps.length - 1 ? "1px solid var(--border)" : "none",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "1px",
                }}
              >
                {item.step}
              </span>
              <span style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.6" }}>
                {item.text}
                {item.link && (
                  <a
                    href={item.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--brand)", textDecoration: "underline" }}
                  >
                    {item.link.label}
                  </a>
                )}
                {item.after}
              </span>
            </div>
          ))}
      </div>

      {isGemini && (
        <p style={{ margin: "0 0 18px 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          Ten en cuenta que con una clave del plan gratuito de Google, tus conversaciones pueden ser utilizadas por
          Google para mejorar sus productos, y que el plan gratuito tiene límites de uso por minuto y por día.
        </p>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="llm-api-key"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: "600",
              marginBottom: "6px",
              color: "var(--text-primary)",
            }}
          >
            {isConnected && isOwnKey ? "Reemplazar API key" : "API key"}
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="llm-api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Pega aquí tu API key…"
              required
              autoComplete="off"
              spellCheck={false}
              style={{
                width: "100%",
                padding: "10px 44px 10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: "14px",
                boxSizing: "border-box",
                outline: "none",
                transition: "border-color 0.15s",
                fontFamily: showKey ? "monospace" : "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--border-focus)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              title={showKey ? "Ocultar" : "Mostrar"}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              {showKey ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
            </button>
          </div>
        </div>

        {/* Mensaje feedback */}
        {message && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: message.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: message.type === "success" ? "#16a34a" : "#dc2626",
              border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            }}
          >
            {message.text}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            style={{
              padding: "9px 20px",
              borderRadius: "8px",
              border: "none",
              background:
                loading || !apiKey.trim() ? "var(--bg-input)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: loading || !apiKey.trim() ? "var(--text-secondary)" : "#ffffff",
              cursor: loading || !apiKey.trim() ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            {loading ? "Verificando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
