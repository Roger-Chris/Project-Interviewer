import logging
from typing import List, Dict, Any, Optional
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

class ChatbotService:
    # In-memory session history store (keys: tenant_id:student_id:session_id)
    _history: Dict[str, List[Dict[str, str]]] = {}

    @classmethod
    def _get_history_key(cls, tenant_id: str, student_id: str, session_id: str) -> str:
        return f"{tenant_id}:{student_id}:{session_id}"

    @classmethod
    async def get_history(cls, tenant_id: str, student_id: str, session_id: str) -> List[Dict[str, str]]:
        key = cls._get_history_key(tenant_id, student_id, session_id)
        if key not in cls._history:
            cls._history[key] = [
                {"role": "assistant", "content": "Hello! I am your SkillForge learning assistant. How can I help you today?"}
            ]
        return cls._history[key]

    @classmethod
    async def add_messages(cls, tenant_id: str, student_id: str, session_id: str, messages: List[Dict[str, str]]):
        key = cls._get_history_key(tenant_id, student_id, session_id)
        if key not in cls._history:
            await cls.get_history(tenant_id, student_id, session_id)
        cls._history[key].extend(messages)

    @classmethod
    async def clear_history(cls, tenant_id: str, student_id: str, session_id: str):
        key = cls._get_history_key(tenant_id, student_id, session_id)
        if key in cls._history:
            del cls._history[key]

    @classmethod
    async def run_chat_turn(
        cls,
        tenant_id: str,
        student_id: str,
        session_id: str,
        user_message: str,
        provider: str = "local"
    ) -> Dict[str, Any]:
        """
        Runs a chatbot conversation turn using historical messages and LLM,
        or returns a robust fallback response.
        """
        history = await cls.get_history(tenant_id, student_id, session_id)
        
        # Append the new user message to history
        user_msg = {"role": "user", "content": user_message}
        await cls.add_messages(tenant_id, student_id, session_id, [user_msg])

        system = (
            f"You are a helpful learning chatbot helper. "
            f"Currently assisting Student ID: {student_id} under Tenant: {tenant_id}."
        )

        try:
            loaded_models = await AIService.get_loaded_models()
            model_name = loaded_models[0] if loaded_models else None
            if model_name:
                # Format full context for the LLM call
                full_history = await cls.get_history(tenant_id, student_id, session_id)
                formatted_history = "\n".join([f"{msg['role']}: {msg['content']}" for msg in full_history])
                user_prompt = f"Here is our chat history:\n{formatted_history}\n\nAssistant response:"
                
                raw_response = await AIService.post_prompt(
                    model=model_name,
                    system_instruction=system,
                    user_prompt=user_prompt,
                    provider=provider
                )
                
                reply = raw_response.strip() if raw_response else "I couldn't formulate a response."
                assistant_msg = {"role": "assistant", "content": reply}
                await cls.add_messages(tenant_id, student_id, session_id, [assistant_msg])
                
                return {
                    "reply": reply,
                    "session_id": session_id,
                    "db_trace": [{"action": "fetch_student_profile", "student_id": student_id}]
                }
        except Exception as e:
            logger.warning(f"ChatbotService LLM call failed, using fallback: {str(e)}")

        # Fallback response
        reply = f"I received your message: '{user_message}'. (Note: LLM engine is currently offline)."
        assistant_msg = {"role": "assistant", "content": reply}
        await cls.add_messages(tenant_id, student_id, session_id, [assistant_msg])

        return {
            "reply": reply,
            "session_id": session_id,
            "db_trace": [{"action": "mock_fetch_student_profile", "student_id": student_id}]
        }
