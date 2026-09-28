import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDFJS worker locally via standard Vite / browser URL, with fallback
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    console.warn("Could not set local workerSrc, using unpkg fallback", e);
    const version = pdfjsLib.version || '6.1.200';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }
}

/**
 * Detect language based on frequencies of common stop words
 * @param {string} text 
 * @returns {string} Language code ('en', 'es', 'fr', 'de', 'ar')
 */
export function detectLanguage(text) {
  if (!text) return 'en';

  // 1. Check for Arabic characters directly by Unicode range
  const arabicMatches = text.match(/[\u0600-\u06FF]/g);
  if (arabicMatches && arabicMatches.length > 15) {
    return 'ar';
  }

  const cleanText = text.toLowerCase();
  
  const stopWords = {
    en: /\b(the|and|of|to|in|for|is|with|on|at|by|an|from|as|about|experience|education|skills)\b/g,
    es: /\b(el|la|los|las|de|y|en|un|una|con|es|para|por|del|al|experiencia|educación|habilidades)\b/g,
    fr: /\b(le|la|les|de|et|en|un|une|avec|est|pour|dans|par|des|du|expérience|formation|compétences)\b/g,
    de: /\b(der|die|das|und|in|zu|von|mit|ist|für|auf|ein|eine|ausbildung|erfahrung|kenntnisse)\b/g
  };

  let maxCount = 0;
  let detectedLang = 'en'; // default

  for (const [lang, regex] of Object.entries(stopWords)) {
    const matches = cleanText.match(regex);
    const count = matches ? matches.length : 0;
    if (count > maxCount) {
      maxCount = count;
      detectedLang = lang;
    }
  }

  return detectedLang;
}

/**
 * Split a paragraph into clean sentences, supporting Latin and Arabic punctuation
 * @param {string} paragraphText 
 * @returns {string[]}
 */
function splitIntoSentences(paragraphText) {
  if (!paragraphText) return [];
  const trimmed = paragraphText.trim();
  if (!trimmed) return [];
  
  // Split on sentence-ending punctuation (., !, ?, Arabic question mark ؟) followed by whitespace
  const sentences = trimmed
    .split(/(?<=[.!?؟])\s+(?=[\p{Lu}\p{Lt}\p{N}\u0600-\u06FF]|\b)/gu)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences.length > 0 ? sentences : [trimmed];
}

/**
 * Clean a line to check if it looks like a section header
 * @param {string} line 
 * @returns {string}
 */
function cleanHeaderCandidate(line) {
  return line
    .replace(/^[\s#*_\-•●■◆\d.)]+/, '') // strip leading markdown (#), bullets, numbers
    .replace(/[\s#*_\-•:/|~]+$/, '')   // strip trailing colons, markdown, pipes
    .trim();
}

/**
 * Parse raw text into structured CV sections based on language
 * @param {string} text 
 * @param {string} lang 
 */
export function parseCVText(text, lang = 'en') {
  if (!text || !text.trim()) {
    return [];
  }

  const rawLines = text.split(/\r?\n/).map(line => line.trim());
  
  // Section keywords per language with flexible matching
  const keywords = {
    en: {
      summary: /^(summary|about\s*me|professional\s*summary|profile|career\s*profile|objective|career\s*objective|executive\s*summary|overview|bio|biography|about)$/i,
      experience: /^(experience|work\s*experience|employment\s*history|employment|professional\s*experience|work\s*history|job\s*history|career\s*history|relevant\s*experience|experience\s*&\s*projects|professional\s*background)$/i,
      education: /^(education|academic\s*background|academic\s*history|studies|qualifications|academic\s*qualifications|degrees|education\s*&\s*training|education\s*&\s*certifications|university)$/i,
      skills: /^(skills|technical\s*skills|key\s*skills|core\s*competencies|competencies|technologies|expertise|areas\s*of\s*expertise|tools\s*&\s*technologies|technical\s*proficiencies|skills\s*&\s*abilities|proficiencies)$/i,
      projects: /^(projects|personal\s*projects|key\s*projects|selected\s*projects|portfolio|featured\s*projects|academic\s*projects|notable\s*projects)$/i,
      certifications: /^(certifications|licenses|courses|awards|accomplishments|achievements|certifications\s*&\s*licenses|credentials|honors\s*&\s*awards|training)$/i,
      contact: /^(contact|contact\s*details|contact\s*information|contact\s*info|personal\s*info|personal\s*information|get\s*in\s*touch)$/i,
      languages: /^(languages|language\s*skills|languages\s*spoken|language\s*proficiency)$/i
    },
    es: {
      summary: /^(resumen|sobre\s*mí|resumen\s*profesional|perfil|objetivo|perfil\s*profesional|perfil\s*laboral|acerca\s*de\s*mí)$/i,
      experience: /^(experiencia|experiencia\s*laboral|trayectoria\s*profesional|historial\s*laboral|experiencia\s*profesional|empleo|historial\s*de\s*empleo)$/i,
      education: /^(educación|formación\s*académica|estudios|formación|titulaciones|títulos|universidad)$/i,
      skills: /^(habilidades|competencias|aptitudes|tecnologías|conocimientos|habilidades\s*técnicas|herramientas)$/i,
      projects: /^(proyectos|proyectos\s*personales|proyectos\s*destacados|portafolio)$/i,
      certifications: /^(certificaciones|licencias|cursos|premios|logros|diplomas|certificados)$/i,
      contact: /^(contacto|datos\s*de\s*contacto|información\s*personal|datos\s*personales)$/i,
      languages: /^(idiomas|competencia\s*lingüística)$/i
    },
    fr: {
      summary: /^(résumé|à\s*propos|profil|objectif|résumé\s*professionnel|profil\s*professionnel|biographie)$/i,
      experience: /^(expérience|expérience\s*professionnelle|parcours\s*professionnel|expériences|historique\s*professionnel)$/i,
      education: /^(éducation|formation|études|diplômes|cursus\s*académique|parcours\s*académique)$/i,
      skills: /^(compétences|expertises|technologies|savoir-faire|compétences\s*techniques|outils)$/i,
      projects: /^(projets|projets\s*personnels|réalisations|projets\s*notables)$/i,
      certifications: /^(certifications|licences|formations|prix|distinctions|attestations)$/i,
      contact: /^(contact|coordonnées|informations\s*personnelles|contactez-moi)$/i,
      languages: /^(langues|langues\s*parlées)$/i
    },
    de: {
      summary: /^(zusammenfassung|über\s*mich|profil|berufliches\s*profil|kurzprofil|überblick)$/i,
      experience: /^(berufserfahrung|werdegang|beruflicher\s*werdegang|praxiserfahrung|berufliche\s*laufbahn)$/i,
      education: /^(ausbildung|bildungsweg|schulausbildung|studium|akademischer\s*werdegang)$/i,
      skills: /^(kenntnisse|fähigkeiten|it-kenntnisse|kompetenzen|fachkenntnisse|technologien)$/i,
      projects: /^(projekte|projekterfahrung|ausgewählte\s*projekte|portfolio)$/i,
      certifications: /^(zertifikate|zertifizierungen|kurse|auszeichnungen|weiterbildung)$/i,
      contact: /^(kontakt|kontaktdaten|persönliche\s*angaben)$/i,
      languages: /^(sprachen|sprachkenntnisse)$/i
    },
    ar: {
      summary: /^(الملخص\s*المهني|نبذة\s*عني|الملخص|عني|الهدف\s*المهني|الهدف|الملف\s*الشخصي|نبذة\s*موجزة)$/i,
      experience: /^(الخبرة|الخبرة\s*العملية|تاريخ\s*التوظيف|التوظيف|الخبرات\s*المهنية|الخبرات|المسار\s*المهني|الخبرة\s*والأعمال)$/i,
      education: /^(التعليم|الخلفية\s*الأكاديمية|الدراسة|المؤهلات|الشهادات\s*الأكاديمية|التعليم\s*والتدريب|المؤهلات\s*العلمية)$/i,
      skills: /^(المهارات|المهارات\s*التقنية|المهارات\s*الأساسية|الخبرات\s*التقنية|التخصصات|الكفاءات|الأدوات\s*والتقنيات)$/i,
      projects: /^(المشاريع|المشاريع\s*الشخصية|أبرز\s*المشاريع|معرض\s*الأعمال|المشاريع\s*المنجزة)$/i,
      certifications: /^(الشهادات|الشهادات\s*المهنية|الدورات\s*التدريبية|الجوائز|الإنجازات|التدريب\s*والشهادات)$/i,
      contact: /^(الاتصال|بيانات\s*الاتصال|معلومات\s*الاتصال|المعلومات\s*الشخصية|التواصل)$/i,
      languages: /^(اللغات|مهارات\s*اللغة|اللغات\s*المتقنة)$/i
    }
  };

  const currentKeywords = keywords[lang] || keywords.en;
  
  // Also check English keywords as secondary fallback if language was detected as non-English
  const fallbackKeywords = keywords.en;

  const parsedSections = [];
  let currentSection = {
    id: 'intro',
    title: lang === 'es' ? 'Introducción' : lang === 'fr' ? 'Introduction' : lang === 'de' ? 'Einleitung' : lang === 'ar' ? 'المقدمة' : 'Introduction',
    icon: 'summary',
    paragraphs: [],
    rawLines: []
  };

  // Process line by line
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    
    // Check if line looks like a header
    let isHeader = false;
    let matchedType = null;
    const cleaned = cleanHeaderCandidate(line);

    if (cleaned.length > 0 && cleaned.length < 50) {
      // 1. Check primary language keywords
      for (const [type, regex] of Object.entries(currentKeywords)) {
        if (regex.test(cleaned)) {
          isHeader = true;
          matchedType = type;
          break;
        }
      }

      // 2. Check English keywords as fallback
      if (!isHeader && currentKeywords !== fallbackKeywords) {
        for (const [type, regex] of Object.entries(fallbackKeywords)) {
          if (regex.test(cleaned)) {
            isHeader = true;
            matchedType = type;
            break;
          }
        }
      }
    }

    if (isHeader) {
      // Save prior section if it contains data
      if (currentSection.rawLines.length > 0) {
        currentSection.paragraphs = groupLinesIntoParagraphs(currentSection.rawLines);
        if (currentSection.paragraphs.length > 0) {
          parsedSections.push(currentSection);
        }
      }

      currentSection = {
        id: `section-${matchedType}-${parsedSections.length}`,
        title: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
        icon: matchedType,
        paragraphs: [],
        rawLines: []
      };
    } else {
      currentSection.rawLines.push(line);
    }
  }

  // Push the final section
  if (currentSection.rawLines.length > 0) {
    currentSection.paragraphs = groupLinesIntoParagraphs(currentSection.rawLines);
    if (currentSection.paragraphs.length > 0) {
      parsedSections.push(currentSection);
    }
  }

  // Auto-detect contact / personal header if intro section contains emails, phones, or URLs
  if (parsedSections.length > 0 && parsedSections[0].id === 'intro') {
    const introLines = parsedSections[0].rawLines.filter(Boolean);
    const hasContactSignal = introLines.some(l => 
      /\S+@\S+\.\S+/.test(l) || 
      /[+]?[(]?[0-9]{2,4}[)]?[-\s./0-9]{5,15}/.test(l) || 
      /linkedin\.com|github\.com|portfolio/i.test(l)
    );

    if (hasContactSignal) {
      parsedSections[0].icon = 'contact';
      parsedSections[0].title = lang === 'es' ? 'Contacto' : lang === 'fr' ? 'Coordonnées' : lang === 'de' ? 'Kontakt' : lang === 'ar' ? 'معلومات الاتصال' : 'Contact Information';
    }
  }

  // Fallback: If only 1 section ('intro') was parsed or no headers were found
  if (parsedSections.length <= 1) {
    // Attempt double-newline splitting to discover sections
    const blocks = text.split(/\r?\n\s*\r?\n+/).map(b => b.trim()).filter(Boolean);
    
    if (blocks.length > 1) {
      const generatedSections = [];
      
      blocks.forEach((block, idx) => {
        const blockLines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (blockLines.length === 0) return;

        let titleCandidate = cleanHeaderCandidate(blockLines[0]);
        let iconCandidate = 'summary';
        let contentLines = blockLines;

        // Check if the first line is a title
        if (titleCandidate.length < 50) {
          for (const [type, regex] of Object.entries({ ...fallbackKeywords, ...currentKeywords })) {
            if (regex.test(titleCandidate)) {
              iconCandidate = type;
              contentLines = blockLines.slice(1);
              break;
            }
          }
        }

        // Check if content itself suggests an icon
        if (iconCandidate === 'summary') {
          const lowerBlock = block.toLowerCase();
          if (lowerBlock.includes('experience') || lowerBlock.includes('employed') || lowerBlock.includes('developer') || lowerBlock.includes('manager') || lowerBlock.includes('engineer')) {
            iconCandidate = idx === 0 ? 'summary' : 'experience';
          } else if (lowerBlock.includes('education') || lowerBlock.includes('university') || lowerBlock.includes('degree') || lowerBlock.includes('bachelor') || lowerBlock.includes('master')) {
            iconCandidate = 'education';
          } else if (lowerBlock.includes('skills') || lowerBlock.includes('javascript') || lowerBlock.includes('python') || lowerBlock.includes('tools')) {
            iconCandidate = 'skills';
          }
        }

        const paragraphs = groupLinesIntoParagraphs(contentLines.length > 0 ? contentLines : blockLines);
        if (paragraphs.length > 0) {
          generatedSections.push({
            id: `block-${idx}`,
            title: titleCandidate.length < 50 ? titleCandidate : `Section ${idx + 1}`,
            icon: iconCandidate,
            paragraphs,
            rawLines: blockLines
          });
        }
      });

      if (generatedSections.length > 0) {
        return generatedSections;
      }
    }
  }

  // Safety guarantee: If still no sections, wrap the entire text as a single readable Overview section
  if (parsedSections.length === 0 || (parsedSections.length === 1 && parsedSections[0].paragraphs.length === 0)) {
    const nonEmptyLines = rawLines.filter(Boolean);
    const paragraphs = groupLinesIntoParagraphs(nonEmptyLines);
    return [{
      id: 'main-overview',
      title: lang === 'es' ? 'Perfil del Candidato' : lang === 'fr' ? 'Profil du Candidat' : lang === 'de' ? 'Kandidatenprofil' : lang === 'ar' ? 'الملف التعريفي' : 'Candidate Overview',
      icon: 'summary',
      paragraphs: paragraphs.length > 0 ? paragraphs : [[text.trim()]],
      rawLines: nonEmptyLines
    }];
  }

  return parsedSections.filter(sec => sec.paragraphs.length > 0);
}

/**
 * Group raw text lines into paragraphs and sentences
 * @param {string[]} lines 
 * @returns {string[][]} Array of paragraphs, each containing an array of sentences
 */
function groupLinesIntoParagraphs(lines) {
  const paragraphs = [];
  let currentParagraphLines = [];

  for (const line of lines) {
    if (!line || line.trim().length === 0) {
      if (currentParagraphLines.length > 0) {
        const sentences = splitIntoSentences(currentParagraphLines.join(' '));
        if (sentences.length > 0) paragraphs.push(sentences);
        currentParagraphLines = [];
      }
      continue;
    }

    const trimmed = line.trim();
    // If the line looks like a bullet point or has a list indicator, flush previous and start new paragraph
    const isBullet = /^[•\-*+●■◆]\s|^\d+[.)]\s/.test(trimmed);
    
    if (isBullet && currentParagraphLines.length > 0) {
      const sentences = splitIntoSentences(currentParagraphLines.join(' '));
      if (sentences.length > 0) paragraphs.push(sentences);
      currentParagraphLines = [trimmed];
    } else {
      currentParagraphLines.push(trimmed);
    }
  }

  if (currentParagraphLines.length > 0) {
    const sentences = splitIntoSentences(currentParagraphLines.join(' '));
    if (sentences.length > 0) paragraphs.push(sentences);
  }

  return paragraphs;
}

/**
 * Extract text from PDF file with robust error handling, font support, and marked content skipping
 * @param {File} file 
 * @returns {Promise<string>}
 */
export async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);

    const version = pdfjsLib.version || '6.1.200';
    const loadingTask = pdfjsLib.getDocument({
      data: typedArray,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`,
    });

    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY = null;
      let pageText = '';
      
      for (const item of textContent.items) {
        // Skip marked content or items without string content
        if (!item || typeof item.str !== 'string') continue;

        // Safe transform check to avoid undefined reading '5'
        if (item.transform && Array.isArray(item.transform) && item.transform.length >= 6) {
          const currentY = item.transform[5];
          if (lastY !== null && Math.abs(currentY - lastY) > 5) {
            pageText += '\n';
          }
          lastY = currentY;
        } else if (item.hasEOL) {
          pageText += '\n';
        }
        
        pageText += item.str + (item.hasEOL ? '\n' : ' ');
      }
      
      fullText += pageText.trim() + '\n\n';
    }

    const trimmed = fullText.trim();
    if (!trimmed) {
      throw new Error("The PDF does not contain selectable text (it may be a scanned image). Please upload a text PDF or paste the CV text.");
    }
    
    return trimmed;
  } catch (error) {
    console.error("Error extracting text from PDF: ", error);
    throw new Error(error.message || "Could not parse PDF. Make sure it is not password protected or corrupted.");
  }
}

/**
 * Extract text from Word (.docx) document
 * @param {File} file 
 * @returns {Promise<string>}
 */
export async function extractTextFromDocx(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const trimmed = (result.value || '').trim();
    if (!trimmed) {
      throw new Error("The Word document is empty or could not be read.");
    }
    return trimmed;
  } catch (error) {
    console.error("Error extracting text from Word (.docx): ", error);
    throw new Error(error.message || "Failed to read Word document (.docx).");
  }
}

/**
 * Generate a smart executive summary of the CV based on parsed sections
 * @param {Array} sections Parsed CV sections
 * @param {string} lang Language code ('en', 'es', 'fr', 'de', 'ar')
 * @returns {Object} Executive summary object containing overview and key bullet points
 */
export function generateCVSummary(sections, lang = 'en') {
  if (!sections || sections.length === 0) return null;

  // Find specific sections
  const summarySec = sections.find(s => s.icon === 'summary');
  const experienceSec = sections.find(s => s.icon === 'experience');
  const educationSec = sections.find(s => s.icon === 'education');
  const skillsSec = sections.find(s => s.icon === 'skills');
  const projectsSec = sections.find(s => s.icon === 'projects');
  const languagesSec = sections.find(s => s.icon === 'languages');

  // Heuristic extraction
  let expCount = 0;
  let keyRoles = [];
  if (experienceSec) {
    // Count paragraph blocks in experience as individual roles
    expCount = experienceSec.paragraphs.length;
    // Extract first sentence of the first two roles
    experienceSec.paragraphs.slice(0, 2).forEach(para => {
      if (para[0]) {
        // Strip out bullet symbols if any
        const cleaned = para[0].replace(/^[•\-*+●■◆]\s|^\d+[.)]\s/, '').trim();
        keyRoles.push(cleaned);
      }
    });
  }

  let topSkills = [];
  if (skillsSec) {
    const allSkills = skillsSec.paragraphs.flat();
    topSkills = allSkills.slice(0, 8).map(s => s.replace(/^[•\-*+●■◆]\s|^\d+[.)]\s/, '').trim());
  }

  let eduText = "";
  if (educationSec && educationSec.paragraphs[0] && educationSec.paragraphs[0][0]) {
    eduText = educationSec.paragraphs[0][0].replace(/^[•\-*+●■◆]\s|^\d+[.)]\s/, '').trim();
  }

  let languagesList = [];
  if (languagesSec) {
    languagesList = languagesSec.paragraphs.flat().slice(0, 4).map(l => l.replace(/^[•\-*+●■◆]\s|^\d+[.)]\s/, '').trim());
  }

  let overview = "";
  let bullets = [];

  // Generate localized summary texts
  if (lang === 'es') {
    overview = `Aquí está el resumen ejecutivo del perfil. Se trata de un profesional con conocimientos destacados${skillsSec && topSkills.length > 0 ? ` en áreas como ${topSkills.slice(0, 4).join(', ')}` : ''}.`;
    if (expCount > 0) {
      overview += ` Cuenta con una trayectoria de aproximadamente ${expCount} puesto${expCount > 1 ? 's' : ''} de trabajo.`;
    }
    if (eduText) {
      overview += ` Su formación académica principal es: ${eduText}.`;
    }

    if (summarySec && summarySec.paragraphs[0] && summarySec.paragraphs[0][0]) {
      bullets.push(`Descripción general: ${summarySec.paragraphs[0][0]}`);
    }
    if (keyRoles.length > 0) {
      bullets.push(`Experiencia clave: ${keyRoles.join('; y ')}`);
    }
    if (topSkills.length > 0) {
      bullets.push(`Habilidades técnicas principales: ${topSkills.slice(0, 6).join(', ')}`);
    }
    if (languagesList.length > 0) {
      bullets.push(`Idiomas: ${languagesList.join(', ')}`);
    }
  } else if (lang === 'fr') {
    overview = `Voici le résumé exécutif du profil. Il s'agit d'un professionnel spécialisé${skillsSec && topSkills.length > 0 ? ` dans des domaines tels que ${topSkills.slice(0, 4).join(', ')}` : ''}.`;
    if (expCount > 0) {
      overview += ` Il présente un parcours avec ${expCount} rôle${expCount > 1 ? 's' : ''} professionnel${expCount > 1 ? 's' : ''}.`;
    }
    if (eduText) {
      overview += ` Son profil académique inclut: ${eduText}.`;
    }

    if (summarySec && summarySec.paragraphs[0] && summarySec.paragraphs[0][0]) {
      bullets.push(`Profil professionnel: ${summarySec.paragraphs[0][0]}`);
    }
    if (keyRoles.length > 0) {
      bullets.push(`Postes clés: ${keyRoles.join('; et ')}`);
    }
    if (topSkills.length > 0) {
      bullets.push(`Compétences clés: ${topSkills.slice(0, 6).join(', ')}`);
    }
    if (languagesList.length > 0) {
      bullets.push(`Langues: ${languagesList.join(', ')}`);
    }
  } else if (lang === 'de') {
    overview = `Hier ist die Zusammenfassung des Profils. Ein Experte mit fundierten Kenntnissen${skillsSec && topSkills.length > 0 ? ` in den Bereichen ${topSkills.slice(0, 4).join(', ')}` : ''}.`;
    if (expCount > 0) {
      overview += ` Der Werdegang umfasst ${expCount} berufliche Stationen.`;
    }
    if (eduText) {
      overview += ` Die akademische Ausbildung umfasst: ${eduText}.`;
    }

    if (summarySec && summarySec.paragraphs[0] && summarySec.paragraphs[0][0]) {
      bullets.push(`Berufliches Profil: ${summarySec.paragraphs[0][0]}`);
    }
    if (keyRoles.length > 0) {
      bullets.push(`Wichtigste Erfahrungen: ${keyRoles.join('; sowie ')}`);
    }
    if (topSkills.length > 0) {
      bullets.push(`Kernkompetenzen: ${topSkills.slice(0, 6).join(', ')}`);
    }
    if (languagesList.length > 0) {
      bullets.push(`Sprachen: ${languagesList.join(', ')}`);
    }
  } else if (lang === 'ar') {
    overview = `إليك الملخص التنفيذي للملف الشخصي. يُظهر المرشح مهارات متميزة${skillsSec && topSkills.length > 0 ? ` في مجالات مثل ${topSkills.slice(0, 4).join(' و ')}` : ''}.`;
    if (expCount > 0) {
      overview += ` يمتلك سجل خبرة يحتوي على ${expCount} من الأدوار السابقة.`;
    }
    if (eduText) {
      overview += ` تشمل الخلفية التعليمية: ${eduText}.`;
    }

    if (summarySec && summarySec.paragraphs[0] && summarySec.paragraphs[0][0]) {
      bullets.push(`الملخص المهني: ${summarySec.paragraphs[0][0]}`);
    }
    if (keyRoles.length > 0) {
      bullets.push(`أبرز الخبرات: ${keyRoles.join('، و ')}`);
    }
    if (topSkills.length > 0) {
      bullets.push(`المهارات الأساسية: ${topSkills.slice(0, 6).join('، و ')}`);
    }
    if (languagesList.length > 0) {
      bullets.push(`اللغات: ${languagesList.join('، و ')}`);
    }
  } else {
    // English (Default)
    overview = `Here is the executive summary of this profile. The candidate displays specialized background${skillsSec && topSkills.length > 0 ? ` with expertise in ${topSkills.slice(0, 4).join(', ')}` : ''}.`;
    if (expCount > 0) {
      overview += ` They have held ${expCount} professional role${expCount > 1 ? 's' : ''} in their career.`;
    }
    if (eduText) {
      overview += ` Their educational background highlights: ${eduText}.`;
    }

    if (summarySec && summarySec.paragraphs[0] && summarySec.paragraphs[0][0]) {
      bullets.push(`Professional profile: ${summarySec.paragraphs[0][0]}`);
    }
    if (keyRoles.length > 0) {
      bullets.push(`Key experience: ${keyRoles.join('; and ')}`);
    }
    if (topSkills.length > 0) {
      bullets.push(`Key competencies: ${topSkills.slice(0, 6).join(', ')}`);
    }
    if (projectsSec && projectsSec.paragraphs[0] && projectsSec.paragraphs[0][0]) {
      bullets.push(`Featured project: ${projectsSec.paragraphs[0][0].replace(/^[•\-*+●■◆]\s|^\d+[.)]\s/, '').trim()}`);
    }
    if (languagesList.length > 0) {
      bullets.push(`Languages: ${languagesList.join(', ')}`);
    }
  }

  const speakText = `${overview} ${bullets.join('. ')}`;

  return {
    overview,
    bullets,
    speakText
  };
}

/**
 * Check if the CV meets a specific qualification/keyword requirement.
 * @param {string} rawText Raw CV content
 * @param {string} qualification Qualification keyword or phrase to search for
 * @param {Array} sections Parsed sections
 * @returns {Object} Qualification result showing met (boolean), message, section name, and matched snippet
 */
export function checkQualification(rawText, qualification, sections) {
  const term = (qualification || '').trim().toLowerCase();
  if (!term) {
    return { met: false, message: "No qualification keyword provided." };
  }

  // 1. Search in structured sections first to return exact category/title
  if (sections && sections.length > 0) {
    for (const section of sections) {
      for (const para of section.paragraphs) {
        for (const sentence of para) {
          if (sentence.toLowerCase().includes(term)) {
            return {
              met: true,
              section: section.title,
              snippet: sentence.trim(),
              message: `Found in ${section.title}: "${sentence.trim()}"`
            };
          }
        }
      }
    }
  }

  // 2. Fallback: search raw text line-by-line
  if (rawText) {
    const lines = rawText.split(/\r?\n/);
    for (const line of lines) {
      if (line.toLowerCase().includes(term)) {
        return {
          met: true,
          section: "Other details",
          snippet: line.trim(),
          message: `Found: "${line.trim()}"`
        };
      }
    }
  }

  // 3. Not found
  return {
    met: false,
    section: null,
    snippet: null,
    message: `No mention of "${qualification}" found in the CV.`
  };
}
