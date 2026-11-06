import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_PROJECTS, MOCK_LOGS } from '../data/mockData';

const ProjectContext = createContext();

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // App Navigation Stage: derived from URL path
  const getStageFromPath = (path) => {
    switch (path) {
      case '/': return 1;
      case '/analysis': return 2;
      case '/viva': return 3;
      case '/report': return 4;
      default: return 1;
    }
  };

  const currentStage = getStageFromPath(location.pathname);

  const setCurrentStage = useCallback((stageId) => {
    switch (stageId) {
      case 1: navigate('/'); break;
      case 2: navigate('/analysis'); break;
      case 3: navigate('/viva'); break;
      case 4: navigate('/report'); break;
      default: navigate('/');
    }
  }, [navigate]);

  // LLM Provider state ('local' | 'gemini')
  const [llmProvider, setLlmProvider] = useState('local');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [consentRecord, setConsentRecord] = useState(null);

  // Stage 1: Upload Details
  const [projectDetails, setProjectDetails] = useState({
    title: '',
    description: '',
    outcomes: [],
    zipFile: null,
    questionsCount: 5,
    focusAreas: ['Frontend', 'Backend', 'Architecture']
  });

  // Stage 2: Live Analysis State
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLogs, setAnalysisLogs] = useState([]);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [filesAnalyzed, setFilesAnalyzed] = useState(0);

  // Stage 3: Viva Mode State
  const [vivaQuestions, setVivaQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [vivaAnswers, setVivaAnswers] = useState({}); // questionId -> text
  const [vivaGrades, setVivaGrades] = useState({}); // questionId -> 'Fail' | 'Partial' | 'Approve'
  const [revealedExpected, setRevealedExpected] = useState({}); // questionId -> bool
  const [countdownTimer, setCountdownTimer] = useState(180);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [vivaScores, setVivaScores] = useState({
    technical: 5.0,
    communication: 5.0,
    confidence: 5.0,
    avgScore: 5.0
  });
  const [suspicionLogs, setSuspicionLogs] = useState([]);
  const [vivaCompletedCount, setVivaCompletedCount] = useState(0);

  // Final Assessment Data
  const [selectedProjectTemplate, setSelectedProjectTemplate] = useState(null);

  // Load a project template or generate metrics from upload
  const initializeProjectData = (title) => {
    // Try to match search terms with mock templates
    const normalizedTitle = title.toLowerCase();
    let template = DEFAULT_PROJECTS.find(p => 
      normalizedTitle.includes(p.rawTitle.toLowerCase()) || 
      p.rawTitle.toLowerCase().includes(normalizedTitle)
    );

    // Fallback template if no match is found
    if (!template) {
      template = {
        ...DEFAULT_PROJECTS[0], // Use Nexus Core Migration as a structural baseline
        id: 'custom-project-' + Date.now(),
        title: `Project: ${title}`,
        rawTitle: title,
        description: projectDetails.description || 'Custom uploaded codebase analyzer.',
        outcomes: projectDetails.outcomes.length > 0 ? projectDetails.outcomes : [
          'Implemented primary business functionalities',
          'Optimized runtime execution of core logic modules',
          'Configured modular code patterns and package bindings'
        ]
      };
    }
    
    setSelectedProjectTemplate(template);
    return template;
  };

  // Stage 1 Action: Submit Project Form
  const submitProject = async (details) => {
    setProjectDetails(details);
    
    // Clear and prepare analysis states
    setAnalysisProgress(0);
    setAnalysisLogs(['Initiating request to diagnostic server...']);
    setIsAnalysisComplete(false);
    setFilesAnalyzed(0);
    setIsAnalysisRunning(true);
    
    // Prepare Viva State default values
    setCurrentQuestionIdx(0);
    setVivaAnswers({});
    setVivaGrades({});
    setRevealedExpected({});
    setVivaScores({
      technical: 5.0,
      communication: 5.0,
      confidence: 5.0,
      avgScore: 5.0
    });
    setSuspicionLogs([]);
    setVivaCompletedCount(0);
    
    // Transition to Stage 2
    setCurrentStage(2);

    // Start UI Log Simulation
    let uiProgress = 0;
    let logIndex = 0;
    const progressTimer = setInterval(() => {
      if (uiProgress < 90) {
        uiProgress += Math.floor(Math.random() * 8) + 2;
        setAnalysisProgress(Math.min(uiProgress, 90));
        
        if (logIndex < MOCK_LOGS.length) {
          setAnalysisLogs(prev => [...prev, MOCK_LOGS[logIndex]]);
          logIndex++;
        }
        setFilesAnalyzed(prev => Math.min(prev + Math.floor(Math.random() * 12) + 4, 120));
      }
    }, 350);

    try {
      // 1. Prepare FormData
      const formData = new FormData();
      formData.append('title', details.title);
      formData.append('description', details.description);
      formData.append('outcomes', JSON.stringify(details.outcomes));
      formData.append('questionsCount', details.questionsCount);
      formData.append('focusAreas', JSON.stringify(details.focusAreas));
      
      // Prepare ZIP file instance (wrap mock or real file)
      let fileToUpload;
      if (details.zipFile instanceof File) {
        fileToUpload = details.zipFile;
      } else {
        // Quick load templates mock file: create a tiny dummy ZIP Blob
        const dummyContent = new Uint8Array([80, 75, 3, 4, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // PK.. ZIP header
        fileToUpload = new File([dummyContent], details.zipFile?.name || "project.zip", { type: "application/zip" });
      }
      formData.append('file', fileToUpload);

      // 2. Fetch API Call
      const response = await fetch('http://localhost:8000/api/analyze-submission', {
        method: 'POST',
        headers: {
          'X-LLM-Provider': llmProvider
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();
      setSessionId(result.session_id);
      
      // Stop the UI progress interval
      clearInterval(progressTimer);

      // Finish progression and sync state
      setAnalysisProgress(100);
      setFilesAnalyzed(result.files_count);
      setAnalysisLogs(prev => [
        ...prev,
        'API analysis completed successfully.',
        `Extracted ${result.files_count} files.`,
        `Detected Architecture: ${result.architecture_pattern}`,
        'Ready for examination.'
      ]);

      // Map backend response fields to selectedProjectTemplate
      setSelectedProjectTemplate({
        id: 'project-' + Date.now(),
        title: result.title,
        description: result.description,
        outcomes: result.outcome_verification.map(ov => ov.outcome),
        architecture: result.architecture_pattern,
        techStack: result.tech_stack,
        dependencies: result.dependencies,
        confidence: result.confidence_score,
        confidenceLabel: result.confidence_label,
        authenticityScore: result.authenticity.score,
        suggested_skills: result.suggested_skills,
        authenticityBreakdown: {
          backend: result.authenticity.score - 5,
          frontend: result.tech_stack.frontend.length * 20 + 35,
          database: result.tech_stack.database.length * 20 + 40,
          authentication: result.authenticity.real_indicators.some(i => i.toLowerCase().includes('auth')) ? 90 : 50,
          businessLogic: result.authenticity.score + 5,
          deployment: result.tech_stack.devops.length > 0 ? 90 : 50
        },
        indicators: {
          real: result.authenticity.real_indicators,
          missing: result.authenticity.missing_indicators,
          superficial: result.authenticity.superficial_indicators,
          verdict: result.authenticity.verdict
        },
        audit: result.audit,
        questions: result.viva_questions
      });

      setVivaQuestions(result.viva_questions);
      setIsAnalysisRunning(false);
      setIsAnalysisComplete(true);

    } catch (error) {
      console.error('Backend API error:', error);
      clearInterval(progressTimer);
      
      // Fallback behavior: load local mock templates so the app doesn't break if server is down!
      setAnalysisLogs(prev => [
        ...prev,
        `[Warning] Diagnostics server unreachable: ${error.message}`,
        'Loading high-fidelity local emulation model...'
      ]);

      // Delay a bit to simulate loading
      setTimeout(() => {
        const template = initializeProjectData(details.title);
        setAnalysisProgress(100);
        setFilesAnalyzed(template.files.length);
        setAnalysisLogs(prev => [
          ...prev,
          'Local simulation successfully compiled.',
          'Ready for examination.'
        ]);
        
        setVivaQuestions(template.questions.slice(0, details.questionsCount));
        setIsAnalysisRunning(false);
        setIsAnalysisComplete(true);
      }, 1000);
    }
  };


  // Stage 3 Actions: Interactive Viva
  
  // Timer Management
  useEffect(() => {
    let timerId;
    if (isTimerActive && countdownTimer > 0 && currentStage === 3) {
      timerId = setTimeout(() => {
        setCountdownTimer(prev => prev - 1);
      }, 1000);
    } else if (countdownTimer === 0 && isTimerActive) {
      setIsTimerActive(false);
      // Auto-skip or grade as Fail on timeout
      handleTimeout();
    }
    return () => clearTimeout(timerId);
  }, [countdownTimer, isTimerActive, currentStage]);

  const startTimer = useCallback((duration) => {
    setCountdownTimer(duration || 120);
    setIsTimerActive(true);
  }, []);

  const stopTimer = useCallback(() => {
    setIsTimerActive(false);
  }, []);

  const resetTimer = useCallback((duration) => {
    setCountdownTimer(duration || 120);
    setIsTimerActive(true);
  }, []);

  const handleTimeout = () => {
    const currentQuestion = vivaQuestions[currentQuestionIdx];
    if (currentQuestion) {
      gradeAnswer(currentQuestion.id, 'Fail');
      setSuspicionLogs(prev => [...prev, `Timer expired on Question ${currentQuestionIdx + 1}. Marked as unverified.`]);
    }
  };

  // User saves draft text response
  const saveAnswerDraft = (questionId, answerText) => {
    setVivaAnswers(prev => ({
      ...prev,
      [questionId]: answerText
    }));
  };

  // Reveal Expected answer (blurs removed)
  const revealExpected = (questionId) => {
    setRevealedExpected(prev => ({
      ...prev,
      [questionId]: true
    }));
    // Stopping the countdown timer once answers are revealed and grading is active
    stopTimer();
  };

  // Grade the answer ('Fail', 'Partial', 'Approve')
  const gradeAnswer = (questionId, grade) => {
    setVivaGrades(prev => ({
      ...prev,
      [questionId]: grade
    }));

    // Calculate score shifts based on grade
    let techShift = 0;
    let commShift = 0;
    let confShift = 0;

    if (grade === 'Approve') {
      techShift = Math.random() * 0.8 + 0.4;
      commShift = Math.random() * 0.6 + 0.3;
      confShift = Math.random() * 0.8 + 0.2;
    } else if (grade === 'Partial') {
      techShift = Math.random() * 0.3 - 0.1;
      commShift = Math.random() * 0.4 + 0.1;
      confShift = Math.random() * 0.2 - 0.1;
    } else if (grade === 'Fail') {
      techShift = -(Math.random() * 1.2 + 0.5);
      commShift = -(Math.random() * 0.8 + 0.3);
      confShift = -(Math.random() * 1.5 + 0.5);
    }

    setVivaScores(prev => {
      const nextTech = Math.max(1, Math.min(10, +(prev.technical + techShift).toFixed(1)));
      const nextComm = Math.max(1, Math.min(10, +(prev.communication + commShift).toFixed(1)));
      const nextConf = Math.max(1, Math.min(10, +(prev.confidence + confShift).toFixed(1)));
      const nextAvg = +((nextTech + nextComm + nextConf) / 3).toFixed(1);
      
      return {
        technical: nextTech,
        communication: nextComm,
        confidence: nextConf,
        avgScore: nextAvg
      };
    });

    // Handle suspicion flags
    const questionObj = vivaQuestions.find(q => q.id === questionId);
    const qIdx = vivaQuestions.findIndex(q => q.id === questionId);
    if (grade === 'Fail' && questionObj?.suspicionText) {
      setSuspicionLogs(prev => [...prev, `Question ${qIdx + 1}: ${questionObj.suspicionText}`]);
    } else if (grade === 'Partial' && Math.random() > 0.5 && questionObj?.suspicionText) {
      setSuspicionLogs(prev => [...prev, `Question ${qIdx + 1}: ${questionObj.suspicionText}`]);
    }
  };

  const proceedToNextQuestion = (questionId, answerText) => {
    // Save draft
    saveAnswerDraft(questionId, answerText);

    // Increment completed count
    setVivaCompletedCount(prev => prev + 1);

    // Advance to next question
    if (currentQuestionIdx + 1 < vivaQuestions.length) {
      const nextIdx = currentQuestionIdx + 1;
      setCurrentQuestionIdx(nextIdx);
      const nextQuestion = vivaQuestions[nextIdx];
      resetTimer(nextQuestion?.timeLimit || 120);
    } else {
      // Completed questionnaire! Let timer expire.
      stopTimer();
    }
  };

  const skipQuestion = (questionId) => {
    proceedToNextQuestion(questionId, 'Skipped by candidate.');
  };

  const evaluateAndProceed = async (questionId, answerText) => {
    const question = vivaQuestions.find(q => q.id === questionId);

    // Pre-check: if answer is clearly junk/empty, auto-fail without wasting an API call
    const trimmed = (answerText || '').trim();
    if (trimmed.length < 15 || /^(test|testing|idk|no|yes|na|n\/a|skip|\.+|x+)$/i.test(trimmed)) {
      gradeAnswer(questionId, 'Fail');
      proceedToNextQuestion(questionId, answerText);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/evaluate-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LLM-Provider': llmProvider
        },
        body: JSON.stringify({
          question: question?.question || '',
          expectedPoints: question?.expectedPoints || question?.expected_points || [],
          candidateAnswer: answerText
        })
      });

      if (response.ok) {
        const result = await response.json();
        // Normalise grade: backend may return Approve / Partial / Fail (any casing)
        const rawGrade = (result.grade || '').toLowerCase();
        let grade = 'Partial';
        if (rawGrade === 'approve' || rawGrade === 'pass' || rawGrade === 'approved') {
          grade = 'Approve';
        } else if (rawGrade === 'fail' || rawGrade === 'failed' || rawGrade === 'incorrect') {
          grade = 'Fail';
        } else {
          grade = 'Partial';
        }
        gradeAnswer(questionId, grade);

        // Store feedback text for use in report
        setVivaAnswers(prev => ({
          ...prev,
          [`${questionId}_feedback`]: result.feedback || '',
          [`${questionId}_points_met`]: (result.points_met || []).join(', ')
        }));
      } else {
        // Backend error: grade conservatively based on answer length
        const wordCount = trimmed.split(/\s+/).length;
        gradeAnswer(questionId, wordCount >= 30 ? 'Partial' : 'Fail');
      }
    } catch (err) {
      console.error('Evaluation API unreachable, falling back to heuristic grading:', err);
      // Heuristic fallback: rough grade by word count and keyword presence
      const wordCount = trimmed.split(/\s+/).length;
      const techKeywords = question?.expectedPoints?.join(' ').toLowerCase() || '';
      const answerLower = trimmed.toLowerCase();
      const keywordMatches = techKeywords.split(' ').filter(w => w.length > 4 && answerLower.includes(w)).length;
      if (wordCount >= 50 && keywordMatches >= 2) {
        gradeAnswer(questionId, 'Approve');
      } else if (wordCount >= 20 || keywordMatches >= 1) {
        gradeAnswer(questionId, 'Partial');
      } else {
        gradeAnswer(questionId, 'Fail');
      }
    }

    proceedToNextQuestion(questionId, answerText);
  };


  const logConsentRecord = async (consentDetails) => {
    try {
      const payload = {
        session_id: sessionId || 'default_session',
        userId: consentDetails.userId || 'default_student',
        timestamp: consentDetails.timestamp || new Date().toISOString(),
        permissionsGranted: consentDetails.permissionsGranted || { camera: true, screenShare: true },
        consentCheckboxChecked: consentDetails.consentCheckboxChecked || true
      };
      const response = await fetch('http://localhost:8000/api/log-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        console.log('Consent logged successfully to backend');
      }
    } catch (err) {
      console.error('Failed to log consent to backend:', err);
    }
    setConsentRecord(consentDetails);
  };

  const logSuspicion = async (reason, type = 'Behavior anomaly', confidence = null) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSuspicionLogs(prev => [...prev, `[CHEAT DETECTED] [${timestamp}] ${reason}`]);

    try {
      await fetch('http://localhost:8000/api/log-proctor-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || 'default_session',
          timestamp: timestamp,
          type: type,
          confidence: confidence,
          details: reason
        })
      });
    } catch (err) {
      console.error('Failed to log proctor event to backend:', err);
    }
  };

  // Stage Navigation helpers
  const proceedToViva = () => {
    if (vivaQuestions.length > 0) {
      setCurrentStage(3);
      resetTimer(vivaQuestions[0].timeLimit || 120);
    }
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);

    for (let i = 0; i < vivaQuestions.length; i++) {
      const question = vivaQuestions[i];
      const answer = vivaAnswers[question.id] || '';

      if (!answer.trim() || answer === 'Skipped by candidate.') {
        gradeAnswer(question.id, 'Fail');
        continue;
      }

      try {
        const response = await fetch('http://localhost:8000/api/evaluate-answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-LLM-Provider': llmProvider
          },
          body: JSON.stringify({
            question: question.question,
            expectedPoints: question.expectedPoints,
            candidateAnswer: answer
          })
        });

        if (response.ok) {
          const data = await response.json();
          let finalGrade = 'Partial';
          if (data.grade && (data.grade.toLowerCase().includes('pass') || data.grade.toLowerCase().includes('approve') || data.grade.toLowerCase().includes('good') || data.grade.toLowerCase().includes('correct'))) {
            finalGrade = 'Approve';
          } else if (data.grade && data.grade.toLowerCase().includes('fail')) {
            finalGrade = 'Fail';
          }
          gradeAnswer(question.id, finalGrade);
        } else {
          gradeAnswer(question.id, 'Partial');
        }
      } catch (err) {
        console.error(`Evaluation failed for question ${question.id}:`, err);
        gradeAnswer(question.id, 'Partial');
      }
    }

    setIsGeneratingReport(false);
    setCurrentStage(4);
  };

  const resetApp = () => {
    setCurrentStage(1);
    setProjectDetails({
      title: '',
      description: '',
      outcomes: [],
      zipFile: null,
      questionsCount: 5,
      focusAreas: ['Frontend', 'Backend', 'Architecture']
    });
    setSelectedProjectTemplate(null);
    setIsAnalysisComplete(false);
    setIsAnalysisRunning(false);
    setVivaQuestions([]);
    setVivaAnswers({});
    setVivaGrades({});
    setVivaCompletedCount(0);
  };

  // Helper calculations for Stage 4 Report
  const getOverallPerformanceMetrics = () => {
    if (!selectedProjectTemplate) return null;
    
    // Overall score = (Viva Avg Score * 10) * 0.4 + (Template Authenticity Score) * 0.6
    const vivaScorePct = (vivaScores.avgScore * 10);
    const authenticityScore = selectedProjectTemplate.authenticityScore;
    const overallScore = Math.round((vivaScorePct * 0.4) + (authenticityScore * 0.6));
    
    // Determine classification
    let classification = 'Superficial';
    if (overallScore >= 85) {
      classification = 'Production Ready';
    } else if (overallScore >= 70) {
      classification = 'Mostly Complete';
    } else if (overallScore >= 50) {
      classification = 'Frontend Heavy';
    }

    return {
      overallScore,
      authenticityScore,
      vivaScore: Math.round(vivaScorePct),
      confidenceLabel: selectedProjectTemplate.confidenceLabel,
      classification
    };
  };

  return (
    <ProjectContext.Provider value={{
      currentStage,
      setCurrentStage,
      projectDetails,
      submitProject,
      llmProvider,
      setLlmProvider,
      isGeneratingReport,
      sessionId,
      consentRecord,
      logConsentRecord,
      
      // Stage 2
      analysisProgress,
      analysisLogs,
      isAnalysisRunning,
      isAnalysisComplete,
      filesAnalyzed,
      proceedToViva,
      
      // Stage 3
      vivaQuestions,
      currentQuestionIdx,
      setCurrentQuestionIdx,
      vivaAnswers,
      vivaGrades,
      revealedExpected,
      countdownTimer,
      isTimerActive,
      vivaScores,
      suspicionLogs,
      vivaCompletedCount,
      saveAnswerDraft,
      revealExpected,
      gradeAnswer,
      skipQuestion,
      evaluateAndProceed,
      logSuspicion,
      generateReport,
      
      // Stage 4
      selectedProjectTemplate,
      getOverallPerformanceMetrics,
      resetApp
    }}>
      {children}
    </ProjectContext.Provider>
  );
};
