const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { Configuration, OpenAIApi } = require('openai');
const puppeteer = require('puppeteer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup - store uploads in memory for simplicity
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// OpenAI client
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));

// Helper: ask OpenAI to expand short content into CV sections
async function aiExpandCv(userInput) {
  // userInput is a string with bullet points or a short summary
  const systemPrompt = `You are a helpful assistant that transforms brief career notes or bullet points into a well-organized CV content. Produce JSON with keys: summary, experience (array of objects with company, role, dates, bullets), education (array), skills (array of strings).
Return only valid JSON. Keep entries concise and professional.`;

  const userPrompt = `Input:\n${userInput}\n\nOutput must be JSON with: summary, experience (array of {company, role, dates, bullets}), education (array of {school, degree, dates}), skills (array of strings).`;

  const completion = await openai.createChatCompletion({
    model: "gpt-4o-mini", // change if you prefer gpt-4 or gpt-4o
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 800,
    temperature: 0.2
  });

  const text = completion.data.choices[0].message.content;
  try {
    // Attempt to parse JSON from response
    const jsonStart = text.indexOf('{');
    const jsonText = jsonStart >= 0 ? text.slice(jsonStart) : text;
    return JSON.parse(jsonText);
  } catch (e) {
    // Fallback: return a simple structure
    return {
      summary: userInput,
      experience: [],
      education: [],
      skills: []
    };
  }
}

// Helper: build HTML from data and (optional) photo as data URL
function buildHtml(cvData, photoDataUrl) {
  const { name, email, phone, location, summary, experience = [], education = [], skills = [] } = cvData;

  const expHtml = experience.map(exp => `
    <div class="exp-item">
      <div class="exp-header">
        <strong>${escapeHtml(exp.role || '')}</strong> — ${escapeHtml(exp.company || '')}
        <span class="dates">${escapeHtml(exp.dates || '')}</span>
      </div>
      <ul>
        ${(exp.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  const eduHtml = education.map(ed => `
    <div class="edu-item">
      <strong>${escapeHtml(ed.degree || '')}</strong>, ${escapeHtml(ed.school || '')} <span class="dates">${escapeHtml(ed.dates || '')}</span>
    </div>
  `).join('');

  const skillsHtml = (skills || []).map(s => `<span class="skill">${escapeHtml(s)}</span>`).join(' ');

  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>CV - ${escapeHtml(name || '')}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #222; padding: 28px; }
      .header { display:flex; align-items:center; gap:20px; margin-bottom:18px; }
      .photo { width:120px; height:120px; border-radius:8px; overflow:hidden; background:#eee; }
      .photo img { width:100%; height:100%; object-fit:cover; }
      .heading { flex:1; }
      .name { font-size:28px; font-weight:700; margin-bottom:6px; }
      .meta { color:#555; font-size:14px; }
      .section { margin-top:18px; }
      .section h3 { border-bottom:2px solid #eee; padding-bottom:6px; margin-bottom:10px; color:#111; }
      .exp-header { display:flex; justify-content:space-between; }
      .dates { color:#666; font-size:12px; }
      ul { margin:6px 0 0 18px; }
      .skill { display:inline-block; background:#f1f3f5; padding:6px 8px; margin:4px; border-radius:6px; font-size:13px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="photo">${photoDataUrl ? `<img src="${photoDataUrl}" alt="photo"/>` : ''}</div>
      <div class="heading">
        <div class="name">${escapeHtml(name || '')}</div>
        <div class="meta">${escapeHtml(email || '')} ${phone ? ' | ' + escapeHtml(phone) : ''} ${location ? ' | ' + escapeHtml(location) : ''}</div>
        <div style="margin-top:8px; color:#444;">${escapeHtml(summary || '')}</div>
      </div>
    </div>

    <div class="section">
      <h3>Experience</h3>
      ${expHtml || '<div>No experience provided</div>'}
    </div>

    <div class="section">
      <h3>Education</h3>
      ${eduHtml || '<div>No education provided</div>'}
    </div>

    <div class="section">
      <h3>Skills</h3>
      <div>${skillsHtml || 'No skills provided'}</div>
    </div>
  </body>
  </html>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// POST /api/generate-cv
// Accepts fields: name, email, phone, location, prompt OR JSON fields (summary, experience, education, skills)
// Accepts optional file field: photo
app.post('/api/generate-cv', upload.single('photo'), async (req, res) => {
  try {
    // Basic fields
    const { name, email, phone, location } = req.body;
    // If 'prompt' exists, use AI to expand into structured CV data
    let cvStructured;
    if (req.body.prompt) {
      cvStructured = await aiExpandCv(req.body.prompt);
    } else {
      // Accept JSON-like fields if user posted them
      try {
        cvStructured = {
          summary: req.body.summary || '',
          experience: req.body.experience ? JSON.parse(req.body.experience) : [],
          education: req.body.education ? JSON.parse(req.body.education) : [],
          skills: req.body.skills ? JSON.parse(req.body.skills) : []
        };
      } catch (e) {
        // fallback: take plain fields
        cvStructured = {
          summary: req.body.summary || '',
          experience: [],
          education: [],
          skills: req.body.skills ? req.body.skills.split(',').map(s => s.trim()) : []
        };
      }
    }

    // Photo handling: convert buffer to data URL if present
    let photoDataUrl = null;
    if (req.file && req.file.buffer) {
      const mime = req.file.mimetype || 'image/jpeg';
      const base64 = req.file.buffer.toString('base64');
      photoDataUrl = `data:${mime};base64,${base64}`;
    }

    const html = buildHtml({
      name, email, phone, location,
      summary: cvStructured.summary,
      experience: cvStructured.experience,
      education: cvStructured.education,
      skills: cvStructured.skills
    }, photoDataUrl);

    // Render to PDF using puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${(name || 'cv').replace(/\s+/g, '_')}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating CV:', err);
    res.status(500).json({ error: 'Failed to generate CV', details: err.message });
  }
});

// Simple testing route
app.get('/ping', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
