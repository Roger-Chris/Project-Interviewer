import React, { useState, useEffect } from 'react';
import { HelpCircle, Clock, ArrowRight, Loader2 } from 'lucide-react';

const VivaQuestionCard = ({
  question,
  currentIndex,
  totalQuestions,
  timer,
  userAnswer = '',
  onAnswerChange,
  evaluateAndProceed
}) => {
  const [answerDraft, setAnswerDraft] = useState(userAnswer);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync draft answer state when question changes
  useEffect(() => {
    setAnswerDraft(userAnswer || '');
    setIsSubmitting(false);
  }, [question, userAnswer]);

  const handleTextChange = (e) => {
    setAnswerDraft(e.target.value);
    onAnswerChange(question.id, e.target.value);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await evaluateAndProceed(question.id, answerDraft);
    // isSubmitting will reset on next question via useEffect
  };

  // Convert seconds to MM:SS format
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card-gradient rounded-2xl p-6 border border-dark-600/35 relative flex flex-col md:flex-row gap-8 w-full max-w-5xl mx-auto h-[500px]">
      
      {/* Left Pane: Question Context */}
      <div className="flex-1 flex flex-col gap-6 h-full border-r border-dark-600/30 pr-6 overflow-y-auto custom-scrollbar">
        {/* Top Header Row */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-2 select-none">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 text-xs font-bold font-sans tracking-wide text-brand-300 bg-brand-500/10 border border-brand-500/20 rounded-full flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              Q {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
          
          {/* Timer countdown */}
          <div className="flex items-center gap-2 font-mono text-sm text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20">
            <Clock className="w-4 h-4" />
            <span>{formatTime(timer)}</span>
          </div>
        </div>
        
        {/* Badges */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-medium font-sans text-dark-300 bg-dark-800 border border-dark-600/30 rounded-md">
            Difficulty: {question.difficulty}
          </span>
          <span className="px-3 py-1 text-xs font-medium font-sans text-brand-400 bg-brand-500/5 border border-brand-500/10 rounded-md">
            Skill: {question.skill_name || question.type}
          </span>
        </div>

        {/* Question Text */}
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold font-sans text-white leading-relaxed tracking-tight select-text">
            "{question.question}"
          </h2>
        </div>

        {/* Code reference file metadata */}
        <div className="flex flex-col gap-1.5 px-4 py-3 rounded-lg bg-dark-900/50 border border-dark-600/20">
          <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider">Reference File</span>
          <div className="flex items-center gap-2 text-xs font-mono text-brand-300 select-text">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="break-all">{question.refFile} {question.refLines !== 'N/A' && `(Lines: ${question.refLines})`}</span>
          </div>
        </div>
      </div>

      {/* Right Pane: Answer Area */}
      <div className="flex-1 flex flex-col h-full">
        <label className="text-sm font-bold text-brand-300 tracking-wide select-none mb-3 flex items-center justify-between">
          <span>Your Answer</span>
          <span className="text-[10px] text-dark-400 font-normal uppercase tracking-widest bg-dark-800 px-2 py-0.5 rounded">Markdown Supported</span>
        </label>
        
        <textarea
          value={answerDraft}
          onChange={handleTextChange}
          disabled={isSubmitting}
          placeholder="Formulate your detailed answer here based on the codebase implementation..."
          className="w-full flex-1 px-5 py-4 text-sm font-sans rounded-xl bg-dark-950 border border-dark-600/50 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 resize-none custom-scrollbar shadow-inner"
        />

        {/* Submit Button */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!answerDraft.trim() || isSubmitting}
            className="px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 transition-all duration-300 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                Submit Answer
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VivaQuestionCard;
