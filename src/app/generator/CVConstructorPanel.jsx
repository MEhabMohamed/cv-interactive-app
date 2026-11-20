import React, { useState } from 'react';
import { Sparkles, ArrowLeft, Plus, Trash2, Printer, FileText, XCircle, Loader2, Briefcase, Code2, GraduationCap, UserCheck } from 'lucide-react';
import { buildPlainTextCv, buildPrintableHtmlCv } from './cvConstructor';
import { generateCvViaApi } from './cvGenerator.service';

const INITIAL_PROFILE = {
  fullName: '',
  headline: '',
  location: '',
  email: '',
  phone: '',
  github: '',
  linkedin: '',
  portfolio: '',
  summary: '',
  skillGroups: [
    { category: 'Languages & Frameworks', items: '' },
    { category: 'Databases, Cloud & Tools', items: '' },
  ],
  experiences: [
    { title: '', company: '', dates: '', location: '', bullets: '' },
  ],
  projects: [
    { name: '', techStack: '', bullets: '' },
  ],
  education: [
    { degree: '', institution: '', year: '' },
  ],
  certifications: '',
  languages: 'Arabic (Native), English (Fluent)',
  targetJobDescription: '',
  pageLength: '1-2 pages',
};

export default function CVConstructorPanel({ hasExistingCv, onBack, onCvConstructed }) {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const updateField = (key, value) => setProfile((prev) => ({ ...prev, [key]: value }));

  const updateListItem = (listKey, index, field, value) => {
    setProfile((prev) => {
      const next = [...prev[listKey]];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [listKey]: next };
    });
  };

  const addListItem = (listKey, template) => {
    setProfile((prev) => ({ ...prev, [listKey]: [...prev[listKey], { ...template }] }));
  };

  const removeListItem = (listKey, index) => {
    setProfile((prev) => ({
      ...prev,
      [listKey]: prev[listKey].length > 1 ? prev[listKey].filter((_, i) => i !== index) : prev[listKey],
    }));
  };

  const handleBuildInstant = () => {
    setError('');
    if (!profile.fullName.trim() || !profile.headline.trim()) {
      setError('Full Name and Target Headline / Role are required.');
      return;
    }
    const plainText = buildPlainTextCv(profile);
    onCvConstructed(plainText, `${profile.fullName.trim().replace(/\s+/g, '_')}_ATS_CV.txt`);
  };

  const handleOpenPrintPreview = () => {
    setError('');
    if (!profile.fullName.trim()) {
      setError('Enter your Full Name before previewing the printable ATS CV.');
      return;
    }
    const html = buildPrintableHtmlCv(profile);
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      setError('Popup blocked. Allow popups to open the Ready-to-Print HTML CV.');
    }
  };

  const handleAiTailor = async (e) => {
    e.preventDefault();
    setError('');
    if (!profile.fullName.trim() || !profile.headline.trim()) {
      setError('Full Name and Target Headline / Role are required.');
      return;
    }
    setIsGenerating(true);
    try {
      const cvText = await generateCvViaApi({
        name: profile.fullName,
        role: profile.headline,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedin: profile.linkedin,
        github: profile.github,
        portfolio: profile.portfolio,
        summary: profile.summary,
        skills: profile.skillGroups.map((g) => (g.category ? `${g.category}: ${g.items}` : g.items)).filter(Boolean).join(' | '),
        experience: profile.experiences.map((ex) => `${ex.title} - ${ex.company} (${ex.dates}, ${ex.location})\n${ex.bullets}`).join('\n\n'),
        projects: profile.projects.map((p) => `${p.name} [${p.techStack}]\n${p.bullets}`).join('\n\n'),
        education: profile.education.map((ed) => `${ed.degree} - ${ed.institution} (${ed.year})`).join('\n'),
        certifications: profile.certifications,
        languages: profile.languages,
        enhance: profile.targetJobDescription
          ? `Tailor truth-first to this Job Description (${profile.pageLength}):\n${profile.targetJobDescription}`
          : `Format cleanly as a ${profile.pageLength} ATS CV with zero invented facts.`,
      });
      onCvConstructed(cvText, `${profile.fullName.trim().replace(/\s+/g, '_')}_AI_CV.txt`);
    } catch (err) {
      setError(err.message || 'AI tailoring failed. You can still use "Build ATS CV" offline.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="card-glass" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <form onSubmit={handleAiTailor} className="generator-form">
        <div className="generator-header">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--secondary)' }} />
            Structured ATS CV Constructor
          </h3>
          {!hasExistingCv && (
            <button type="button" className="btn-secondary" onClick={onBack} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Truth-first master profile constructor (Header &rarr; Summary &rarr; Categorized Skills &rarr; Experience &rarr; Projects &rarr; Education &amp; Certs &rarr; Languages). Build an instant ATS CV, open a print-ready HTML/PDF preview, or tailor to a Job Description with AI.
        </p>

        {error && (
          <div className="card-glass" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <XCircle size={18} />
            <span style={{ fontSize: '0.88rem' }}>{error}</span>
          </div>
        )}

        {/* 1. Identity & Contact */}
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
          <UserCheck size={16} /> 1. Identity &amp; Contact
        </h4>
        <div className="generator-grid">
          <div className="setting-row">
            <label>Full Name *</label>
            <input type="text" required className="generator-input" placeholder="e.g. Mohamed Ehab" value={profile.fullName} onChange={(e) => updateField('fullName', e.target.value)} />
          </div>
          <div className="setting-row">
            <label>Headline / Target Role *</label>
            <input type="text" required className="generator-input" placeholder="e.g. Full-Stack Software Engineer | Backend & AI" value={profile.headline} onChange={(e) => updateField('headline', e.target.value)} />
          </div>
          <div className="setting-row">
            <label>Location</label>
            <input type="text" className="generator-input" placeholder="e.g. Alexandria, Egypt" value={profile.location} onChange={(e) => updateField('location', e.target.value)} />
          </div>
          <div className="setting-row">
            <label>Email</label>
            <input type="email" className="generator-input" placeholder="you@example.com" value={profile.email} onChange={(e) => updateField('email', e.target.value)} />
          </div>
          <div className="setting-row">
            <label>Phone</label>
            <input type="text" className="generator-input" placeholder="+20..." value={profile.phone} onChange={(e) => updateField('phone', e.target.value)} />
          </div>
          <div className="setting-row">
            <label>GitHub URL</label>
            <input type="url" className="generator-input" placeholder="https://github.com/..." value={profile.github} onChange={(e) => updateField('github', e.target.value)} />
          </div>
          <div className="setting-row">
            <label>LinkedIn URL</label>
            <input type="url" className="generator-input" placeholder="https://linkedin.com/in/..." value={profile.linkedin} onChange={(e) => updateField('linkedin', e.target.value)} />
          </div>
          <div className="setting-row">
            <label>Portfolio URL</label>
            <input type="url" className="generator-input" placeholder="https://..." value={profile.portfolio} onChange={(e) => updateField('portfolio', e.target.value)} />
          </div>
        </div>

        {/* 2. Professional Summary */}
        <div className="setting-row">
          <label>2. Professional Summary (Truth-First Positioning)</label>
          <textarea className="generator-input generator-textarea" rows={3} placeholder="2-3 concise sentences highlighting verified domain expertise, architecture/engineering impact, and target direction." value={profile.summary} onChange={(e) => updateField('summary', e.target.value)} />
        </div>

        {/* 3. Categorized Technical Skills */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Code2 size={16} /> 3. Categorized Skills (ATS Inventory)
          </h4>
          <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }} onClick={() => addListItem('skillGroups', { category: '', items: '' })}>
            <Plus size={14} /> Add Category
          </button>
        </div>
        {profile.skillGroups.map((grp, idx) => (
          <div key={idx} className="generator-grid" style={{ alignItems: 'end' }}>
            <div className="setting-row">
              <label>Category</label>
              <input type="text" className="generator-input" placeholder="e.g. Backend & Architecture" value={grp.category} onChange={(e) => updateListItem('skillGroups', idx, 'category', e.target.value)} />
            </div>
            <div className="setting-row" style={{ display: 'flex', gap: '0.4rem' }}>
              <div style={{ flex: 1 }}>
                <label>Skills (comma-separated)</label>
                <input type="text" className="generator-input" placeholder="Node.js, Express, PostgreSQL, Knex, Redis" value={grp.items} onChange={(e) => updateListItem('skillGroups', idx, 'items', e.target.value)} />
              </div>
              {profile.skillGroups.length > 1 && (
                <button type="button" className="btn-secondary" style={{ padding: '0.5rem' }} onClick={() => removeListItem('skillGroups', idx)} title="Remove">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* 4. Work Experience */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Briefcase size={16} /> 4. Work Experience
          </h4>
          <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }} onClick={() => addListItem('experiences', { title: '', company: '', dates: '', location: '', bullets: '' })}>
            <Plus size={14} /> Add Role
          </button>
        </div>
        {profile.experiences.map((exp, idx) => (
          <div key={idx} className="card-glass" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="generator-grid">
              <input type="text" className="generator-input" placeholder="Job Title" value={exp.title} onChange={(e) => updateListItem('experiences', idx, 'title', e.target.value)} />
              <input type="text" className="generator-input" placeholder="Employer / Organization" value={exp.company} onChange={(e) => updateListItem('experiences', idx, 'company', e.target.value)} />
              <input type="text" className="generator-input" placeholder="Dates (e.g. 01/2021 - Present)" value={exp.dates} onChange={(e) => updateListItem('experiences', idx, 'dates', e.target.value)} />
              <input type="text" className="generator-input" placeholder="Location" value={exp.location} onChange={(e) => updateListItem('experiences', idx, 'location', e.target.value)} />
            </div>
            <textarea className="generator-input generator-textarea" rows={3} placeholder="Key achievements & responsibilities (one bullet per line)..." value={exp.bullets} onChange={(e) => updateListItem('experiences', idx, 'bullets', e.target.value)} />
            {profile.experiences.length > 1 && (
              <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-end', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => removeListItem('experiences', idx)}>
                <Trash2 size={13} /> Remove Role
              </button>
            )}
          </div>
        ))}

        {/* 5. Key Projects */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>5. Key Projects</h4>
          <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }} onClick={() => addListItem('projects', { name: '', techStack: '', bullets: '' })}>
            <Plus size={14} /> Add Project
          </button>
        </div>
        {profile.projects.map((proj, idx) => (
          <div key={idx} className="card-glass" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="generator-grid">
              <input type="text" className="generator-input" placeholder="Project Name" value={proj.name} onChange={(e) => updateListItem('projects', idx, 'name', e.target.value)} />
              <input type="text" className="generator-input" placeholder="Tech Stack (e.g. TypeScript, Express, PostgreSQL)" value={proj.techStack} onChange={(e) => updateListItem('projects', idx, 'techStack', e.target.value)} />
            </div>
            <textarea className="generator-input generator-textarea" rows={2} placeholder="What you architected and delivered (one bullet per line)..." value={proj.bullets} onChange={(e) => updateListItem('projects', idx, 'bullets', e.target.value)} />
            {profile.projects.length > 1 && (
              <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-end', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => removeListItem('projects', idx)}>
                <Trash2 size={13} /> Remove Project
              </button>
            )}
          </div>
        ))}

        {/* 6. Education, Certifications & Languages */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <GraduationCap size={16} /> 6. Education, Certifications &amp; Languages
          </h4>
          <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }} onClick={() => addListItem('education', { degree: '', institution: '', year: '' })}>
            <Plus size={14} /> Add Degree
          </button>
        </div>
        {profile.education.map((ed, idx) => (
          <div key={idx} className="generator-grid">
            <input type="text" className="generator-input" placeholder="Degree (e.g. B.Sc. in Production Engineering)" value={ed.degree} onChange={(e) => updateListItem('education', idx, 'degree', e.target.value)} />
            <input type="text" className="generator-input" placeholder="Institution" value={ed.institution} onChange={(e) => updateListItem('education', idx, 'institution', e.target.value)} />
            <input type="text" className="generator-input" placeholder="Year (e.g. 2014)" value={ed.year} onChange={(e) => updateListItem('education', idx, 'year', e.target.value)} />
          </div>
        ))}

        <div className="generator-grid">
          <div className="setting-row">
            <label>Certifications (one per line)</label>
            <textarea className="generator-input generator-textarea" rows={2} placeholder="Lean Six Sigma Green Belt&#10;Backend Engineering Mastery" value={profile.certifications} onChange={(e) => updateField('certifications', e.target.value)} />
          </div>
          <div className="setting-row">
            <label>Languages</label>
            <input type="text" className="generator-input" placeholder="Arabic (Native), English (Fluent)" value={profile.languages} onChange={(e) => updateField('languages', e.target.value)} />
          </div>
        </div>

        {/* 7. Optional JD Tailoring */}
        <div className="setting-row">
          <label>7. Optional Target Job Description (for AI JD Mirroring — Truth-First)</label>
          <textarea className="generator-input generator-textarea" rows={2} placeholder="Paste a target Job Description to mirror keywords honestly using AI, or leave blank for a clean general ATS CV." value={profile.targetJobDescription} onChange={(e) => updateField('targetJobDescription', e.target.value)} />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn-primary" onClick={handleBuildInstant} style={{ flex: 1, minWidth: '180px', justifyContent: 'center' }}>
            <FileText size={16} /> Build ATS CV Instantly
          </button>
          <button type="button" className="btn-secondary" onClick={handleOpenPrintPreview} style={{ flex: 1, minWidth: '180px', justifyContent: 'center' }}>
            <Printer size={16} /> Print / Save PDF Preview
          </button>
          <button type="submit" className="btn-secondary" disabled={isGenerating} style={{ flex: 1, minWidth: '180px', justifyContent: 'center' }}>
            {isGenerating ? <><Loader2 size={16} className="spin" /> Tailoring with AI...</> : <><Sparkles size={16} /> AI Tailor &amp; Polish</>}
          </button>
        </div>
      </form>
    </div>
  );
}

