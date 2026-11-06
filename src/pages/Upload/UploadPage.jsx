import React, { useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import ZipUpload from '../../components/upload/ZipUpload';
import AdvancedSettings from '../../components/upload/AdvancedSettings';
import Card from '../../components/common/Card';
import { ArrowRight, Sparkles, FileText } from 'lucide-react';

const UploadPage = () => {
  const { submitProject, llmProvider, setLlmProvider } = useProject();

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [zipFile, setZipFile] = useState(null);
  
  // Advanced Settings states
  const [questionsCount, setQuestionsCount] = useState(5);
  const [focusAreas, setFocusAreas] = useState(['Frontend', 'Backend', 'Architecture']);

  const [formError, setFormError] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Preset demo values for quick-fill
  const quickLoadTemplate = (type) => {
    if (type === 'nexus') {
      setTitle('Nexus Core Migration');
      setDescription('An event-driven architectural migration for scale, separating monolithic notification services into specialized message-queue consumers using Apache Kafka and Redis caching layers.');
      setOutcomesText(
        '- Implemented custom attention mechanism for event prioritisation\n' +
        '- Reduced message processing latency by 42%\n' +
        '- Achieved 99.9% delivery rate across 10m daily messages\n' +
        '- Configured automated fallback routing to dead-letter exchanges'
      );
      setZipFile({
        name: 'nexus-core-migration-v2.1.zip',
        size: '14.2',
        type: 'application/zip'
      });
    } else if (type === 'nn') {
      setTitle('Neural Network Optimizer');
      setDescription('A performance tuning module that compiles neural model hyperparameters and uses custom attention networks to compress visual processing pipelines by up to 40%.');
      setOutcomesText(
        '- Implemented custom attention mechanism\n' +
        '- Reduced inference latency by 40%\n' +
        '- Achieved 95% accuracy on test set'
      );
      setZipFile({
        name: 'nn-attention-optimizer.zip',
        size: '28.6',
        type: 'application/zip'
      });
    }
  };

  const handleSuggestSkills = async () => {
    if (!title.trim() || !description.trim()) {
      setFormError('Please fill in title and description first to suggest skills.');
      return;
    }
    setIsSuggesting(true);
    setFormError('');
    try {
      const outcomesArray = outcomesText
        .split('\n')
        .map(line => line.replace(/^[\s\-\*\d\.]+/g, '').trim())
        .filter(line => line.length > 0);

      const res = await fetch('http://localhost:8000/api/suggest-skills', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-LLM-Provider': llmProvider
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          outcomes: outcomesArray.length > 0 ? outcomesArray : ['Implemented project functionalities']
        })
      });
      if (!res.ok) throw new Error('Skill suggester offline');
      const data = await res.json();
      const newSkills = data.suggested_skills.map(s => s.name);
      setFocusAreas(prev => Array.from(new Set([...prev, ...newSkills])));
    } catch (e) {
      setFormError('Failed to fetch skill suggestions. Server may be offline.');
    } finally {
      setIsSuggesting(false);
    }
  };



  const handleStartAnalysis = (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setFormError('Project title is required.');
      return;
    }
    if (!description.trim()) {
      setFormError('Project description is required.');
      return;
    }
    if (!zipFile) {
      setFormError('Please upload a ZIP repository of the source code.');
      return;
    }

    setFormError('');

    const outcomesArray = outcomesText
      .split('\n')
      .map(line => line.replace(/^[\s\-\*\d\.]+/g, '').trim())
      .filter(line => line.length > 0);

    submitProject({
      title: title.trim(),
      description: description.trim(),
      outcomes: outcomesArray.length > 0 ? outcomesArray : ['Implemented primary project functions'],
      zipFile,
      questionsCount,
      focusAreas
    });
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 select-none max-w-3xl mx-auto space-y-8">
      {/* Title Header Section */}
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold font-sans text-white tracking-tight leading-tight mb-3">
          Initialize Analysis
        </h1>
        <p className="text-sm md:text-base text-dark-300 font-sans max-w-xl mx-auto leading-relaxed">
          Submit your project details and source code for precision diagnostic evaluation.
        </p>
      </div>

      {/* Quick Fill Widget */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 bg-dark-900/60 p-4 border border-dark-600/35 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400 animate-pulse" />
          <span className="text-dark-200 font-medium">Quick Test: Populate form with sample repository templates</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => quickLoadTemplate('nexus')}
            className="px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-600 text-brand-300 hover:text-white hover:border-brand-500 hover:bg-dark-700/60 transition-all font-semibold"
          >
            Nexus Migration
          </button>
          <button
            type="button"
            onClick={() => quickLoadTemplate('nn')}
            className="px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-600 text-brand-300 hover:text-white hover:border-brand-500 hover:bg-dark-700/60 transition-all font-semibold"
          >
            NN Optimizer
          </button>
        </div>
      </div>

      {/* Main Input Form */}
      <Card className="w-full flex flex-col gap-6 shadow-2xl relative" glow>
        <form onSubmit={handleStartAnalysis} className="flex flex-col gap-5 select-text">
          {/* LLM Engine Selection Toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-dark-400 tracking-widest uppercase select-none">
              LLM Processing Engine
            </label>
            <div className="grid grid-cols-2 p-1 bg-dark-950 border border-dark-600 rounded-xl">
              <button
                type="button"
                onClick={() => setLlmProvider('local')}
                className={`py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                  llmProvider === 'local'
                    ? 'bg-brand-500 text-white shadow-lg'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                Local Qwen (LM Studio)
              </button>
              <button
                type="button"
                onClick={() => setLlmProvider('gemini')}
                className={`py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                  llmProvider === 'gemini'
                    ? 'bg-brand-500 text-white shadow-lg'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                Cloud Gemini API
              </button>
            </div>
          </div>

          {/* Project Title */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-dark-400 tracking-widest uppercase select-none">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Neural Network Optimizer"
              className="w-full px-4 py-3 text-sm font-sans rounded-xl bg-dark-950 border border-dark-600 text-white placeholder-dark-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-300"
            />
          </div>

          {/* Project Description */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-dark-400 tracking-widest uppercase select-none">
              Project Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe the core functionality and architecture..."
              className="w-full h-28 px-4 py-3 text-sm font-sans rounded-xl bg-dark-950 border border-dark-600 text-white placeholder-dark-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-300 resize-none"
            />
          </div>

          {/* Project Outcomes */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center select-none">
              <label className="text-xs font-bold text-dark-400 tracking-widest uppercase">
                Project Outcomes
              </label>
              <button
                type="button"
                onClick={handleSuggestSkills}
                disabled={isSuggesting}
                className="text-[10px] font-bold text-brand-300 hover:text-white uppercase tracking-wider bg-brand-500/10 border border-brand-500/20 rounded-md px-2.5 py-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSuggesting ? 'Suggesting...' : 'Suggest Skill Tags'}
              </button>
            </div>
            <textarea
              value={outcomesText}
              onChange={(e) => setOutcomesText(e.target.value)}
              placeholder="- Implemented custom attention mechanism&#10;- Reduced inference latency by 40%&#10;- Achieved 95% accuracy on test set"
              className="w-full h-32 px-4 py-3 text-sm font-mono rounded-xl bg-dark-950 border border-dark-600 text-white placeholder-dark-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-300 resize-none"
            />
          </div>

          {/* ZIP Upload Area */}
          <ZipUpload
            selectedFile={zipFile}
            onFileSelected={(file) => setZipFile(file)}
            onFileCleared={() => setZipFile(null)}
          />

          {/* Advanced Accordion Settings */}
          <AdvancedSettings
            questionsCount={questionsCount}
            setQuestionsCount={setQuestionsCount}
            focusAreas={focusAreas}
            setFocusAreas={setFocusAreas}
          />

          {/* Bottom Error indicator / Actions */}
          <div className="flex items-center justify-between border-t border-dark-600/30 pt-6 mt-4 flex-wrap gap-4 select-none">
            <div className="text-xs text-dark-400 italic">
              {formError ? (
                <span className="text-red-500 not-italic font-medium">{formError}</span>
              ) : (
                'All fields required for precision diagnostics.'
              )}
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-xl text-xs font-bold tracking-wider text-white bg-brand-500 hover:bg-brand-600 hover:glow-button-shadow transition-all duration-300 flex items-center gap-2 group"
            >
              Start Analysis
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </form>
      </Card>



      {/* Sub-footer banner */}
      <div className="text-center text-[10px] text-dark-400 uppercase tracking-widest mt-6 flex items-center gap-1.5 justify-center">
        <svg className="w-3.5 h-3.5 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>End-to-end encrypted processing</span>
      </div>
    </div>
  );
};

export default UploadPage;
