import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Upload,
  Image as ImageIcon,
  Settings,
  Volume2,
  RefreshCw,
  Sparkles,
  Sliders,
  Cpu,
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
  Plus,
  SkipBack,
  SkipForward
} from 'lucide-react';
import { 
  extractTextFromPDF, 
  parseCVText, 
  detectLanguage, 
  generateCVSummary, 
  checkQualification 
} from './utils/CVParser';
import SpeechController from './utils/SpeechController';
import AvatarCanvas from './components/AvatarCanvas';
import CVDisplay from './components/CVDisplay';

export default function App() {
  // CV & Parsing States
  const [sections, setSections] = useState(null);
  const [cvFileName, setCvFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Avatar & Calibration States
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [gender, setGender] = useState('female');
  const [eyeY, setEyeY] = useState(40);
  const [mouthY, setMouthY] = useState(65);
  const [calibrationMode, setCalibrationMode] = useState(false);

  // Playback Settings
  const [speed, setSpeed] = useState(1.0);
  const [language, setLanguage] = useState('en');
  const [includeCommentary, setIncludeCommentary] = useState(true);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');

  // Active Playback Status
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [revealedSections, setRevealedSections] = useState(new Set());

  // Interactive CV Tabs, Qualifications & Summaries
  const [activeTab, setActiveTab] = useState('full-cv');
  const [qualificationInput, setQualificationInput] = useState('');
  const [qualificationResults, setQualificationResults] = useState([]);
  const [summaryData, setSummaryData] = useState(null);

  // UI Drag-and-Drop Visual States
  const [cvDragActive, setCvDragActive] = useState(false);
  const [photoDragActive, setPhotoDragActive] = useState(false);

  // SpeechController ref
  const speechControllerRef = useRef(null);

  // Initialize SpeechController and callbacks
  useEffect(() => {
    speechControllerRef.current = new SpeechController();
    const controller = speechControllerRef.current;

    const updateVoices = () => {
      const allVoices = controller.getVoices();
      setVoices(allVoices);
    };

    updateVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    controller.onItemStart = (item) => {
      setCurrentItem(item);
      if (item.sectionId && item.type === 'cv-sentence') {
        setRevealedSections((prev) => {
          const newSet = new Set(prev);
          newSet.add(item.sectionId);
          return newSet;
        });
      }
    };

    controller.onStateChange = (state) => {
      setIsPlaying(state.isPlaying);
      setIsPaused(state.isPaused);
      if (!state.isPlaying) {
        setCurrentItem(null);
      }
    };

    controller.onFinished = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentItem(null);
    };

    return () => {
      controller.stop();
    };
  }, []);

  // Update speed when slider changes mid-speech
  useEffect(() => {
    if (speechControllerRef.current) {
      if (isPlaying) {
        speechControllerRef.current.setRate(speed);
      } else {
        speechControllerRef.current.speed = speed;
      }
    }
  }, [speed, isPlaying]);

  // Automatically select the best voice when language, gender, or available voices change
  useEffect(() => {
    if (speechControllerRef.current && voices.length > 0) {
      const bestVoice = speechControllerRef.current.findVoice(language, gender);
      if (bestVoice) {
        setSelectedVoiceURI(bestVoice.voiceURI);
      }
    }
  }, [language, gender, voices]);

  // CV File Parsing Handler
  const handleCVFile = async (file) => {
    setIsParsing(true);
    setErrorMsg('');
    try {
      let text = '';
      if (file.name.endsWith('.pdf')) {
        text = await extractTextFromPDF(file);
      } else if (file.name.endsWith('.txt')) {
        text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error("Failed to read text file."));
          reader.readAsText(file);
        });
      } else {
        throw new Error("Unsupported file format. Please upload a PDF or TXT file.");
      }

      if (!text.trim()) {
        throw new Error("The file seems to be empty or has no readable text.");
      }

      processRawText(text, file.name);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to parse the CV file.");
    } finally {
      setIsParsing(false);
    }
  };

  // Helper to recheck all qualifications against a text
  const runAllQualificationChecks = (text, parsedSecs, currentQualList) => {
    const updated = currentQualList.map(q => {
      const result = checkQualification(text, q.text, parsedSecs);
      return {
        ...q,
        met: result.met,
        section: result.section,
        snippet: result.snippet,
        message: result.message
      };
    });
    setQualificationResults(updated);
  };

  // Plain Text parsing helper
  const processRawText = (text, fileName = 'Pasted Text') => {
    const lang = detectLanguage(text);
    const parsed = parseCVText(text, lang);
    const summary = generateCVSummary(parsed, lang);

    setSections(parsed);
    setLanguage(lang);
    setCvFileName(fileName);
    setRawText(text);
    setSummaryData(summary);
    setRevealedSections(new Set()); // reset revealed sections
    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
    }

    // Run qualification checks for already existing items
    runAllQualificationChecks(text, parsed, qualificationResults);
  };

  // Photo Upload Handler
  const handlePhotoFile = (file) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg("Please upload an image file for the bot photo.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setPhotoName(file.name);
    setCalibrationMode(true); // turn on helpers for mouth alignment
  };

  // Playback Trigger
  const handlePlay = () => {
    if (!sections || sections.length === 0) return;

    if (isPaused) {
      speechControllerRef.current.resume();
    } else {
      // Clear previous revealed sections and set up fresh play
      setRevealedSections(new Set());
      speechControllerRef.current.play(
        sections,
        language,
        gender,
        speed,
        includeCommentary,
        selectedVoiceURI
      );
    }
  };

  // Direct section playback trigger
  const handlePlaySection = (sectionId) => {
    if (!sections || sections.length === 0) return;
    
    // Clear previous revealed sections and start playing starting from sectionId
    setRevealedSections(new Set());
    speechControllerRef.current.play(
      sections,
      language,
      gender,
      speed,
      includeCommentary,
      selectedVoiceURI,
      sectionId
    );
  };

  // Summary playback trigger
  const handlePlaySummary = () => {
    if (!summaryData) return;

    // Split summary overview and bullets into sentences
    const overviewSentences = summaryData.overview.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const bulletSentences = summaryData.bullets.map(b => b.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)).flat();

    const summarySection = {
      id: 'summary-narration',
      title: 'Executive Summary',
      icon: 'summary',
      paragraphs: [
        overviewSentences,
        bulletSentences
      ]
    };

    setRevealedSections(new Set(['summary-narration']));
    speechControllerRef.current.play(
      [summarySection],
      language,
      gender,
      speed,
      false, // no commentary
      selectedVoiceURI
    );
  };

  // Skip section navigation
  const handlePrevSection = () => {
    if (speechControllerRef.current) {
      speechControllerRef.current.previousSection();
    }
  };

  const handleNextSection = () => {
    if (speechControllerRef.current) {
      speechControllerRef.current.nextSection();
    }
  };

  // Qualification Validator Handlers
  const handleAddQualification = (e) => {
    if (e) e.preventDefault();
    const trimmed = qualificationInput.trim();
    if (!trimmed) return;

    // Avoid duplicate checks
    if (qualificationResults.some(q => q.text.toLowerCase() === trimmed.toLowerCase())) {
      setQualificationInput('');
      return;
    }

    const result = checkQualification(rawText, trimmed, sections);
    const newQual = {
      id: Date.now().toString(),
      text: trimmed,
      met: result.met,
      section: result.section,
      snippet: result.snippet,
      message: result.message
    };

    setQualificationResults(prev => [...prev, newQual]);
    setQualificationInput('');
  };

  const handleRemoveQualification = (id) => {
    setQualificationResults(prev => prev.filter(q => q.id !== id));
  };

  const handlePause = () => {
    speechControllerRef.current.pause();
  };

  const handleStop = () => {
    speechControllerRef.current.stop();
    setRevealedSections(new Set());
  };

  const resetCV = () => {
    handleStop();
    setSections(null);
    setCvFileName('');
    setRawText('');
    setSummaryData(null);
    // Clear results metrics but keep keys in the checklist (showing them as not met/not validated)
    setQualificationResults(prev => prev.map(q => ({ ...q, met: false, snippet: null, section: null, message: '' })));
  };

  const resetPhoto = () => {
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
    setPhotoUrl(null);
    setPhotoName('');
    setCalibrationMode(false);
  };

  // Drag and Drop Helpers
  const handleDrag = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      if (type === 'cv') setCvDragActive(true);
      if (type === 'photo') setPhotoDragActive(true);
    } else if (e.type === "dragleave") {
      if (type === 'cv') setCvDragActive(false);
      if (type === 'photo') setPhotoDragActive(false);
    }
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'cv') {
      setCvDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleCVFile(e.dataTransfer.files[0]);
      }
    }
    if (type === 'photo') {
      setPhotoDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handlePhotoFile(e.dataTransfer.files[0]);
      }
    }
  };

  // Resolve what subtitle content to display below the bot
  const renderSubtitleText = () => {
    if (!currentItem) {
      return (
        <>
          <span className="subtitle-prefix">Interactive CV</span>
          <span>Upload a CV and click Play to start reading!</span>
        </>
      );
    }

    if (currentItem.type === 'commentary') {
      return (
        <>
          <span className="subtitle-prefix" style={{ color: 'var(--secondary)' }}>Bot Narrator</span>
          <span>"{currentItem.text}"</span>
        </>
      );
    }

    return (
      <>
        <span className="subtitle-prefix" style={{ color: 'var(--primary)' }}>
          {currentItem.sectionTitle || 'CV'}
        </span>
        <span>{currentItem.text}</span>
      </>
    );
  };

  return (
    <div className="app-container">
      {/* Brand Header */}
      <header className="app-header">
        <div className="brand">
          <div className="logo-glow">I</div>
          <div>
            <h1>Interactive CV</h1>
            <p style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>INTERACTIVE RESUME READER BOT</p>
          </div>
        </div>
        <div className="card-glass" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Sparkles size={16} className="text-secondary" style={{ color: 'var(--secondary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Web Speech Engine</span>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="dashboard-grid">

        {/* Left Side: Avatar Control Panel */}
        <section className="sidebar-panel">

          {/* Avatar card */}
          <div className="card-glass bot-container">
            <AvatarCanvas
              photoUrl={photoUrl}
              isSpeaking={isPlaying}
              isPaused={isPaused}
              eyeY={eyeY}
              mouthY={mouthY}
              gender={gender}
              calibrationMode={calibrationMode}
            />

            {/* Subtitle Teleprompter Bar */}
            <div className="subtitle-bar">
              <p className="subtitle-text">
                {renderSubtitleText()}
              </p>
            </div>

            {/* TTS Control Triggers */}
            <div className="playback-controls">
              <button
                className="btn-secondary btn-icon-only"
                onClick={handlePrevSection}
                title="Previous Section"
                disabled={!isPlaying}
              >
                <SkipBack size={18} />
              </button>

              {isPlaying && !isPaused ? (
                <button
                  className="btn-primary btn-icon-only"
                  onClick={handlePause}
                  title="Pause Reading"
                  disabled={!sections}
                >
                  <Pause size={20} />
                </button>
              ) : (
                <button
                  className="btn-primary btn-icon-only"
                  onClick={handlePlay}
                  title="Play Reading"
                  disabled={!sections}
                >
                  <Play size={20} style={{ marginLeft: '2px' }} />
                </button>
              )}

              <button
                className="btn-secondary btn-icon-only"
                onClick={handleNextSection}
                title="Skip Section (Next Section)"
                disabled={!isPlaying}
              >
                <SkipForward size={18} />
              </button>

              <button
                className="btn-secondary btn-icon-only"
                onClick={handleStop}
                title="Stop Reading"
                disabled={!isPlaying}
              >
                <Square size={16} fill="currentColor" />
              </button>
            </div>
          </div>

          {/* Voice Settings card */}
          <div className="card-glass settings-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              <Settings size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem' }}>Voice & Bot Settings</h3>
            </div>

            {/* Gender Select */}
            <div className="setting-row">
              <label>Bot Persona / Voice Gender</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={gender === 'female' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setGender('female')}
                  style={{ padding: '0.5rem' }}
                >
                  Female Voice
                </button>
                <button
                  type="button"
                  className={gender === 'male' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setGender('male')}
                  style={{ padding: '0.5rem' }}
                >
                  Male Voice
                </button>
              </div>
            </div>

            {/* Language Selection Override */}
            <div className="setting-row">
              <label>CV Language</label>
              <select
                className="w-full bg-slate-900 border border-slate-700/60 rounded-lg p-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/80 transition-all cursor-pointer"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option className="bg-slate-800 text-slate-100" value="en">English (auto-detects common keywords)</option>
                <option className="bg-slate-800 text-slate-100" value="es">Spanish / Español</option>
                <option className="bg-slate-800 text-slate-100" value="fr">French / Français</option>
                <option className="bg-slate-800 text-slate-100" value="de">German / Deutsch</option>
                <option className="bg-slate-800 text-slate-100" value="ar">Arabic / العربية (Egyptian)</option>
              </select>
            </div>

            {/* Specific Voice Selection Dropdown */}
            <div className="setting-row">
              <label>Select Voice</label>
              <select
                className="w-full bg-slate-900 border border-slate-700/60 rounded-lg p-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/80 transition-all cursor-pointer"
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
              >
                {(() => {
                  const femaleKeywords = ['female', 'zira', 'hazel', 'susan', 'heera', 'haruka', 'hortense', 'hedda', 'samantha', 'tessa', 'moira', 'karen', 'elena', 'laura', 'anna', 'katja', 'aria', 'natasha', 'sara', 'zariyah', 'jenny', 'sabina', 'helena', 'hoda'];
                  const maleKeywords = ['male', 'david', 'george', 'mark', 'ravi', 'daniel', 'oliver', 'peter', 'stefan', 'yannick', 'pablo', 'guy', 'james', 'conrad', 'microsoft guy', 'guy online'];

                  const getVoiceGender = (voice) => {
                    const name = voice.name.toLowerCase();
                    if (femaleKeywords.some(k => name.includes(k))) return 'female';
                    if (maleKeywords.some(k => name.includes(k))) return 'male';
                    if (name.includes('google us english')) return 'female';
                    return 'unknown';
                  };

                  // Filter by language and gender
                  const filtered = voices.filter(v => {
                    const matchesLang = v.lang.toLowerCase().startsWith(language.toLowerCase());
                    if (!matchesLang) return false;

                    const vGender = getVoiceGender(v);
                    if (gender === 'female') {
                      return vGender === 'female' || vGender === 'unknown';
                    } else {
                      return vGender === 'male' || vGender === 'unknown';
                    }
                  });

                  // Fallback: if no matches are found, show all matching language voices
                  const listToUse = filtered.length > 0 ? filtered : voices.filter(v =>
                    v.lang.toLowerCase().startsWith(language.toLowerCase())
                  );

                  // Sort voices so natural ones are first in the list
                  const scoreVoice = (voice) => {
                    const name = voice.name.toLowerCase();
                    let score = 0;
                    if (name.includes('natural')) score += 100;
                    if (name.includes('online')) score += 50;
                    if (name.includes('google')) score += 30;
                    if (name.includes('neural')) score += 20;

                    const vGender = getVoiceGender(voice);
                    if (vGender === gender) score += 40;

                    if (name.includes('david') || name.includes('zira')) score -= 50;
                    return score;
                  };

                  const sorted = [...listToUse].sort((a, b) => scoreVoice(b) - scoreVoice(a));

                  const getVoiceLabel = (voice) => {
                    const name = voice.name.toLowerCase();
                    if (name.includes('natural')) return '🌟 ' + voice.name + ' (Natural)';
                    if (name.includes('online')) return '⚡ ' + voice.name + ' (Online)';
                    if (name.includes('google')) return '🤖 ' + voice.name;
                    if (name.includes('neural')) return '🧠 ' + voice.name + ' (Neural)';
                    return voice.name;
                  };

                  return sorted.map(v => (
                    <option className="bg-slate-800 text-slate-100" key={v.voiceURI} value={v.voiceURI}>
                      {getVoiceLabel(v)} ({v.lang})
                    </option>
                  ));
                })()}
              </select>
            </div>

            {/* Speed Rate Slider */}
            <div className="setting-row">
              <label>Speech Speed</label>
              <div className="range-slider-container">
                <Volume2 size={16} className="text-secondary" />
                <input
                  type="range"
                  min="0.6"
                  max="1.3"
                  step="0.1"
                  className="range-slider"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                />
                <span className="range-value">{speed.toFixed(1)}x</span>
              </div>
            </div>

            {/* Friendly Commentary Toggle */}
            <div className="toggle-row">
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Friendly Commentary</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add helpful transition lines</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={includeCommentary}
                  onChange={(e) => setIncludeCommentary(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Calibration Guides Toggle */}
            {photoUrl && (
              <>
                <div className="toggle-row" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Calibration Guidelines</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Align eye & mouth overlays</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={calibrationMode}
                      onChange={(e) => setCalibrationMode(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {calibrationMode && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '1.25rem', padding: '0.5rem 0', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="setting-row">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <label style={{ fontSize: '0.75rem' }}>Eye Alignment Y</label>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{eyeY}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          className="range-slider"
                          value={eyeY}
                          onChange={(e) => setEyeY(parseInt(e.target.value))}
                        />
                      </div>
                      <div className="setting-row">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <label style={{ fontSize: '0.75rem' }}>Mouth Alignment Y</label>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{mouthY}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          className="range-slider"
                          value={mouthY}
                          onChange={(e) => setMouthY(parseInt(e.target.value))}
                        />
                      </div>
                    </div>

                    {/* Miniature Real-time Preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '1rem' }}>
                      <AvatarCanvas
                        photoUrl={photoUrl}
                        isSpeaking={false}
                        isPaused={false}
                        eyeY={eyeY}
                        mouthY={mouthY}
                        gender={gender}
                        calibrationMode={calibrationMode}
                        size={110}
                        hideCalibrationBox={true}
                      />
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontWeight: 700, letterSpacing: '0.1em' }}>PREVIEW</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetPhoto}
                  style={{ width: '100%', gap: '0.5rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                >
                  <Trash2 size={16} /> Delete Bot Photo
                </button>
              </>
            )}

            {!photoUrl && (
              <div className="setting-row" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                <label>Bot Custom Portrait</label>
                <div
                  className={`upload-zone ${photoDragActive ? 'active' : ''}`}
                  onDragEnter={(e) => handleDrag(e, 'photo')}
                  onDragLeave={(e) => handleDrag(e, 'photo')}
                  onDragOver={(e) => handleDrag(e, 'photo')}
                  onDrop={(e) => handleDrop(e, 'photo')}
                  onClick={() => document.getElementById('photo-file-input-sidebar').click()}
                  style={{ padding: '1rem', borderStyle: 'dashed', borderRadius: '8px' }}
                >
                  <input
                    id="photo-file-input-sidebar"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files[0] && handlePhotoFile(e.target.files[0])}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Click or drag photo to customize avatar
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Qualification Validator card */}
          {sections && (
            <div className="card-glass settings-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                <h3 style={{ fontSize: '1.1rem' }}>Qualification Validator</h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Check if the CV matches specific role qualifications. Checked in real-time.
              </p>

              <form onSubmit={handleAddQualification} className="qualification-input-group">
                <input
                  type="text"
                  className="qualification-input"
                  placeholder="e.g. React, Python, 5 years..."
                  value={qualificationInput}
                  onChange={(e) => setQualificationInput(e.target.value)}
                />
                <button type="submit" className="btn-primary" style={{ padding: '0 1rem', height: '38px', borderRadius: '8px' }}>
                  <Plus size={16} /> Add
                </button>
              </form>

              <div className="qualification-list">
                {qualificationResults.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', display: 'block', padding: '1rem 0' }}>
                    No qualifications added yet.
                  </span>
                ) : (
                  qualificationResults.map((q) => (
                    <div key={q.id} className={`qualification-item ${q.met ? 'met' : 'not-met'}`}>
                      <div className="qualification-item-header">
                        <div className="qualification-title-wrapper">
                          {q.met ? (
                            <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                          ) : (
                            <XCircle size={16} style={{ color: 'var(--danger)' }} />
                          )}
                          <span style={{ color: '#fff', fontSize: '0.88rem' }}>{q.text}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-qual"
                          onClick={() => handleRemoveQualification(q.id)}
                          title="Remove qualification"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {q.met && q.snippet && (
                        <span className="qualification-snippet">
                          {q.snippet}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Side: CV Content Upload or CV Section Highlights */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {!sections ? (
            /* No CV selected: Show Upload CV File Box or Alternative Paste */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card-glass" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontWeight: 700 }}>
                  Upload CV Document
                </h2>
                <div
                  className={`upload-zone ${cvDragActive ? 'active' : ''}`}
                  onDragEnter={(e) => handleDrag(e, 'cv')}
                  onDragLeave={(e) => handleDrag(e, 'cv')}
                  onDragOver={(e) => handleDrag(e, 'cv')}
                  onDrop={(e) => handleDrop(e, 'cv')}
                  onClick={() => document.getElementById('cv-file-input').click()}
                  style={{ padding: '2.5rem 2rem' }}
                >
                  <input
                    id="cv-file-input"
                    type="file"
                    accept=".pdf,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files[0] && handleCVFile(e.target.files[0])}
                  />
                  <div className="upload-icon-container">
                    <Upload size={24} />
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>Upload CV File</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports PDF or TXT</span>
                  </div>
                </div>
              </div>

              <div className="card-glass" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Alternative: Paste CV Text</h3>
                <p style={{ fontSize: '0.85rem' }}>
                  If you don't have a PDF, paste the raw text of your resume below. We'll automatically identify language and parse sections.
                </p>
                <textarea
                  className="select-custom"
                  style={{ minHeight: '120px', fontFamily: 'var(--font-sans)', fontSize: '0.9rem', resize: 'vertical' }}
                  placeholder="Paste your CV text here... e.g.&#10;&#10;EXPERIENCE&#10;Software Engineer at Tech Corp (2020 - Present)&#10;Developed beautiful web apps...&#10;&#10;EDUCATION&#10;BS in Computer Science (2016-2020)"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-accent"
                  onClick={() => rawText.trim() && processRawText(rawText)}
                  disabled={!rawText.trim()}
                  style={{ alignSelf: 'flex-end' }}
                >
                  Parse Pasted Text
                </button>
              </div>
            </div>
          ) : (
            /* CV is loaded: Show workspace header, tabs, and corresponding tab view */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* CV info card */}
              <div className="card-glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileText size={20} style={{ color: 'var(--primary)' }} />
                  <div>
                    <h3 style={{ fontSize: '1.1rem', lineHeight: 1 }}>{cvFileName}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Language: {language === 'en' ? 'English' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'ar' ? 'Arabic' : 'Unknown'} | {sections?.length} Sections Found
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {isPlaying && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary)' }}>READING ACTIVE</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={resetCV}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                  >
                    Remove CV
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="workspace-tabs">
                <button
                  className={`tab-button ${activeTab === 'full-cv' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('full-cv');
                    // Stop summary narration if it was playing, to avoid weird highlighting
                    if (isPlaying && currentItem?.sectionId === 'summary-narration') {
                      handleStop();
                    }
                  }}
                >
                  <FileText size={16} /> Full CV Reader
                </button>
                <button
                  className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('summary');
                    // Stop CV narration if it was playing, to avoid weird highlighting
                    if (isPlaying && currentItem?.sectionId !== 'summary-narration') {
                      handleStop();
                    }
                  }}
                >
                  <Sparkles size={16} /> AI Executive Summary
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'full-cv' ? (
                <CVDisplay
                  sections={sections}
                  currentItem={currentItem}
                  revealedSections={revealedSections}
                  onPlaySection={handlePlaySection}
                />
              ) : (
                /* Summary Dashboard */
                <div className="card-glass summary-hero-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                    <div>
                      <h2 className="summary-title">Executive Summary</h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AI-generated candidate overview & highlights</p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handlePlaySummary}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      disabled={isPlaying && currentItem?.sectionId !== 'summary-narration'}
                    >
                      <Volume2 size={16} /> {isPlaying && currentItem?.sectionId === 'summary-narration' ? "Reading..." : "Listen to Summary"}
                    </button>
                  </div>

                  <div className="summary-grid">
                    <div className="summary-metric-card">
                      <span className="summary-metric-value">{sections?.length || 0}</span>
                      <span className="summary-metric-label">Sections</span>
                    </div>
                    <div className="summary-metric-card">
                      <span className="summary-metric-value">
                        {sections?.find(s => s.icon === 'experience')?.paragraphs?.length || 0}
                      </span>
                      <span className="summary-metric-label">Roles Held</span>
                    </div>
                    <div className="summary-metric-card">
                      <span className="summary-metric-value">
                        {sections?.find(s => s.icon === 'skills')?.paragraphs?.flat()?.length || 0}
                      </span>
                      <span className="summary-metric-label">Skills List</span>
                    </div>
                  </div>

                  <p style={{ fontSize: '1.05rem', lineHeight: '1.7', color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
                    {summaryData?.overview}
                  </p>

                  {summaryData?.bullets && summaryData.bullets.length > 0 && (
                    <div>
                      <h4 className="summary-strengths-title">
                        <Sparkles size={16} /> Key Profile Strengths
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {summaryData.bullets.map((bullet, idx) => (
                          <div key={idx} className="summary-strength-item">
                            <span className="summary-strength-bullet" />
                            <span>{bullet}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Footer copyright */}
      <footer className="app-footer">
        <p>© 2026 Interactive CV. Enjoy your stay. Mohamed Ehab</p>
      </footer>
    </div>
  );
}
