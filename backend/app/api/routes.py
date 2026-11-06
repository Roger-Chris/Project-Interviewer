import json
import shutil
from pathlib import Path
from typing import List, Optional, Dict
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
from pydantic import BaseModel, Field
from app.config import settings
from app.core.extractor import SafeExtractor
from app.services.analysis_service import AnalysisService
from app.services.task_router import TaskRouter
from app.services.ai_service import AIService
from app.services.llm_service import LLMService
from app.models.response import ProjectAnalysisResponse

# SkillForge service imports
from app.services.forensic_service import ForensicService
from app.services.textract_service import TextractService
from app.services.ai_synthesis_service import AISynthesisService
from app.services.skill_suggester_service import SkillSuggesterService
from app.services.chatbot_service import ChatbotService

router = APIRouter()

@router.post("/analyze-submission", response_model=ProjectAnalysisResponse)
async def analyze_submission(
    title: str = Form(...),
    description: str = Form(...),
    outcomes: str = Form(...), # JSON serialized array of claimed outcomes
    questionsCount: int = Form(5),
    focusAreas: str = Form("[]"), # JSON serialized array of focus domains
    file: UploadFile = File(...),
    x_llm_provider: Optional[str] = Header("local", alias="X-LLM-Provider")
):
    # 1. Parse outcomes and focus areas from form JSON strings
    try:
        outcomes_list = json.loads(outcomes)
        if not isinstance(outcomes_list, list):
            outcomes_list = [outcomes_list]
    except Exception:
        outcomes_list = [outcomes]

    try:
        focus_areas_list = json.loads(focusAreas)
    except Exception:
        focus_areas_list = []

    # Verify upload suffix is ZIP
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP repositories are supported.")

    # 0. Size check and header check
    MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
    file.file.seek(0, 2)
    size = file.file.tell()
    await file.seek(0)

    if size > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum allowed size is 50MB.")

    # Read first 4 bytes to verify ZIP magic number (PK\x03\x04)
    file_header = file.file.read(4)
    await file.seek(0)

    if file_header != b'PK\x03\x04':
        raise HTTPException(status_code=400, detail="Invalid file format. The file is not a valid ZIP archive.")

    # Generate unique folder IDs for session isolation
    session_id = f"session_{Path(file.filename).stem}_{hash(title) % 10000}"
    temp_zip_path = settings.UPLOAD_DIR / f"{session_id}.zip"
    extract_path = settings.EXTRACT_DIR / session_id

    try:
        # 2. Write uploaded stream to temp zip file on filesystem
        with open(temp_zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 3. Safely extract files using Zip-Slip traversal blocker
        extracted_files = []
        try:
            extracted_files = SafeExtractor.extract_zip(temp_zip_path, extract_path)
        except ValueError as traversal_err:
            raise HTTPException(status_code=400, detail=str(traversal_err))
        except Exception as extract_err:
            # Fallback: ZIP is corrupted or empty/dummy file. 
            # Proceed with empty folder tree scanning to let text analysis run.
            print(f"ZIP Extraction skipped: {str(extract_err)}")

        # 4. Run the analysis service coordinator
        analysis_report = await AnalysisService.analyze_project(
            title=title,
            description=description,
            outcomes=outcomes_list,
            questions_count=questionsCount,
            focus_areas=focus_areas_list,
            extract_path=extract_path,
            provider=x_llm_provider
        )
        return analysis_report

    except Exception as general_err:
        # Fallback debug logs
        raise HTTPException(status_code=500, detail=f"Diagnostic Pipeline Error: {str(general_err)}")

    finally:
        # 9. Clean up temporary files on server
        if temp_zip_path.exists():
            try:
                temp_zip_path.unlink()
            except Exception:
                pass
        
        # We preserve the extracted files directory to allow local debug/inspect
        # or it can be cleaned up. Let's clean it up to prevent server clutter:
        if extract_path.exists():
            try:
                shutil.rmtree(extract_path)
            except Exception:
                pass


class EvaluateAnswerRequest(BaseModel):
    question: str
    expectedPoints: List[str] = Field(default_factory=list)
    candidateAnswer: str

@router.post("/evaluate-answer")
async def evaluate_answer(
    payload: EvaluateAnswerRequest,
    x_llm_provider: Optional[str] = Header("local", alias="X-LLM-Provider")
):
    loaded_models = await AIService.get_loaded_models()
    qwen_model = TaskRouter.get_model_for_task("viva_evaluation", loaded_models)
    
    if x_llm_provider == "gemini" or qwen_model:
        try:
            evaluation = await LLMService.evaluate_viva_answer(
                model_name=qwen_model or "gemini",
                question=payload.question,
                expected_points=payload.expectedPoints,
                candidate_answer=payload.candidateAnswer,
                provider=x_llm_provider
            )
            return evaluation
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"Viva answer evaluation failed: {str(err)}")
    else:
        # Fallback evaluation response when no LLM is available
        return {
            "grade": "Fail",
            "points_met": [],
            "feedback": "Evaluation model offline. Answer could not be assessed — marked as Fail by default."
        }

# ----------------------------------------------------
# SkillForge Feature Routes
# ----------------------------------------------------

@router.post("/analyze-certificate")
async def analyze_certificate(
    studentName: str = Form(...),
    file: UploadFile = File(...)
):
    # Verify file is an image
    if not any(file.filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png']):
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, and PNG certificate images are supported.")
        
    image_bytes = await file.read()
    
    # 1. OCR text extraction
    textract_service = TextractService()
    line_blocks = textract_service.extract_text(image_bytes)
    full_text = " ".join([b["text"] for b in line_blocks])
    
    # 2. Forensic analysis
    forensic_service = ForensicService()
    flags = forensic_service.analyze(image_bytes, studentName, line_blocks)
    
    # 3. AI synthesis
    synthesis = await AISynthesisService.synthesize_certificate(studentName, full_text, flags)
    return synthesis

class SuggestSkillsRequest(BaseModel):
    title: str
    description: str
    outcomes: List[str]

@router.post("/suggest-skills")
async def suggest_skills(
    payload: SuggestSkillsRequest,
    x_llm_provider: Optional[str] = Header("local", alias="X-LLM-Provider")
):
    try:
        skills = await SkillSuggesterService.suggest_skills(
            title=payload.title,
            description=payload.description,
            outcomes=payload.outcomes,
            provider=x_llm_provider
        )
        return {"suggested_skills": skills}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class StudentChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

@router.post("/student")
async def post_student_chat(
    request: StudentChatRequest,
    x_tenant_id: Optional[str] = Header(default="default_tenant", alias="X-Tenant-Id"),
    x_student_id: Optional[str] = Header(default="default_student", alias="X-Student-Id"),
    x_llm_provider: Optional[str] = Header("local", alias="X-LLM-Provider")
):
    session_id = request.session_id or "default"
    try:
        reply = await ChatbotService.run_chat_turn(
            tenant_id=x_tenant_id,
            student_id=x_student_id,
            session_id=session_id,
            user_message=request.message,
            provider=x_llm_provider
        )
        return reply
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/profile")
async def get_student_profile(
    x_tenant_id: Optional[str] = Header(default="default_tenant", alias="X-Tenant-Id"),
    x_student_id: Optional[str] = Header(default="default_student", alias="X-Student-Id")
):
    return {
        "student_id": x_student_id,
        "tenant_id": x_tenant_id,
        "name": "John Doe",
        "email": "student@institution.edu",
        "status": "Active"
    }

# Simple global in-memory stores for proctor logs and consent
consent_records = {}  # session_id -> consent details dict
proctor_events = {}   # session_id -> list of proctor logs

class ConsentRequest(BaseModel):
    session_id: str
    userId: str
    timestamp: str
    permissionsGranted: Dict[str, bool]
    consentCheckboxChecked: bool

@router.post("/log-consent")
async def log_consent(payload: ConsentRequest):
    consent_records[payload.session_id] = {
        "userId": payload.userId,
        "timestamp": payload.timestamp,
        "permissionsGranted": payload.permissionsGranted,
        "consentCheckboxChecked": payload.consentCheckboxChecked
    }
    return {"status": "success", "session_id": payload.session_id}

class ProctorEventRequest(BaseModel):
    session_id: str
    timestamp: str
    type: str  # e.g., 'Gaze Deviation', 'Phone Detected', 'Camera Blocked', 'Tab switch'
    confidence: Optional[float] = None
    details: str

@router.post("/log-proctor-event")
async def log_proctor_event(payload: ProctorEventRequest):
    if payload.session_id not in proctor_events:
        proctor_events[payload.session_id] = []
    
    proctor_events[payload.session_id].append({
        "timestamp": payload.timestamp,
        "type": payload.type,
        "confidence": payload.confidence,
        "details": payload.details
    })
    return {"status": "success", "count": len(proctor_events[payload.session_id])}

@router.get("/get-proctor-report/{session_id}")
async def get_proctor_report(session_id: str):
    return {
        "consent": consent_records.get(session_id, None),
        "events": proctor_events.get(session_id, [])
    }

