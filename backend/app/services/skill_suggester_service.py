import logging
from typing import List, Dict, Any
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

class SkillSuggesterService:
    DEFAULT_SKILL_CATALOG = [
        {"skill_id": "py_01", "name": "Python", "category": "Backend Development"},
        {"skill_id": "js_02", "name": "JavaScript", "category": "Frontend Development"},
        {"skill_id": "react_03", "name": "React", "category": "Frontend Frameworks"},
        {"skill_id": "pytorch_04", "name": "PyTorch", "category": "Machine Learning"},
        {"skill_id": "fastapi_05", "name": "FastAPI", "category": "Backend Frameworks"},
        {"skill_id": "docker_06", "name": "Docker", "category": "DevOps"},
        {"skill_id": "aws_07", "name": "AWS Services", "category": "Cloud Computing"},
        {"skill_id": "opencv_08", "name": "OpenCV", "category": "Computer Vision"}
    ]

    @classmethod
    async def suggest_skills(
        cls,
        title: str,
        description: str,
        outcomes: List[str],
        skills_catalog: List[Dict[str, Any]] = None,
        provider: str = "local"
    ) -> List[Dict[str, Any]]:
        """
        Intersects project goals and outcomes with the skill catalog using LLM,
        or returns a matching fallback set of skills.
        """
        catalog = skills_catalog or cls.DEFAULT_SKILL_CATALOG
        
        system = "You are an expert curriculum and skill mapping AI. Match the user's project descriptions to the skill catalog."
        user_prompt = (
            f"Given the project details:\n"
            f"Title: {title}\n"
            f"Description: {description}\n"
            f"Claimed Outcomes: {outcomes}\n\n"
            f"Select and map the most relevant skills from this catalog:\n{catalog}\n\n"
            f"Return a JSON array of matched skill dictionaries. Example format: [{{'skill_id': 'py_01', 'name': 'Python', 'category': 'Backend Development'}}]"
        )

        try:
            loaded_models = await AIService.get_loaded_models()
            model_name = loaded_models[0] if loaded_models else None
            if model_name:
                raw_response = await AIService.post_prompt(
                    model=model_name,
                    system_instruction=system,
                    user_prompt=user_prompt,
                    response_format={"type": "json_object"},
                    provider=provider
                )
                parsed = AIService.extract_and_parse_json(raw_response)
                if isinstance(parsed, list):
                    return parsed
                elif isinstance(parsed, dict) and "skills" in parsed:
                    return parsed["skills"]
        except Exception as e:
            logger.warning(f"SkillSuggesterService LLM call failed, running deterministic fallback: {str(e)}")

        # Fallback matching logic: simple keyword search in title/description/outcomes
        matched = []
        search_space = (title + " " + description + " " + " ".join(outcomes)).lower()
        for skill in catalog:
            if skill["name"].lower() in search_space:
                matched.append(skill)
        
        # If no skills matched, return a default selection
        if not matched:
            matched = [catalog[0], catalog[1]]
        return matched
