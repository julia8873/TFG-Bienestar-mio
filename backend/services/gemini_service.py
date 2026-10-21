import os
from google import genai
from google.genai import types 
from dotenv import load_dotenv

from services.base_chatbot_service import BaseChatbotService
from services.base_chatbot_service import StandardResponse, FunctionCall
from services.llm_context import resolve_llm_key

load_dotenv()

# Caché de clientes de Gemini por API key (cada usuario aporta la suya desde la interfaz).
_GEMINI_CLIENTS: dict = {}
_MAX_CACHED_CLIENTS = 64

class GeminiService(BaseChatbotService):
    def __init__(self):
        super().__init__()
        self.model = "gemini-3.5-flash-lite"
        # self.model = "gemini-3.6-flash"
        # self.model = "gemini-3.8-flash"
        # self.model = "gemini-3.1-flash-lite"
        # self.model="gemini-omni-1.1-flash"


    @property
    def client(self):
        """
        Cliente de Gemini con la API key del usuario de la petición en curso
        (ver services/llm_context.py). Se crea de forma perezosa para que el servidor
        pueda arrancar sin ninguna clave configurada.
        """
        api_key = resolve_llm_key(("GEMINI_API_KEY", "GOOGLE_API_KEY"))
        client = _GEMINI_CLIENTS.get(api_key)
        if client is None:
            if len(_GEMINI_CLIENTS) >= _MAX_CACHED_CLIENTS:
                _GEMINI_CLIENTS.clear()
            client = genai.Client(api_key=api_key)
            _GEMINI_CLIENTS[api_key] = client
        return client

    def set_config(self, config_raw):
        """
        Sobrescribimos set_config para que no use el diccionario de la clase base
        y guarde directamente el objeto de configuración tipado de Google.
        """
        # Traducimos las herramientas al formato nativo
        self.config = self.translate_tools_to_specific_format(config_raw)
        
        # Inyectamos las instrucciones de sistema directamente en el objeto del SDK
        if self.config:
            self.config.system_instruction = self.system_instruction


    def translate_tools_to_specific_format(self, config_raw):
        """
        TRADUCTOR GEMINI: Toma la lista RAW del main y la convierte 
        en objetos de configuración nativos del nuevo SDK de Google GenAI sin romper Pydantic.
        """
        gemini_declarations = []
        
        if config_raw and isinstance(config_raw, list):
            for tool in config_raw:
                gemini_declarations.append(
                    types.FunctionDeclaration(
                        name=tool.get("name"),
                        description=tool.get("description"),
                        parameters=tool.get("parameters")
                    )
                )
        
        return types.GenerateContentConfig(
            tools=[types.Tool(function_declarations=gemini_declarations)]
        )   

    def append_user_message(self, user_message: str):
        self.history.append({"role": "user", "parts": [{"text": user_message}]})

    def append_assistant_message(self, content: str):
        self.history.append({"role": "model", "parts": [{"text": content}]})

    async def call_model(self):
        base = self.config if self.config is not None else types.GenerateContentConfig()
        config = base.model_copy(update={"system_instruction": self.system_instruction})
        return await self.client.aio.models.generate_content(
            model=self.model,
            contents=self.history,
            config=config
        )

    
    def append_model_message(self, response):
        if response.candidates:
            self.history.append(response.candidates[0].content)
 
    def append_tool_results(self, function_calls: list, results: list):
        # Gemini espera la respuesta de las tools como Part.from_function_response,
        # dentro de un Content con role="user".
        parts = [
            types.Part.from_function_response(name=fc.name, response={"result": result})
            for fc, result in zip(function_calls, results)
        ]
        self.history.append(types.Content(role="user", parts=parts))
 
   

    def get_standard_response(self, response) -> StandardResponse:
        function_calls = []
        if hasattr(response, 'function_calls') and response.function_calls:
            for fc in response.function_calls:
                function_calls.append(FunctionCall(fc.name, fc.args))
 
        
        text = None
        if response.candidates:
            parts = response.candidates[0].content.parts or []
            text_parts = [p.text for p in parts if getattr(p, 'text', None)]
            if text_parts:
                text = "".join(text_parts)
 
        return StandardResponse(text=text, function_calls=function_calls)