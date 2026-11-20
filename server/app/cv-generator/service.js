import { generateGeminiText } from '../../pkg/gemini/client.js';
import { env } from '../../lib/config/env.js';

export async function generateCv(body) {
  const {
    name, role, email = '', phone = '', location = '', linkedin = '', github = '', portfolio = '',
    summary = '', skills = '', experience = '', education = '', projects = '',
    certifications = '', languages = '', enhance = '',
  } = body || {};

  if (!name || !role) {
    const err = new Error('Candidate name and target role are required.');
    err.statusCode = 400;
    throw err;
  }

  const prompt = `You are an expert ATS CV architect following strict truth-first drafting rules:
1. TRUTH FIRST: Never invent employers, dates, metrics, tools, or certifications not provided below.
2. ZERO LEAKAGE: Output ONLY the final CV text—no markdown code fences, no preamble, no meta-notes.
3. MANDATORY SECTION ORDER (uppercase titles on their own line):
   CONTACT -> SUMMARY -> SKILLS -> EXPERIENCE -> PROJECTS -> EDUCATION -> CERTIFICATIONS -> LANGUAGES
4. Use "- " bullets for EXPERIENCE, PROJECTS, and CERTIFICATIONS.

Candidate Master Data:
- Full Name: ${String(name).slice(0, 120)}
- Headline / Target Role: ${String(role).slice(0, 160)}
- Location: ${String(location).slice(0, 120)}
- Email: ${String(email).slice(0, 120)}
- Phone: ${String(phone).slice(0, 60)}
- LinkedIn: ${String(linkedin).slice(0, 200)}
- GitHub: ${String(github).slice(0, 200)}
- Portfolio: ${String(portfolio).slice(0, 200)}
- Summary Notes: ${String(summary).slice(0, 1000)}
- Categorized Skills: ${String(skills).slice(0, 1500)}
- Work Experience: ${String(experience).slice(0, 4000)}
- Key Projects: ${String(projects).slice(0, 3000)}
- Education: ${String(education).slice(0, 1500)}
- Certifications: ${String(certifications).slice(0, 1000)}
- Languages: ${String(languages).slice(0, 300)}
- Tailoring / JD Instructions: ${String(enhance).slice(0, 1500)}`;

  const cvText = await generateGeminiText({ apiKey: env.geminiApiKey, model: env.geminiModel, prompt });
  return { cvText };
}
