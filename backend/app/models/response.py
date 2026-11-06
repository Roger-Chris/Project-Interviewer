from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class DependencyInfo(BaseModel):
    name: str
    version: str
    type: str

class TechStackInfo(BaseModel):
    frontend: List[str] = []
    backend: List[str] = []
    database: List[str] = []
    devops: List[str] = []

class AuthenticityReport(BaseModel):
    score: int = Field(..., ge=0, le=100)
    classification: str # 'Production Ready' | 'Mostly Complete' | 'Frontend Heavy' | 'Superficial'
    real_indicators: List[str] = []
    missing_indicators: List[str] = []
    superficial_indicators: List[str] = []
    verdict: str

class SkillDetection(BaseModel):
    skill_id: str
    skill_name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    rationale: str

class OutcomeVerification(BaseModel):
    outcome: str
    status: str # 'Met' | 'Partial' | 'Missing' | 'Not Verifiable'
    evidence: str
    gap: str

class VivaQuestion(BaseModel):
    id: int
    skill_name: str
    question: str
    type: str # 'Conceptual' | 'Codebase Specific'
    difficulty: str # 'Easy' | 'Medium' | 'Hard'
    timeLimit: int
    expectedPoints: List[str]
    refFile: str
    refLines: str
    suspicionText: str

class CodeAuditReport(BaseModel):
    strengths: List[str] = []
    weaknesses: List[str] = []
    security: str
    architecture: str
    codeSmells: str
    technicalDebt: str
    recommendations: str

class ProjectAnalysisResponse(BaseModel):
    session_id: Optional[str] = None
    title: str
    description: str
    files_count: int
    languages: Dict[str, int]
    architecture_pattern: str
    tech_stack: TechStackInfo
    dependencies: List[DependencyInfo]
    confidence_score: int
    confidence_label: str
    authenticity: AuthenticityReport
    suggested_skills: List[SkillDetection] = []
    outcome_verification: List[OutcomeVerification] = []
    viva_questions: List[VivaQuestion] = []
    audit: CodeAuditReport
