import json
import logging
from typing import List, Dict, Any
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

class AISynthesisService:
    @classmethod
    async def synthesize_certificate(cls, student_name: str, ocr_text: str, forensic_flags: List[str]) -> Dict[str, Any]:
        """
        Uses LLM (AIService) to compile a final authenticity score and assessment of the certificate,
        with a deterministic fallback.
        """
        # Determine confidence score and labels based on forensic flags
        score = 100.0
        details = []
        is_authentic = True

        for flag in forensic_flags:
            if "STUDENT_NAME_GEOMETRY_NOT_FOUND" in flag:
                score -= 40
                details.append("Student name was not found in OCR blocks, suggesting layout anomalies.")
                is_authentic = False
            elif "BASELINE_SHIFT_ANOMALY" in flag:
                score -= 30
                details.append(f"Geometric baseline alignment shift anomaly detected ({flag}).")
                is_authentic = False
            elif "FONT_SCALE_ANOMALY" in flag:
                score -= 20
                details.append(f"Font height scaling variance anomaly detected ({flag}).")
                is_authentic = False
            elif "ELA_INSERTION_ANOMALY" in flag:
                score -= 50
                details.append(f"Error Level Analysis (ELA) detected pixel-level JPEG compression insertion/manipulation ({flag}).")
                is_authentic = False

        score = max(0.0, score)
        classification = "Production Ready / Authentic" if is_authentic else "Suspicious / Manipulated"
        
        # Prepare system instructions & user prompt for LLM explanation if available
        system = "You are a forensic document analysis AI. Your task is to analyze certificate validation logs and generate a professional summary."
        user_prompt = (
            f"Please summarize the authenticity of a certificate. \n"
            f"Student Name Claimed: {student_name}\n"
            f"OCR Extracted Content: {ocr_text}\n"
            f"Forensic Flags Triggered: {', '.join(forensic_flags) if forensic_flags else 'None'}\n"
            f"Calculated Score: {score}%\n"
            f"Classification: {classification}\n\n"
            f"Provide a JSON response with keys: 'summary' (str), 'authenticity_score' (float), and 'findings' (list of str)."
        )

        try:
            loaded_models = await AIService.get_loaded_models()
            model_name = loaded_models[0] if loaded_models else None
            if model_name:
                raw_response = await AIService.post_prompt(
                    model=model_name,
                    system_instruction=system,
                    user_prompt=user_prompt,
                    response_format={"type": "json_object"}
                )
                parsed = AIService.extract_and_parse_json(raw_response)
                if isinstance(parsed, dict) and "summary" in parsed:
                    return {
                        "is_authentic": is_authentic,
                        "score": parsed.get("authenticity_score", score),
                        "classification": classification,
                        "summary": parsed.get("summary", ""),
                        "findings": parsed.get("findings", details)
                    }
        except Exception as e:
            logger.warning(f"AISynthesisService LLM call failed, using fallback: {str(e)}")

        # Fallback response
        summary = (
            f"Certificate validation completed for {student_name}."
            if is_authentic
            else f"Validation flags suggest potential editing or layout tampering around candidate name '{student_name}'."
        )

        return {
            "is_authentic": is_authentic,
            "score": score,
            "classification": classification,
            "summary": summary,
            "findings": details
        }
