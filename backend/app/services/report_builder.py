import json
from typing import Dict, Any, List
from app.models.response import (
    ProjectAnalysisResponse,
    TechStackInfo,
    DependencyInfo,
    AuthenticityReport,
    SkillDetection,
    OutcomeVerification,
    VivaQuestion,
    CodeAuditReport
)

class ReportBuilder:
    """
    Combines static scanner statistics, deterministic authenticity parameters,
    Phi-3 model logic, and Gemma-3 audits into the Pydantic ProjectAnalysisResponse schema.
    """

    @classmethod
    def build_report(
        cls,
        title: str,
        description: str,
        scan_results: Dict[str, Any],
        auth_results: Dict[str, Any],
        phi_outputs: Dict[str, Any],
        gemma_outputs: Dict[str, Any],
        loaded_models: List[str]
    ) -> ProjectAnalysisResponse:
        # 1. Structure Tech Stack Info
        technologies = scan_results.get("technologies", [])
        languages = scan_results.get("languages", {})
        
        fe_techs = [t for t in technologies if t in ["React", "HTML", "CSS"]]
        if "React JS" in languages or "React TS" in languages:
            if "React" not in fe_techs:
                fe_techs.append("React")
                
        be_techs = [t for t in technologies if t in ["Node.js", "Express", "FastAPI", "PyTorch", "NumPy"]]
        db_techs = [t for t in technologies if t in ["Redis", "PostgreSQL", "MongoDB", "Mongoose", "SQLite"]]
        
        tech_stack = TechStackInfo(
            frontend=fe_techs,
            backend=be_techs,
            database=db_techs,
            devops=["Docker"] if scan_results.get("features", {}).get("docker") else []
        )

        # 2. Structure Dependencies list
        mapped_deps = [
            DependencyInfo(
                name=d.get("name", "unknown"),
                version=d.get("version", "latest"),
                type=d.get("type", "Production")
            )
            for d in scan_results.get("dependencies", [])
        ]

        # 3. Structure Authenticity Report
        # Verdict is the AI verdict explanation if Gemma is enabled, otherwise use the rule-engine fallback
        verdict = gemma_outputs.get("verdict_explanation")
        if not verdict:
            verdict = f"Authenticity score of {auth_results.get('score', 0)}% evaluated based on codebase structure and static signature matches."

        authenticity = AuthenticityReport(
            score=auth_results.get("score", 0),
            classification=auth_results.get("classification", "Superficial"),
            real_indicators=auth_results.get("real_indicators", []),
            missing_indicators=auth_results.get("missing_indicators", []),
            superficial_indicators=auth_results.get("superficial_indicators", []),
            verdict=verdict
        )

        # 4. Compile Confidence Metrics
        # Derived directly from the deterministic authenticity score
        confidence_score = authenticity.score
        if confidence_score >= 85:
            confidence_label = "Very High Probability"
        elif confidence_score >= 70:
            confidence_label = "High Probability"
        elif confidence_score >= 50:
            confidence_label = "Moderate Probability"
        else:
            confidence_label = "Low Probability"

        # 5. Structure Suggested Skills (Phi-3)
        skills_raw = phi_outputs.get("skills", [])
        suggested_skills = []
        for s in skills_raw:
            if not isinstance(s, dict):
                continue
            
            # Normalize confidence if it is an integer percentage (e.g. 95 -> 0.95)
            conf = s.get("confidence", 0.0)
            try:
                conf = float(conf)
                if conf > 1.0:
                    conf = conf / 100.0
                conf = max(0.0, min(1.0, conf))
            except (ValueError, TypeError):
                conf = 0.0
                
            suggested_skills.append(
                SkillDetection(
                    skill_id=str(s.get("skill_id", "sk-unknown")),
                    skill_name=str(s.get("skill_name", "Unknown")),
                    confidence=conf,
                    rationale=str(s.get("rationale", ""))
                )
            )

        # 6. Structure Outcome Verification (Phi-3)
        outcomes_raw = phi_outputs.get("outcomes", [])
        outcome_verification = []
        valid_statuses = {'Met', 'Partial', 'Missing', 'Not Verifiable'}
        for o in outcomes_raw:
            if not isinstance(o, dict):
                continue
            
            status = str(o.get("status", "Not Verifiable")).strip()
            # Title-case normalization
            status = status.title()
            if status not in valid_statuses:
                status = "Not Verifiable"

            outcome_verification.append(
                OutcomeVerification(
                    outcome=str(o.get("outcome", "")),
                    status=status,
                    evidence=str(o.get("evidence", "")),
                    gap=str(o.get("gap", "-"))
                )
            )

        # 7. Structure Viva Questions (Phi-3)
        viva_raw = phi_outputs.get("viva_questions", [])
        viva_questions = []
        valid_types = {'Conceptual', 'Codebase Specific'}
        valid_difficulties = {'Easy', 'Medium', 'Hard'}
        
        for q in viva_raw:
            if not isinstance(q, dict):
                continue
            
            # Map numeric difficulty or title case
            diff = str(q.get("difficulty", "Medium")).strip().title()
            if diff not in valid_difficulties:
                diff = "Medium"

            qtype = str(q.get("type", "Conceptual")).strip()
            # Map common casing mismatches
            if "codebase" in qtype.lower():
                qtype = "Codebase Specific"
            elif "conceptual" in qtype.lower():
                qtype = "Conceptual"
            else:
                qtype = "Conceptual"

            # Parse limits
            time_limit = q.get("timeLimit") or q.get("time_limit") or 120
            try:
                time_limit = int(time_limit)
            except (ValueError, TypeError):
                time_limit = 120

            q_id = q.get("id") or q.get("question_id") or (len(viva_questions) + 1)
            try:
                q_id = int(q_id)
            except (ValueError, TypeError):
                q_id = len(viva_questions) + 1

            expected_points = q.get("expectedPoints") or q.get("expected_points") or []
            if not isinstance(expected_points, list):
                expected_points = [str(expected_points)]
            expected_points = [str(p) for p in expected_points]

            skill_name = str(q.get("skill_name") or q.get("skill") or "Python")

            viva_questions.append(
                VivaQuestion(
                    id=q_id,
                    skill_name=skill_name,
                    question=str(q.get("question", "")),
                    type=qtype,
                    difficulty=diff,
                    timeLimit=time_limit,
                    expectedPoints=expected_points,
                    refFile=str(q.get("refFile") or q.get("ref_file") or ""),
                    refLines=str(q.get("refLines") or q.get("ref_lines") or ""),
                    suspicionText=str(q.get("suspicionText") or q.get("suspicion_text") or "")
                )
            )

        # 8. Structure Audit Report
        audit_raw = gemma_outputs.get("audit_report", {})
        arch_pattern = gemma_outputs.get("architecture_review", "Modular Layout")
        
        strengths = audit_raw.get("strengths") or []
        if not isinstance(strengths, list):
            strengths = [str(strengths)]
            
        weaknesses = audit_raw.get("weaknesses") or []
        if not isinstance(weaknesses, list):
            weaknesses = [str(weaknesses)]

        audit_report = CodeAuditReport(
            strengths=[str(s) for s in strengths],
            weaknesses=[str(w) for w in weaknesses],
            security=str(audit_raw.get("security", "")),
            architecture=str(arch_pattern),
            codeSmells=str(audit_raw.get("codeSmells") or audit_raw.get("code_smells") or ""),
            technicalDebt=str(audit_raw.get("technicalDebt") or audit_raw.get("technical_debt") or ""),
            recommendations=str(audit_raw.get("recommendations", ""))
        )

        # 9. Return Unified ProjectAnalysisResponse
        return ProjectAnalysisResponse(
            title=title,
            description=description,
            files_count=scan_results.get("file_count", 0),
            languages=languages,
            architecture_pattern=arch_pattern,
            tech_stack=tech_stack,
            dependencies=mapped_deps,
            confidence_score=confidence_score,
            confidence_label=confidence_label,
            authenticity=authenticity,
            suggested_skills=suggested_skills,
            outcome_verification=outcome_verification,
            viva_questions=viva_questions,
            audit=audit_report
        )
