/**
 * SpeechController manages the Web Speech Synthesis lifecycle.
 * It compiles a play queue of CV sentences and friendly commentary,
 * speaking them sentence-by-sentence to prevent cutoffs and provide
 * precise UI sentence-highlighting and bot animation synchronization.
 */
export default class SpeechController {
  constructor() {
    this.synth = window.speechSynthesis;
    this.playlist = [];
    this.currentIndex = -1;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.speed = 1.0;
    this.selectedVoice = null;
    this.isUpdatingUtterance = false;
    this.rateTimeout = null;
    this.currentCharIndex = 0;
    this.currentCharOffset = 0;
    
    // Callbacks
    this.onItemStart = null;    // (item) => {}
    this.onBoundary = null;     // (charIndex, charLength, word) => {}
    this.onFinished = null;     // () => {}
    this.onStateChange = null;  // (state) => {}
  }

  /**
   * Get list of available voices from browser
   * @returns {SpeechSynthesisVoice[]}
   */
  getVoices() {
    return this.synth ? this.synth.getVoices() : [];
  }

  /**
   * Select a voice based on language and gender preference
   * @param {string} langCode 'en' | 'es' | 'fr' | 'de'
   * @param {string} gender 'male' | 'female'
   */
  findVoice(langCode, gender) {
    const voices = this.getVoices();
    if (voices.length === 0) return null;

    // Filter by language prefix (e.g., 'en' matches 'en-US', 'en-GB')
    const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langCode.toLowerCase()));
    
    if (langVoices.length === 0) {
      // Fallback to any English voice or just any voice
      const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
      return englishVoices[0] || voices[0];
    }

    const femaleKeywords = ['female', 'zira', 'hazel', 'susan', 'heera', 'haruka', 'hortense', 'hedda', 'samantha', 'tessa', 'moira', 'karen', 'elena', 'laura', 'anna', 'katja', 'aria', 'natasha', 'sara', 'zariyah', 'jenny', 'sabina', 'helena', 'hoda'];
    const maleKeywords = ['male', 'david', 'george', 'mark', 'ravi', 'daniel', 'oliver', 'peter', 'stefan', 'yannick', 'pablo', 'guy', 'james', 'conrad', 'microsoft guy', 'guy online'];

    const getVoiceGender = (voice) => {
      const name = voice.name.toLowerCase();
      if (femaleKeywords.some(k => name.includes(k))) return 'female';
      if (maleKeywords.some(k => name.includes(k))) return 'male';
      if (name.includes('google us english')) return 'female';
      return 'unknown';
    };

    // Filter voices matching the gender preference
    let genderVoices = langVoices.filter(v => {
      const vGender = getVoiceGender(v);
      if (gender === 'female') {
        return vGender === 'female' || vGender === 'unknown';
      } else {
        return vGender === 'male' || vGender === 'unknown';
      }
    });

    if (genderVoices.length === 0) {
      genderVoices = langVoices;
    }

    // Helper to score the voices (prefer natural, online, google, neural voices)
    const scoreVoice = (voice) => {
      const name = voice.name.toLowerCase();
      let score = 0;
      if (name.includes('natural')) score += 100;
      if (name.includes('online')) score += 50;
      if (name.includes('google')) score += 30;
      if (name.includes('neural')) score += 20;
      
      const vGender = getVoiceGender(voice);
      if (vGender === gender) score += 40;

      if (name.includes('david') || name.includes('zira')) score -= 50; // penalize robotic offline voices
      return score;
    };

    // Sort descending by score
    genderVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));

    return genderVoices[0];
  }

  /**
   * Build the speech playlist from parsed sections
   * @param {Array} sections Parsed sections
   * @param {string} lang Language code
   * @param {boolean} includeCommentary Add conversational transitions
   */
  compilePlaylist(sections, lang, includeCommentary) {
    const list = [];
    
    // Commentary translations
    const commentary = {
      en: {
        welcome: "Hello! I am your CV assistant. Let's explore your professional profile together.",
        intro: "First, let's look at your introduction and background.",
        summary: "Here is your professional summary.",
        experience: "Now, let's review your work experience and professional career. You have some great roles here!",
        education: "Let's check out your academic background next.",
        skills: "Moving on to your skills and technical expertise. Here is what you specialize in.",
        projects: "Next, let's take a look at the projects you've worked on.",
        certifications: "Here are your certifications and qualifications.",
        languages: "Let's see the languages you speak.",
        default: "Next is the section titled: ",
        outro: "And that concludes our review. It looks like you have a highly impressive background! Thank you."
      },
      es: {
        welcome: "¡Hola! Soy tu asistente de currículum. Exploremos tu perfil profesional juntos.",
        intro: "Primero, veamos tu introducción.",
        summary: "Aquí está tu resumen profesional.",
        experience: "Ahora, revisemos tu experiencia laboral. ¡Tienes una trayectoria muy interesante!",
        education: "A continuación, veamos tu formación académica.",
        skills: "Pasemos a tus habilidades y conocimientos técnicos.",
        projects: "Veamos ahora los proyectos en los que has trabajado.",
        certifications: "Aquí están tus certificaciones y logros.",
        languages: "Estos son los idiomas que dominas.",
        default: "La siguiente sección es: ",
        outro: "Y con esto concluimos la revisión. ¡Tienes un perfil excelente! Muchas gracias."
      },
      fr: {
        welcome: "Bonjour! Je suis votre assistant CV. Découvrons ensemble votre parcours professionnel.",
        intro: "Tout d'abord, regardons votre introduction.",
        summary: "Voici votre résumé professionnel.",
        experience: "Examinons maintenant votre expérience professionnelle. C'est un parcours impressionnant!",
        education: "Passons ensuite à votre formation académique.",
        skills: "Voyons vos compétences et expertises techniques.",
        projects: "Regardons les projets sur lesquels vous avez travaillé.",
        certifications: "Voici vos certifications et diplômes.",
        languages: "Voici les langues que vous parlez.",
        default: "La section suivante est: ",
        outro: "Et cela conclut notre examen. Votre profil est excellent! Merci beaucoup."
      },
      de: {
        welcome: "Hallo! Ich bin dein Lebenslauf-Assistent. Lass uns gemeinsam dein Profil ansehen.",
        intro: "Werfen wir zuerst einen Blick auf deine Einleitung.",
        summary: "Hier ist deine berufliche Zusammenfassung.",
        experience: "Kommen wir nun zu deiner Berufserfahrung. Das ist ein beeindruckender Werdegang!",
        education: "Als nächstes betrachten wir deinen Bildungsweg.",
        skills: "Schauen wir uns deine Kenntnisse und Fähigkeiten an.",
        projects: "Hier sind einige der Projekte, an denen du gearbeitet hast.",
        certifications: "Hier sind deine Zertifikate und Qualifikationen.",
        languages: "Das sind die Sprachen, die du sprichst.",
        default: "Der nächste Abschnitt ist: ",
        outro: "Und damit ist unsere Überprüfung abgeschlossen. Du hast ein hervorragendes Profil! Vielen Dank."
      },
      ar: {
        welcome: "مرحباً! أنا مساعد السيرة الذاتية الخاص بك. لنستكشف ملفك الشخصي معاً.",
        intro: "أولاً، دعنا نلقي نظرة على المقدمة والخلفية الخاصة بك.",
        summary: "إليك ملخصك المهني.",
        experience: "الآن، دعنا نراجع خبرتك العملية ومسيرتك المهنية. لديك بعض الأدوار الرائعة هنا!",
        education: "دعنا نتحقق من خلفيتك الأكاديمية بعد ذلك.",
        skills: "ننتقل الآن إلى مهاراتك وخبراتك التقنية. إليك ما تتخصص فيه.",
        projects: "بعد ذلك، دعنا نلقي نظرة على المشاريع التي عملت عليها.",
        certifications: "إليك شهاداتك ومؤهلاتك.",
        languages: "دعنا نرى اللغات التي تتحدثها.",
        default: "القسم التالي بعنوان: ",
        outro: "وبهذا تنتهي مراجعتنا. يبدو أن لديك خلفية رائعة ومثيرة للإعجاب! شكراً لك."
      }
    };

    const comms = commentary[lang] || commentary.en;

    if (includeCommentary) {
      list.push({
        type: 'commentary',
        text: comms.welcome,
        sectionId: 'welcome'
      });
    }

    sections.forEach((sec) => {
      // Add section commentary
      if (includeCommentary) {
        let text = comms[sec.icon] || `${comms.default} ${sec.title}.`;
        list.push({
          type: 'commentary',
          text,
          sectionId: sec.id
        });
      }

      // Add actual content sentences
      sec.paragraphs.forEach((paragraph, pIdx) => {
        paragraph.forEach((sentence, sIdx) => {
          list.push({
            type: 'cv-sentence',
            text: sentence,
            sectionId: sec.id,
            paragraphIndex: pIdx,
            sentenceIndex: sIdx,
            sectionTitle: sec.title
          });
        });
      });
    });

    if (includeCommentary) {
      list.push({
        type: 'commentary',
        text: comms.outro,
        sectionId: 'outro'
      });
    }

    this.playlist = list;
    this.currentIndex = 0;
  }

  /**
   * Start speech playback
   * @param {Array} sections Parsed sections
   * @param {string} lang Language code
   * @param {string} gender 'male' | 'female'
   * @param {number} speed Speed rate (0.5 to 2.0)
   * @param {boolean} includeCommentary Add conversational transitions
   * @param {string} voiceURI Selected voice URI
   * @param {string} startSectionId Section ID to start reading from
   */
  play(sections, lang, gender, speed = 1.0, includeCommentary = true, voiceURI = null, startSectionId = null) {
    if (this.isPaused) {
      this.resume();
      return;
    }

    this.stop();
    
    this.speed = speed;
    if (voiceURI) {
      this.selectedVoice = this.getVoices().find(v => v.voiceURI === voiceURI) || this.findVoice(lang, gender);
    } else {
      this.selectedVoice = this.findVoice(lang, gender);
    }
    
    this.compilePlaylist(sections, lang, includeCommentary);
    
    if (this.playlist.length === 0) return;

    if (startSectionId) {
      const startIdx = this.playlist.findIndex(item => item.sectionId === startSectionId);
      if (startIdx !== -1) {
        this.currentIndex = startIdx;
      } else {
        this.currentIndex = 0;
      }
    } else {
      this.currentIndex = 0;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.speakCurrent();
  }

  /**
   * Jump directly to a specific section in the active playlist
   * @param {string} sectionId Section ID to jump to
   */
  jumpToSection(sectionId) {
    if (!this.isPlaying || this.playlist.length === 0) return false;
    
    const targetIdx = this.playlist.findIndex(item => item.sectionId === sectionId);
    if (targetIdx !== -1) {
      this.currentIndex = targetIdx;
      this.speakCurrent();
      return true;
    }
    return false;
  }

  /**
   * Skip forward to the next section in the playlist
   */
  nextSection() {
    if (!this.isPlaying || this.playlist.length === 0) return;
    const currentItem = this.playlist[this.currentIndex];
    if (!currentItem) return;
    const currentSecId = currentItem.sectionId;
    
    // Find first index after current index where sectionId is different
    let nextIdx = -1;
    for (let i = this.currentIndex + 1; i < this.playlist.length; i++) {
      if (this.playlist[i].sectionId !== currentSecId) {
        nextIdx = i;
        break;
      }
    }
    
    if (nextIdx !== -1) {
      this.currentIndex = nextIdx;
      this.speakCurrent();
    } else {
      // No next section, stop playback
      this.stop();
      if (this.onFinished) this.onFinished();
    }
  }

  /**
   * Go back to the previous section in the playlist
   */
  previousSection() {
    if (!this.isPlaying || this.playlist.length === 0) return;
    const currentItem = this.playlist[this.currentIndex];
    if (!currentItem) return;
    const currentSecId = currentItem.sectionId;
    
    // Find the start index of the CURRENT section in the playlist
    let currentSecStartIdx = this.currentIndex;
    while (currentSecStartIdx > 0 && this.playlist[currentSecStartIdx - 1].sectionId === currentSecId) {
      currentSecStartIdx--;
    }
    
    // If we've started reading a section and we are in the middle of it,
    // going back should restart the current section first.
    // If we are at the very beginning of the section, go back to the previous section.
    if (this.currentIndex > currentSecStartIdx) {
      this.currentIndex = currentSecStartIdx;
      this.speakCurrent();
    } else if (currentSecStartIdx > 0) {
      // Search backward from (currentSecStartIdx - 1) to find the previous section's ID
      const prevSecId = this.playlist[currentSecStartIdx - 1].sectionId;
      // Find the start index of that PREVIOUS section
      let prevSecStartIdx = currentSecStartIdx - 1;
      while (prevSecStartIdx > 0 && this.playlist[prevSecStartIdx - 1].sectionId === prevSecId) {
        prevSecStartIdx--;
      }
      this.currentIndex = prevSecStartIdx;
      this.speakCurrent();
    } else {
      // We are already at the first section, just restart it
      this.currentIndex = 0;
      this.speakCurrent();
    }
  }

  /**
   * Speak the item at the current playlist index
   * @param {boolean} resumeFromOffset Restart current item from offset
   */
  speakCurrent(resumeFromOffset = false) {
    if (!this.isPlaying || this.currentIndex >= this.playlist.length) {
      this.stop();
      if (this.onFinished) this.onFinished();
      return;
    }

    const item = this.playlist[this.currentIndex];
    
    if (!resumeFromOffset) {
      this.currentCharIndex = 0;
      this.currentCharOffset = 0;
    }

    const textToSpeak = item.text.substring(this.currentCharOffset);

    // If remaining text is empty or just whitespace, skip to next item
    if (!textToSpeak.trim()) {
      this.currentIndex++;
      this.speakCurrent();
      return;
    }
    
    // Call UI start callback
    if (!resumeFromOffset && this.onItemStart) {
      this.onItemStart(item);
    }
    
    if (this.onStateChange) {
      this.onStateChange({ isPlaying: true, isPaused: false, currentItem: item });
    }

    // Cancel anything in progress
    this.synth.cancel();

    this.currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
    if (this.selectedVoice) {
      this.currentUtterance.voice = this.selectedVoice;
    }
    this.currentUtterance.rate = this.speed;

    // Boundary sync: tracks current word/syllable
    this.currentUtterance.onboundary = (event) => {
      if (event.name === 'word') {
        const absoluteIndex = this.currentCharOffset + event.charIndex;
        this.currentCharIndex = absoluteIndex;
        
        if (this.onBoundary) {
          const textRemaining = item.text.substring(absoluteIndex);
          const wordMatch = textRemaining.match(/^[\w']+/);
          const word = wordMatch ? wordMatch[0] : '';
          this.onBoundary(absoluteIndex, event.charLength, word);
        }
      }
    };

    this.currentUtterance.onend = () => {
      if (this.isUpdatingUtterance) return;
      if (this.isPlaying && !this.isPaused) {
        this.currentIndex++;
        this.speakCurrent();
      }
    };

    this.currentUtterance.onerror = (e) => {
      if (this.isUpdatingUtterance) return;
      // In chrome, calling cancel triggers error: 'interrupted', which is expected.
      if (e.error !== 'interrupted') {
        console.error("SpeechSynthesisUtterance error:", e);
        this.currentIndex++;
        this.speakCurrent();
      }
    };

    this.synth.speak(this.currentUtterance);
  }

  /**
   * Update the speech rate dynamically
   * @param {number} rate Speed rate (0.5 to 2.0)
   */
  setRate(rate) {
    this.speed = rate;
    if (this.isPlaying && !this.isPaused && this.currentUtterance) {
      if (this.rateTimeout) {
        clearTimeout(this.rateTimeout);
      }
      
      this.isUpdatingUtterance = true;
      this.synth.cancel();
      
      // Save current progress within the sentence
      const pauseOffset = this.currentCharIndex;
      this.currentCharOffset = pauseOffset;
      
      this.rateTimeout = setTimeout(() => {
        this.isUpdatingUtterance = false;
        this.speakCurrent(true); // Speak from character offset
        this.rateTimeout = null;
      }, 80);
    }
  }

  /**
   * Pause speech synthesis
   */
  pause() {
    if (this.isPlaying && !this.isPaused) {
      this.isPaused = true;
      this.synth.pause();
      if (this.onStateChange) {
        this.onStateChange({ isPlaying: true, isPaused: true, currentItem: this.playlist[this.currentIndex] });
      }
    }
  }

  /**
   * Resume speech synthesis
   */
  resume() {
    if (this.isPlaying && this.isPaused) {
      this.isPaused = false;
      this.synth.resume();
      
      // Some browsers (like Chrome on Windows) fail to resume properly via synth.resume()
      // If it stays silent, a robust fallback is to just speak the current sentence again
      setTimeout(() => {
        if (!this.synth.speaking && this.isPlaying && !this.isPaused) {
          this.speakCurrent();
        }
      }, 300);

      if (this.onStateChange) {
        this.onStateChange({ isPlaying: true, isPaused: false, currentItem: this.playlist[this.currentIndex] });
      }
    }
  }

  /**
   * Stop speech synthesis completely
   */
  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentIndex = -1;
    this.playlist = [];
    if (this.synth) {
      this.synth.cancel();
    }
    if (this.onStateChange) {
      this.onStateChange({ isPlaying: false, isPaused: false, currentItem: null });
    }
  }
}
