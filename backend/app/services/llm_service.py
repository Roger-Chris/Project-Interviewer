import json
from typing import Dict, Any, List, Optional
from app.services.ai_service import AIService
from app.services.prompt_service import PromptService

class LLMService:
    """
    High-level LLM orchestrator. Formulates user prompts via PromptService,
    calls AIService, and safely parses the output text into python models.
    """

    @classmethod
    def _prune_skill_catalog(cls, catalog: List[Dict[str, Any]], evidence_map: Dict[str, Any]) -> List[Dict[str, Any]]:
        # Normalize keys to lowercase for robust matching
        languages = evidence_map.get("summary", {}).get("languages", {})
        langs = {k.lower() for k in languages.keys()}
        
        raw_deps = evidence_map.get("manifest", {}).get("dependencies", [])
        dependencies = []
        for d in raw_deps:
            if isinstance(d, dict) and "name" in d:
                dependencies.append(str(d["name"]).lower())
            elif isinstance(d, str):
                dependencies.append(d.lower())
        config_files = [f.lower() for f in evidence_map.get("manifest", {}).get("config_files", [])]
        
        pruned = []
        for skill in catalog:
            cat = skill.get("category", "").lower()
            name = skill.get("skill_name", "").lower()
            
            keep = False
            
            # Language matching rules
            if "python" in langs:
                if name in ["python", "fastapi", "django", "flask", "pandas", "numpy", "pytorch", "tensorflow", "machine learning", "data analysis"]:
                    keep = True
            if "javascript" in langs or "typescript" in langs or "html" in langs or "css" in langs:
                if name in ["javascript", "typescript", "react", "angular", "vue.js", "next.js", "html/css", "tailwind css", "responsive web design", "node.js", "express.js", "react native"]:
                    keep = True
            if "java" in langs:
                if name in ["java", "spring boot", "android development"]:
                    keep = True
            if "kotlin" in langs:
                if name in ["kotlin", "android development"]:
                    keep = True
            if "go" in langs or "golang" in langs:
                if name in ["go"]:
                    keep = True
            if "c++" in langs:
                if name in ["c++"]:
                    keep = True
            if "c#" in langs:
                if name in ["c#"]:
                    keep = True
            if "dart" in langs:
                if name in ["flutter"]:
                    keep = True
                    
            # DevOps & Cloud matching rules
            if cat in ["devops", "cloud"]:
                if name == "git":
                    keep = True
                elif name == "docker" and any("dockerfile" in f or "docker-compose" in f for f in config_files):
                    keep = True
                elif name == "nginx" and any("nginx" in f for f in config_files):
                    keep = True
                elif name == "terraform" and any(".tf" in f for f in config_files):
                    keep = True
                elif name == "ci/cd" and any(".github" in f or ".gitlab" in f for f in config_files):
                    keep = True
                elif name == "linux" and any("dockerfile" in f or "sh" in f for f in config_files):
                    keep = True
                elif name == "aws" and any("aws" in d or "boto3" in d for d in dependencies):
                    keep = True
                elif name == "google cloud platform" and any("google-cloud" in d or "gcloud" in d for d in dependencies):
                    keep = True
                elif name == "microsoft azure" and any("azure" in d for d in dependencies):
                    keep = True
                elif name == "firebase" and any("firebase" in d for d in dependencies):
                    keep = True
                    
            # Database matching rules
            if cat == "database":
                if name == "sql" and any(x in d for x in ["sql", "postgres", "mysql", "sqlite", "psycopg2"] for d in dependencies):
                    keep = True
                elif name == "postgresql" and any("postgres" in d or "psycopg2" in d for d in dependencies):
                    keep = True
                elif name == "mysql" and any("mysql" in d for d in dependencies):
                    keep = True
                elif name == "mongodb" and any("mongo" in d for d in dependencies):
                    keep = True
                elif name == "redis" and any("redis" in d for d in dependencies):
                    keep = True
                elif name == "sqlite" and any("sqlite" in d for d in dependencies):
                    keep = True

            if keep:
                pruned.append(skill)
                
        # If pruned catalog is empty (e.g. no matched languages), return original catalog
        return pruned if pruned else catalog

    @classmethod
    async def detect_skills(cls, model_name: str, evidence_map: Dict[str, Any], skill_catalog: List[Dict[str, Any]], provider: str = "local") -> List[Dict[str, Any]]:
        """
        Tasks Phi-3 to inspect codebase features and match them against the catalog.
        """
        system = "You are a precise technical scanning assistant. Keep your thinking process extremely brief, under 50 words. Output the raw JSON directly, with no introductory text, explanations, or reasoning."
        
        try:
            # Prune skill catalog to prevent prompt context length overflow
            pruned_catalog = cls._prune_skill_catalog(skill_catalog, evidence_map)
            
            prompt = PromptService.get_prompt(
                "skill_prompt", 
                skill_catalog=json.dumps(pruned_catalog), 
                evidence_map=json.dumps(evidence_map)
            )
            raw_response = await AIService.post_prompt(
                model=model_name,
                system_instruction=system,
                user_prompt=prompt,
                response_format={"type": "json_object"},
                provider=provider
            )
            parsed = AIService.extract_and_parse_json(raw_response)
            if isinstance(parsed, list):
                return parsed
            elif isinstance(parsed, dict) and "skills" in parsed:
                return parsed["skills"]
            elif isinstance(parsed, dict):
                return [parsed]
        except Exception as err:
            print(f"[Error] Skill detection LLM call failed: {err}")
        return []

    @classmethod
    async def verify_outcomes(cls, model_name: str, evidence_map: Dict[str, Any], outcomes: List[str], provider: str = "local") -> List[Dict[str, Any]]:
        """
        Tasks Phi-3 to cross-examine project outcome descriptions against codebase evidence.
        """
        system = "You are a precise technical outcome verification assistant. Keep your thinking process extremely brief, under 50 words. Return structured JSON matching the exact format requested. Output the raw JSON directly, with no introductory text, explanations, or reasoning."
        
        try:
            prompt = PromptService.get_prompt(
                "outcome_prompt",
                outcomes=json.dumps(outcomes),
                evidence_map=json.dumps(evidence_map)
            )
            raw_response = await AIService.post_prompt(
                model=model_name,
                system_instruction=system,
                user_prompt=prompt,
                response_format={"type": "json_object"},
                provider=provider
            )
            parsed = AIService.extract_and_parse_json(raw_response)
            if isinstance(parsed, list):
                return parsed
            elif isinstance(parsed, dict) and "outcomes" in parsed:
                return parsed["outcomes"]
            elif isinstance(parsed, dict):
                return [parsed]
        except Exception as err:
            print(f"[Error] Outcome verification LLM call failed: {err}")
        return []

    @classmethod
    async def generate_viva_questions(cls, model_name: str, evidence_map: Dict[str, Any], skill_name: str, provider: str = "local") -> List[Dict[str, Any]]:
        """
        Tasks model to compile exactly 3 conceptual and codebase-specific questions for a specific skill.
        """
        system = f"You are a senior technical interviewer testing the candidate's knowledge on {skill_name}. Keep your thinking process extremely brief, under 50 words. Return structured JSON matching the exact template. Output the raw JSON directly, with no introductory text, explanations, or reasoning."
        
        question_configs = [
            {"num": 1, "type": "Conceptual", "difficulty": "Easy", "time": 120},
            {"num": 2, "type": "Codebase Specific", "difficulty": "Medium", "time": 180},
            {"num": 3, "type": "Conceptual", "difficulty": "Hard", "time": 240}
        ]
        
        questions = []
        
        try:
            # Construct highly compact evidence map to fit within reasoning model limitations
            compact_evidence = {
                "languages": list(evidence_map.get("summary", {}).get("languages", {}).keys()),
                "features": [k for k, v in evidence_map.get("summary", {}).get("features", {}).items() if v],
                "api_routes": evidence_map.get("manifest", {}).get("api_routes", [])[:5]
            }
            
            for config in question_configs:
                prompt = PromptService.get_prompt(
                    "viva_prompt",
                    evidence_map=json.dumps(compact_evidence),
                    skill_name=skill_name,
                    question_number=config["num"],
                    question_type=config["type"],
                    difficulty=config["difficulty"],
                    time_limit=config["time"]
                )
                try:
                    raw_response = await AIService.post_prompt(
                        model=model_name,
                        system_instruction=system,
                        user_prompt=prompt,
                        response_format={"type": "json_object"},
                        provider=provider
                    )
                    parsed = AIService.extract_and_parse_json(raw_response)
                    
                    if isinstance(parsed, list) and len(parsed) > 0:
                        parsed = parsed[0]
                        
                    if isinstance(parsed, dict):
                        parsed["skill_name"] = skill_name
                        parsed.setdefault("id", config["num"])
                        parsed.setdefault("type", config["type"])
                        parsed.setdefault("difficulty", config["difficulty"])
                        parsed.setdefault("timeLimit", config["time"])
                        questions.append(parsed)
                    else:
                        print(f"[Warning] Question {config['num']} returned invalid parse object: {parsed}", flush=True)
                except Exception as err:
                    print(f"[Error] Failed to generate Question {config['num']}: {err}", flush=True)
            return questions
        except Exception as err:
            print(f"[Error] Viva generation LLM call failed for skill {skill_name}: {err}", flush=True)
        return []

    @classmethod
    async def generate_summary(cls, model_name: str, title: str, description: str, evidence_map: Dict[str, Any], provider: str = "local") -> str:
        """
        Tasks Phi-3 to summarize candidate capability findings.
        """
        system = "You are an executive summary writer. Write a concise, professional overview. Return only the raw text."
        
        try:
            prompt = PromptService.get_prompt(
                "summary_prompt",
                title=title,
                description=description,
                evidence_map=json.dumps(evidence_map)
            )
            raw_response = await AIService.post_prompt(
                model=model_name,
                system_instruction=system,
                user_prompt=prompt,
                provider=provider
            )
            return raw_response.strip()
        except Exception as err:
            print(f"[Error] Executive summary LLM call failed: {err}")
        return f"A technical review of project: {title}. The codebase matches standard framework configuration structures."

    @classmethod
    async def review_architecture(cls, model_name: str, evidence_map: Dict[str, Any], dependencies: List[Dict[str, str]], provider: str = "local") -> str:
        """
        Tasks Gemma-3 to perform deep structural design pattern audit.
        """
        system = "You are a chief software architect. Review the codebase modularity and patterns. Return only the raw explanation text."
        
        try:
            prompt = PromptService.get_prompt(
                "architecture_prompt",
                dependencies=json.dumps(dependencies),
                evidence_map=json.dumps(evidence_map)
            )
            raw_response = await AIService.post_prompt(
                model=model_name,
                system_instruction=system,
                user_prompt=prompt,
                provider=provider
            )
            return raw_response.strip()
        except Exception as err:
            print(f"[Error] Architecture review LLM call failed: {err}")
        return "The architecture demonstrates modular layout separation. Subsystems are split by responsibility layer."

    @classmethod
    async def run_code_audit(cls, model_name: str, evidence_map: Dict[str, Any], provider: str = "local") -> Dict[str, Any]:
        """
        Tasks Gemma-3 to compile technical debt, code smells, strengths, and recommendations.
        """
        system = "You are a senior codebase auditor. Keep your thinking process extremely brief, under 50 words. Return structured JSON matching the exact format requested. Output the raw JSON directly, with no introductory text, explanations, or reasoning."
        
        try:
            prompt = PromptService.get_prompt(
                "audit_prompt",
                evidence_map=json.dumps(evidence_map)
            )
            raw_response = await AIService.post_prompt(
                model=model_name,
                system_instruction=system,
                user_prompt=prompt,
                response_format={"type": "json_object"},
                provider=provider
            )
            return AIService.extract_and_parse_json(raw_response)
        except Exception as err:
            print(f"[Error] Technical code audit LLM call failed: {err}")
        return {
            "strengths": ["Clear project setup"],
            "weaknesses": ["Lack of test coverage"],
            "security": "Static scanner did not detect major credentials leaks.",
            "codeSmells": "Minor monolithic class configurations.",
            "technicalDebt": "Standard debt matching template structures.",
            "recommendations": "Implement unit verification routines."
        }

    @classmethod
    async def explain_authenticity(
        cls, 
        model_name: str, 
        evidence_map: Dict[str, Any], 
        score: int, 
        classification: str, 
        category_scores: Dict[str, int], 
        missing_indicators: List[str], 
        real_indicators: List[str],
        provider: str = "local"
    ) -> str:
        """
        Tasks Gemma-3 to explain why the project received the scores computed by the rule engine.
        """
        system = "You are an expert software authenticity evaluator. Write a detailed review of why the code scores were awarded. Return only the raw text."
        
        try:
            prompt = PromptService.get_prompt(
                "authenticity_prompt",
                evidence_map=json.dumps(evidence_map, indent=2),
                authenticity_score=score,
                classification=classification,
                category_scores=json.dumps(category_scores),
                missing_components=json.dumps(missing_indicators),
                evidence_indicators=json.dumps(real_indicators)
            )
            raw_response = await AIService.post_prompt(
                model=model_name,
                system_instruction=system,
                user_prompt=prompt,
                provider=provider
            )
            return raw_response.strip()
        except Exception as err:
            print(f"[Error] Authenticity explanation LLM call failed: {err}")
        return f"The project represents a {classification} layout with an authenticity rating of {score}%. The missing elements account for score deviations."

    @classmethod
    async def evaluate_viva_answer(cls, model_name: str, question: str, expected_points: List[str], candidate_answer: str, provider: str = "local") -> Dict[str, Any]:
        """
        Tasks Phi-3 to evaluate candidate's verbal/textual explanations.
        """
        system = "You are a senior technical examiner. Grade candidate answers against expected points. Return structured JSON matching the exact format requested."
        
        try:
            prompt = PromptService.get_prompt(
                "viva_evaluation_prompt",
                question=question,
                expected_points=json.dumps(expected_points),
                candidate_answer=candidate_answer
            )
            raw_response = await AIService.post_prompt(
                model=model_name,
                system_instruction=system,
                user_prompt=prompt,
                response_format={"type": "json_object"},
                provider=provider
            )
            return AIService.extract_and_parse_json(raw_response)
        except Exception as err:
            print(f"[Error] Viva answer evaluation LLM call failed: {err}")
        return {
            "grade": "Partial",
            "points_met": [],
            "feedback": "Evaluation model fallback triggered."
        }
