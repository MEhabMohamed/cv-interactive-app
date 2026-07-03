import React, { useEffect, useRef } from 'react';
import {
  Briefcase,
  GraduationCap,
  Code,
  Award,
  Globe,
  Mail,
  User,
  FileText,
  Play
} from 'lucide-react';

// Maps section icons to Lucide icons
const iconMap = {
  summary: User,
  experience: Briefcase,
  education: GraduationCap,
  skills: Code,
  projects: FileText, // FileText or FolderGit
  certifications: Award,
  languages: Globe,
  contact: Mail,
  default: FileText
};

export default function CVDisplay({
  sections,
  currentItem,
  revealedSections,
  onPlaySection
}) {
  const containerRef = useRef(null);

  // Scroll active section into view when currentItem changes
  useEffect(() => {
    if (currentItem && currentItem.type === 'cv-sentence') {
      const element = document.getElementById(currentItem.sectionId);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }, [currentItem]);

  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <div className="cv-viewer-panel" ref={containerRef}>
      {sections.map((section) => {
        const IconComponent = iconMap[section.icon] || iconMap.default;
        
        // A section is active if it is currently being read
        const isActive = currentItem && currentItem.sectionId === section.id;
        
        // A section is revealed if it is in the revealed set, or is active
        const isRevealed = revealedSections.has(section.id) || isActive;

        return (
          <div
            key={section.id}
            id={section.id}
            className={`card-glass cv-section-card ${isRevealed ? 'revealed' : ''} ${isActive ? 'active' : ''}`}
          >
            <div className="cv-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="cv-section-header-icon">
                  <IconComponent size={22} />
                </span>
                <h3>{section.title}</h3>
              </div>
              <button
                type="button"
                className="btn-play-section"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onPlaySection) onPlaySection(section.id);
                }}
                title="Narrate this section"
              >
                <Play size={12} fill="currentColor" />
              </button>
            </div>
            
            <div className="cv-section-body">
              {section.paragraphs.map((para, pIdx) => (
                <p key={pIdx} className="sentence-paragraph">
                  {para.map((sentence, sIdx) => {
                    const isSentenceActive =
                      isActive &&
                      currentItem.type === 'cv-sentence' &&
                      currentItem.paragraphIndex === pIdx &&
                      currentItem.sentenceIndex === sIdx;

                    return (
                      <span
                        key={sIdx}
                        className={`sentence ${isSentenceActive ? 'active-sentence' : ''}`}
                      >
                        {sentence}{' '}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
