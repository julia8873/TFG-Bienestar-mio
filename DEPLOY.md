# Despliegue en una URL (sin Docker Desktop)

Arquitectura, todo en planes **gratuitos**:

| Pieza | Servicio | Plan |
|---|---|---|
| Frontend (Next.js) | [Vercel](https://vercel.com) | Hobby (gratis, uso no comercial) |
| Backend (FastAPI + MCP) | [Render](https://render.com) | Free web service (512 MB RAM) |
| Base de datos | [MongoDB Atlas](https://www.mongodb.com/atlas) | M0 (512 MB) |
| IA | Google Gemini (clave de [AI Studio](https://aistudio.google.com/apikey)) | Free tier, **la pone cada usuario desde la interfaz** |
| Cronómetros | Clockify | Plan gratuito, clave de cada usuario |

Cada usuario introduce su API key de IA en **Configuración > IA**. Se valida con el proveedor
y se guarda **cifrada** (Fernet) en la base de datos; el servidor no necesita ninguna clave de IA propia.

---

## 0. Subir el proyecto a GitHub

Render y Vercel despliegan desde un repositorio. En la **raíz del repo** debe haber
`backend/`, `frontend/` y `render.yaml`. **No subas tu fichero `.env`** (contiene secretos).

## 1. Base de datos: MongoDB Atlas

1. Crea cuenta en Atlas → *Build a Database* → plan **M0 (Free)**. Región: la más cercana a Render (p. ej. Frankfurt).
2. *Database Access* → crea un usuario con contraseña (mejor solo letras y números, para no tener que escapar caracteres en la URI).
3. *Network Access* → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`). Es necesario porque Render gratis no tiene IP fija.
4. *Database* → *Connect* → *Drivers* → copia la cadena `mongodb+srv://...` y sustituye `<password>` por tu contraseña.
   Esta cadena es tu `MONGODB_URI`.

## 2. Generar la clave de cifrado (`FERNET_SECRET_KEY`)

```bash
python -c "import base64,os;print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

Guárdala. Si la pierdes o la cambias, las API keys ya guardadas dejan de poder descifrarse y cada usuario tendrá que volver a introducirlas.

## 3. Backend en Render

1. Entra en Render con tu cuenta de GitHub → **New +** → **Blueprint** → elige tu repositorio.
2. Render lee `render.yaml` y te pide los valores secretos:
   - `FERNET_SECRET_KEY`: la del paso 2.
   - `MONGODB_URI`: la del paso 1.
   - `CORS_ORIGINS`: escribe de momento `http://localhost:3000` (lo cambiarás en el paso 5).
3. **Apply**. La primera construcción tarda unos minutos.
4. Copia la URL del servicio (p. ej. `https://tfg-bienestar-backend.onrender.com`) y comprueba que
   `https://TU-BACKEND.onrender.com/health` responde `{"status":"ok"}`.

## 4. Frontend en Vercel

1. Entra en Vercel con GitHub → **Add New… > Project** → importa el repositorio.
2. **Root Directory**: `frontend`. El framework (Next.js) se detecta solo.
3. *Environment Variables*: `NEXT_PUBLIC_BACKEND_URL` = la URL del backend de Render (**sin `/` al final**).
4. **Deploy**. Copia la URL resultante (p. ej. `https://tfg-bienestar.vercel.app`).

> `NEXT_PUBLIC_BACKEND_URL` se incrusta al construir el frontend: si la cambias, hay que volver a desplegar en Vercel.

## 5. Permitir al frontend hablar con el backend (CORS)

En Render → tu servicio → **Environment** → edita `CORS_ORIGINS` y pon la URL de Vercel
(exacta, con `https://` y **sin `/` final**). Si tienes varias, sepáralas por comas. Al guardar, Render vuelve a desplegar.

## 6. Usar la aplicación

1. Abre la URL de Vercel → **Registro** → **Login**.
2. Vincula tu cuenta de Clockify (como antes).
3. **Configuración > IA** → crea tu clave gratuita en <https://aistudio.google.com/apikey> (cuenta de Google, sin tarjeta), pégala y pulsa *Guardar*.
4. ¡Ya puedes usar el chat!

Cada `git push` a la rama principal redespliega automáticamente backend y frontend.

---

## Limitaciones del plan gratuito

- **Render se duerme tras 15 min sin tráfico**; la primera petición después tarda ~1 minuto. Es normal.
- **Gemini free tier** tiene límites por minuto y por día; si se agotan, la app avisa. Además, con claves gratuitas Google puede usar las conversaciones para mejorar sus productos.
- **Vercel Hobby** es solo para uso personal/no comercial.
- Atlas M0: 512 MB de datos.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| El navegador muestra un error de CORS | `CORS_ORIGINS` no coincide exactamente con la URL de Vercel (http/https, `/` final, otro dominio). |
| "Error al conectar con el servidor" nada más abrir | El backend estaba dormido; espera ~1 min y recarga. |
| El backend no arranca / timeouts de Mongo | En Atlas falta `0.0.0.0/0` en *Network Access*, o la contraseña de `MONGODB_URI` es incorrecta. |
| Aviso "Añadir API key" en el chat | Falta la clave de IA del usuario (Configuración > IA). |
| "La API key no es válida" | Clave copiada incompleta o de otro servicio. |

## Desarrollo local

Sigue funcionando igual con `docker compose up` y tu `.env` (ver `.env.example`). En local, si defines
`GEMINI_API_KEY` en `.env`, se usa como alternativa para quien no haya configurado la suya en la interfaz.
