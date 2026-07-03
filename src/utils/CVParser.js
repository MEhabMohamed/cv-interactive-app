import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up PDFJS worker locally via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Detect language based on frequencies of common stop words
 * @param {string} text 
 * @returns {string} Language code ('en', 'es', 'fr', 'de')
 */
export function detectLanguage(text) {
  const cleanText = text.toLowerCase();
  
  const stopWords = {
    en: /\b(the|and|of|to|in|for|is|with|on|at|by|an)\b/g,
    es: /\b(el|la|los|las|de|y|en|un|una|con|es|para|por)\b/g,
    fr: /\b(le|la|les|de|et|en|un|une|avec|est|pour|dans|par)\b/g,
    de: /\b(der|die|das|und|in|zu|von|mit|ist|für|auf|ein|eine)\b/g,
    ar: /\b(من|في|على|إلى|أن|هذا|هذه|مع|أو|تم|كان|كانت)\b/g
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
 * Split a paragraph into clean sentences
 * @param {string} paragraphText 
 * @returns {string[]}
 */
function splitIntoSentences(paragraphText) {
  if (!paragraphText) return [];
  
  // Match sentence ending punctuation followed by space or end of line
  // Avoid splitting common abbreviations like 'Dr.', 'Sr.', 'i.e.', 'e.g.', 'A.I.'
  const sentences = paragraphText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences.length > 0 ? sentences : [paragraphText.trim()];
}

/**
 * Parse raw text into structured CV sections based on language
 * @param {string} text 
 * @param {string} lang 
 */
export function parseCVText(text, lang = 'en') {
  const lines = text.split(/\r?\n/).map(line => line.trim());
  
  // Section keywords per language
  const keywords = {
    en: {
      summary: /^(summary|about me|professional summary|profile|objective|career objective)$/i,
      experience: /^(experience|work experience|employment history|employment|professional experience|work history|job history)$/i,
      education: /^(education|academic background|academic history|studies|qualifications)$/i,
      skills: /^(skills|technical skills|key skills|expertise|competencies|technologies)$/i,
      projects: /^(projects|personal projects|key projects|selected projects)$/i,
      certifications: /^(certifications|licenses|courses|awards|accomplishments)$/i,
      contact: /^(contact|contact details|personal info|personal information)$/i,
      languages: /^(languages|language skills)$/i
    },
    es: {
      summary: /^(resumen|sobre mí|resumen profesional|perfil|objetivo|perfil profesional)$/i,
      experience: /^(experiencia|experiencia laboral|trayectoria profesional|historial laboral)$/i,
      education: /^(educación|formación académica|estudios|formación)$/i,
      skills: /^(habilidades|competencias|aptitudes|tecnologías|conocimientos)$/i,
      projects: /^(proyectos|proyectos personales)$/i,
      certifications: /^(certificaciones|licencias|cursos|premios|logros)$/i,
      contact: /^(contacto|datos de contacto|información personal)$/i,
      languages: /^(idiomas)$/i
    },
    fr: {
      summary: /^(résumé|à propos|profil|objectif|résumé professionnel)$/i,
      experience: /^(expérience|expérience professionnelle|parcours professionnel|expériences)$/i,
      education: /^(éducation|formation|études|diplômes|cursus académique)$/i,
      skills: /^(compétences|expertises|technologies|savoir-faire)$/i,
      projects: /^(projets|projets personnels|réalisations)$/i,
      certifications: /^(certifications|licences|formations|prix|distinctions)$/i,
      contact: /^(contact|coordonnées|informations personnelles)$/i,
      languages: /^(langues)$/i
    },
    de: {
      summary: /^(zusammenfassung|über mich|profil|berufliches profil)$/i,
      experience: /^(berufserfahrung|werdegang|beruflicher werdegang|praxiserfahrung)$/i,
      education: /^(ausbildung|bildungsweg|schulausbildung|studium)$/i,
      skills: /^(kenntnisse|fähigkeiten|it-kenntnisse|kompetenzen)$/i,
      projects: /^(projekte|projekterfahrung)$/i,
      certifications: /^(zertifikate|zertifizierungen|kurse|auszeichnungen)$/i,
      contact: /^(kontakt|kontaktdaten|persönliche angaben)$/i,
      languages: /^(sprachen)$/i
    },
    ar: {
      summary: /^(الملخص المهني|نبذة عني|الملخص|عني|الهدف المهني|الهدف)$/i,
      experience: /^(الخبرة|الخبرة العملية|تاريخ التوظيف|التوظيف|الخبرات المهنية|الخبرات)$/i,
      education: /^(التعليم|الخلفية الأكاديمية|الدراسة|المؤهلات|الشهادات الأكاديمية)$/i,
      skills: /^(المهارات|المهارات التقنية|المهارات الأساسية|الخبرات التقنية|التخصصات)$/i,
      projects: /^(المشاريع|المشاريع الشخصية|أبرز المشاريع)$/i,
      certifications: /^(الشهادات|الشهادات المهنية|الدورات التدريبية|الجوائز|الإنجازات)$/i,
      contact: /^(الاتصال|بيانات الاتصال|معلومات الاتصال|المعلومات الشخصية)$/i,
      languages: /^(اللغات|مهارات اللغة)$/i
    }
  };

  const currentKeywords = keywords[lang] || keywords.en;
  
  const parsedSections = [];
  let currentSection = {
    id: 'intro',
    title: lang === 'es' ? 'Introducción' : lang === 'fr' ? 'Introduction' : lang === 'de' ? 'Einleitung' : lang === 'ar' ? 'المقدمة' : 'Introduction',
    icon: 'summary',
    paragraphs: [],
    rawLines: []
  };

  // Process line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check if line is a header: short line (usually < 40 chars)
    let isHeader = false;
    let matchedType = null;

    if (line.length < 40) {
      for (const [type, regex] of Object.entries(currentKeywords)) {
        if (regex.test(line)) {
          isHeader = true;
          matchedType = type;
          break;
        }
      }
    }

    if (isHeader) {
      // Save prior section if it contains data
      if (currentSection.rawLines.length > 0) {
        currentSection.paragraphs = groupLinesIntoParagraphs(currentSection.rawLines);
        parsedSections.push(currentSection);
      }

      currentSection = {
        id: `section-${matchedType}-${parsedSections.length}`,
        title: line,
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
    parsedSections.push(currentSection);
  }

  // If we ended up with no real parsed sections, or just 'intro', package the whole thing as one section
  if (parsedSections.length === 1 && parsedSections[0].id === 'intro' && parsedSections[0].rawLines.length > 0) {
    // Split by double-newlines to guess sections
    const blocks = text.split(/\n\s*\n+/);
    if (blocks.length > 1) {
      return blocks.map((block, idx) => {
        const blockLines = block.split('\n').map(l => l.trim()).filter(Boolean);
        const title = blockLines[0] || `Section ${idx + 1}`;
        const remainingLines = blockLines.slice(1);
        return {
          id: `block-${idx}`,
          title: title.length < 50 ? title : `Overview ${idx + 1}`,
          icon: 'summary',
          paragraphs: [splitIntoSentences(remainingLines.join(' '))],
          rawLines: blockLines
        };
      });
    }
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
    // If the line looks like a bullet point or has a list indicator, start a new paragraph context
    const isBullet = /^[•\-*+]\s|^\d+\.\s/.test(line);
    
    if (isBullet && currentParagraphLines.length > 0) {
      paragraphs.push(splitIntoSentences(currentParagraphLines.join(' ')));
      currentParagraphLines = [line];
    } else if (line.length === 0) {
      if (currentParagraphLines.length > 0) {
        paragraphs.push(splitIntoSentences(currentParagraphLines.join(' ')));
        currentParagraphLines = [];
      }
    } else {
      currentParagraphLines.push(line);
    }
  }

  if (currentParagraphLines.length > 0) {
    paragraphs.push(splitIntoSentences(currentParagraphLines.join(' ')));
  }

  return paragraphs;
}

/**
 * Extract text from PDF file
 * @param {File} file 
 * @returns {Promise<string>}
 */
export async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY = null;
      let pageText = '';
      
      for (const item of textContent.items) {
        // Simple newline placement depending on item position shifts
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        }
        pageText += item.str + ' ';
        lastY = item.transform[5];
      }
      
      fullText += pageText + '\n\n';
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF: ", error);
    throw new Error("Could not parse PDF. Make sure it is not password protected or corrupted.");
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
        const cleaned = para[0].replace(/^[•\-*+]\s|^\d+\.\s/, '').trim();
        keyRoles.push(cleaned);
      }
    });
  }

  let topSkills = [];
  if (skillsSec) {
    const allSkills = skillsSec.paragraphs.flat();
    topSkills = allSkills.slice(0, 8).map(s => s.replace(/^[•\-*+]\s|^\d+\.\s/, '').trim());
  }

  let eduText = "";
  if (educationSec && educationSec.paragraphs[0] && educationSec.paragraphs[0][0]) {
    eduText = educationSec.paragraphs[0][0].replace(/^[•\-*+]\s|^\d+\.\s/, '').trim();
  }

  let languagesList = [];
  if (languagesSec) {
    languagesList = languagesSec.paragraphs.flat().slice(0, 4).map(l => l.replace(/^[•\-*+]\s|^\d+\.\s/, '').trim());
  }

  let overview = "";
  let bullets = [];

  // Generate localized summary texts
  if (lang === 'es') {
    overview = `Aquí está el resumen ejecutivo del perfil. Se trata de un profesional con conocimientos destacados${skillsSec ? ` en áreas como ${topSkills.slice(0, 4).join(', ')}` : ''}.`;
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
    overview = `Voici le résumé exécutif du profil. Il s'agit d'un professionnel spécialisé${skillsSec ? ` dans des domaines tels que ${topSkills.slice(0, 4).join(', ')}` : ''}.`;
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
    overview = `Hier ist die Zusammenfassung des Profils. Ein Experte mit fundierten Kenntnissen${skillsSec ? ` in den Bereichen ${topSkills.slice(0, 4).join(', ')}` : ''}.`;
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
    overview = `إليك الملخص التنفيذي للملف الشخصي. يُظهر المرشح مهارات متميزة${skillsSec ? ` في مجالات مثل ${topSkills.slice(0, 4).join(' و ')}` : ''}.`;
    if (expCount > 0) {
      overview += ` يمتلك سجل خبرة يحتوي على ${expCount} من الوظائف السابقة.`;
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
    overview = `Here is the executive summary of this profile. The candidate displays specialized background${skillsSec ? ` with expertise in ${topSkills.slice(0, 4).join(', ')}` : ''}.`;
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
      bullets.push(`Featured project: ${projectsSec.paragraphs[0][0].replace(/^[•\-*+]\s|^\d+\.\s/, '').trim()}`);
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
  const term = qualification.trim().toLowerCase();
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

  // 3. Not found
  return {
    met: false,
    section: null,
    snippet: null,
    message: `No mention of "${qualification}" found in the CV.`
  };
}
