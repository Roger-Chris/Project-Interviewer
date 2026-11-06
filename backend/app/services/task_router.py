from typing import Dict, List, Optional
from app.config import settings

class TaskRouter:
    """
    Centralized Task Router that directs analysis/viva/audit tasks to
    loaded models based on configuration mappings and availability.
    """

    TASK_MODEL_MAP = {
        "skills": "qwen",
        "outcomes": "qwen",
        "viva": "qwen",
        "viva_evaluation": "qwen",
        "summary": "qwen",
        "architecture": "qwen",
        "security": "qwen",
        "maintainability": "qwen",
        "technical_debt": "qwen",
        "authenticity_explanation": "qwen"
    }

    @classmethod
    def resolve_model_alias(cls, alias: str, loaded_models: List[str]) -> Optional[str]:
        """
        Maps a task model alias ('qwen') to a loaded model in LM Studio.
        First tries an exact match, then a substring case-insensitive search.
        """
        if not loaded_models:
            return None

        # Determine the expected name based on alias, assuming we just use one model for all tasks
        # Can fallback to any loaded qwen model if alias is 'qwen'
        expected_name = settings.PHI_MODEL # In config we've set this to qwen3.5-9b
        
        # 1. Exact match
        if expected_name in loaded_models:
            return expected_name

        # 2. Case-insensitive substring match
        for model in loaded_models:
            if alias in model.lower() or "qwen" in model.lower():
                return model

        return None

    @classmethod
    def get_model_for_task(cls, task_name: str, loaded_models: List[str]) -> Optional[str]:
        """
        Retrieves the exact loaded model name assigned to a specific task.
        Returns None if no suitable model is currently loaded.
        """
        alias = cls.TASK_MODEL_MAP.get(task_name)
        if not alias:
            return None
        return cls.resolve_model_alias(alias, loaded_models)
        
    @classmethod
    def is_task_enabled(cls, task_name: str, loaded_models: List[str]) -> bool:
        """
        Checks if the required model for a given task is currently available.
        """
        return cls.get_model_for_task(task_name, loaded_models) is not None
