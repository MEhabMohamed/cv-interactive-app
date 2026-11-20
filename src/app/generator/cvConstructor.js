/**
 * Structured ATS CV Constructor modeled on D:\Coding\utils\resume
 * (00_AI_MASTER.md mandatory section order + Mohamed_Ehab_CV.html print layout).
 */

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str ?? '').replace(/[&<>"']/g, (ch) => map[ch]);
}

function splitBullets(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Builds plain-text ATS CV matching CVParser.js section conventions:
 * CONTACT -> SUMMARY -> SKILLS -> EXPERIENCE -> PROJECTS -> EDUCATION -> CERTIFICATIONS -> LANGUAGES
 */
export function buildPlainTextCv(profile) {
  const lines = [];

  lines.push('CONTACT');
  lines.push(`Name: ${profile.fullName || ''}`);
  if (profile.headline) lines.push(`Role: ${profile.headline}`);
  if (profile.location) lines.push(`Location: ${profile.location}`);
  if (profile.email) lines.push(`Email: ${profile.email}`);
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.linkedin) lines.push(`LinkedIn: ${profile.linkedin}`);
  if (profile.github) lines.push(`GitHub: ${profile.github}`);
  if (profile.portfolio) lines.push(`Portfolio: ${profile.portfolio}`);
  lines.push('');

  if (profile.summary && profile.summary.trim()) {
    lines.push('SUMMARY');
    lines.push(profile.summary.trim());
    lines.push('');
  }

  const skillGroups = (profile.skillGroups || []).filter((g) => g.category?.trim() || g.items?.trim());
  if (skillGroups.length > 0) {
    lines.push('SKILLS');
    for (const grp of skillGroups) {
      lines.push(grp.category ? `${grp.category.trim()}: ${grp.items.trim()}` : grp.items.trim());
    }
    lines.push('');
  }

  const experiences = (profile.experiences || []).filter((e) => e.title?.trim() || e.company?.trim());
  if (experiences.length > 0) {
    lines.push('EXPERIENCE');
    for (const exp of experiences) {
      const meta = [exp.dates, exp.location].filter(Boolean).join(' | ');
      lines.push(`${exp.title || 'Role'} — ${exp.company || 'Company'}${meta ? ` (${meta})` : ''}`);
      for (const b of splitBullets(exp.bullets)) {
        lines.push(`- ${b}`);
      }
      lines.push('');
    }
  }

  const projects = (profile.projects || []).filter((p) => p.name?.trim());
  if (projects.length > 0) {
    lines.push('PROJECTS');
    for (const proj of projects) {
      lines.push(`${proj.name.trim()}${proj.techStack ? ` (${proj.techStack.trim()})` : ''}`);
      for (const b of splitBullets(proj.bullets)) {
        lines.push(`- ${b}`);
      }
      lines.push('');
    }
  }

  const education = (profile.education || []).filter((ed) => ed.degree?.trim() || ed.institution?.trim());
  if (education.length > 0) {
    lines.push('EDUCATION');
    for (const ed of education) {
      lines.push(`${ed.degree || ''}${ed.institution ? ` — ${ed.institution}` : ''}${ed.year ? ` (${ed.year})` : ''}`);
    }
    lines.push('');
  }

  const certs = splitBullets(profile.certifications);
  if (certs.length > 0) {
    lines.push('CERTIFICATIONS');
    for (const c of certs) lines.push(`- ${c}`);
    lines.push('');
  }

  if (profile.languages && profile.languages.trim()) {
    lines.push('LANGUAGES');
    lines.push(profile.languages.trim());
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Builds a print-ready standalone HTML document styled after D:\Coding\utils\resume\Mohamed_Ehab_CV.html
 */
export function buildPrintableHtmlCv(profile) {
  const contactParts = [profile.location, profile.email, profile.phone].filter(Boolean).map(escapeHtml).join(' &bull; ');
  const linkParts = [
    profile.github ? `<strong>GitHub:</strong> <a href="${escapeHtml(profile.github)}">${escapeHtml(profile.github)}</a>` : '',
    profile.linkedin ? `<strong>LinkedIn:</strong> <a href="${escapeHtml(profile.linkedin)}">${escapeHtml(profile.linkedin)}</a>` : '',
    profile.portfolio ? `<strong>Portfolio:</strong> <a href="${escapeHtml(profile.portfolio)}">${escapeHtml(profile.portfolio)}</a>` : '',
  ].filter(Boolean).join(' &bull; ');

  const skillsHtml = (profile.skillGroups || [])
    .filter((g) => g.category?.trim() || g.items?.trim())
    .map((g) => `<li>${g.category ? `<strong>${escapeHtml(g.category)}:</strong> ` : ''}${escapeHtml(g.items)}</li>`)
    .join('');

  const expHtml = (profile.experiences || [])
    .filter((e) => e.title?.trim() || e.company?.trim())
    .map((e) => {
      const meta = [e.dates, e.location].filter(Boolean).map(escapeHtml).join(' | ');
      const bullets = splitBullets(e.bullets).map((b) => `<li>${escapeHtml(b)}</li>`).join('');
      return `<h3>${escapeHtml(e.title)} — ${escapeHtml(e.company)} <span class="meta">${meta}</span></h3><ul>${bullets}</ul>`;
    })
    .join('');

  const projHtml = (profile.projects || [])
    .filter((p) => p.name?.trim())
    .map((p) => {
      const bullets = splitBullets(p.bullets).map((b) => `<li>${escapeHtml(b)}</li>`).join('');
      return `<h4>${escapeHtml(p.name)}</h4>${p.techStack ? `<div class="tech-stack">${escapeHtml(p.techStack)}</div>` : ''}<ul>${bullets}</ul>`;
    })
    .join('');

  const eduHtml = (profile.education || [])
    .filter((ed) => ed.degree?.trim() || ed.institution?.trim())
    .map((ed) => `<li><strong>${escapeHtml(ed.degree)}</strong>${ed.institution ? ` — ${escapeHtml(ed.institution)}` : ''}${ed.year ? ` (${escapeHtml(ed.year)})` : ''}</li>`)
    .join('');

  const certHtml = splitBullets(profile.certifications).map((c) => `<li>${escapeHtml(c)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(profile.fullName || 'Resume')} — CV</title>
  <style>
    :root { --primary: #1e3a8a; --accent: #2563eb; --text: #1f2937; --muted: #4b5563; --border: #e5e7eb; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: var(--text); line-height: 1.5; max-width: 860px; margin: 0 auto; padding: 36px 44px; background: #fff; font-size: 13.5px; }
    h1 { font-size: 28px; margin: 0 0 4px 0; color: var(--primary); letter-spacing: -0.3px; }
    .headline { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 8px; }
    .contact { font-size: 13px; color: var(--muted); margin-bottom: 18px; line-height: 1.6; }
    .contact a { color: var(--accent); text-decoration: none; }
    h2 { font-size: 15.5px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--primary); border-bottom: 2px solid var(--border); padding-bottom: 4px; margin: 20px 0 10px 0; }
    h3 { font-size: 14.5px; margin: 12px 0 2px 0; color: #111827; display: flex; justify-content: space-between; flex-wrap: wrap; }
    h3 span.meta { font-size: 12.5px; font-weight: 500; color: var(--muted); }
    h4 { font-size: 13.5px; margin: 10px 0 2px 0; color: #1e293b; }
    .tech-stack { font-size: 12.5px; font-style: italic; color: var(--muted); margin-bottom: 5px; }
    p { margin: 6px 0 10px 0; }
    ul { margin: 4px 0 10px 0; padding-left: 20px; }
    li { margin-bottom: 4px; }
    .print-bar { background: #eff6ff; border: 1px solid #bfdbfe; padding: 10px 16px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .print-btn { background: var(--accent); color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    @media print { .print-bar { display: none; } body { padding: 0; font-size: 12.5px; } h2 { margin-top: 14px; } a { color: var(--text) !important; text-decoration: none !important; } }
  </style>
</head>
<body>
  <div class="print-bar">
    <span><strong>Ready-to-Print ATS CV Preview:</strong> Click the button or press <code>Ctrl + P</code> to Save as PDF.</span>
    <button class="print-btn" onclick="window.print()">Save as PDF / Print</button>
  </div>
  <header>
    <h1>${escapeHtml(profile.fullName || '')}</h1>
    ${profile.headline ? `<div class="headline">${escapeHtml(profile.headline)}</div>` : ''}
    <div class="contact">${contactParts}${linkParts ? `<br/>${linkParts}` : ''}</div>
  </header>
  ${profile.summary ? `<section><h2>Professional Summary</h2><p>${escapeHtml(profile.summary)}</p></section>` : ''}
  ${skillsHtml ? `<section><h2>Technical &amp; Core Skills</h2><ul>${skillsHtml}</ul></section>` : ''}
  ${expHtml ? `<section><h2>Work Experience</h2>${expHtml}</section>` : ''}
  ${projHtml ? `<section><h2>Key Projects</h2>${projHtml}</section>` : ''}
  ${eduHtml || certHtml ? `<section><h2>Education &amp; Certifications</h2><ul>${eduHtml}${certHtml}</ul></section>` : ''}
  ${profile.languages ? `<section><h2>Languages</h2><p>${escapeHtml(profile.languages)}</p></section>` : ''}
</body>
</html>`;
}

