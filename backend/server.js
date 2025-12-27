const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { Configuration, OpenAIApi } = require('openai');
const puppeteer = require('puppeteer-core');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // parse JSON bodies for auth endpoints

// Users storage
const USERS_FILE = path.join(__dirname, 'users.json');
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_FILE)); } catch (e) { return []; }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Ensure generated directory exists
const GENERATED_DIR = path.join(__dirname, 'generated');
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

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
  const systemPrompt = `You are a helpful assistant that transforms brief career notes or bullet points into a well-organized CV content. Produce JSON with keys: summary, experience (array of objects with company, role, dates, bullets), education (array), skills (array of strings). Return only valid JSON. Keep entries concise and professional.`;
  const userPrompt = `Input:\n${userInput}\n\nOutput must be JSON with: summary, experience (array of {company, role, dates, bullets}), education (array of {school, degree, dates}), skills (array of strings).`;

  const completion = await openai.createChatCompletion({
    model: "gpt-4o-mini",
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 800,
    temperature: 0.2
  });

  const text = completion.data.choices[0].message.content;
  try {
    const jsonStart = text.indexOf('{');
    const jsonText = jsonStart >= 0 ? text.slice(jsonStart) : text;
    return JSON.parse(jsonText);
  } catch (e) {
    return { summary: userInput, experience: [], education: [], skills: [] };
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
      body { font-family: 'Times New Roman', serif; color: #2c3e50; padding: 25px; background: white; line-height: 1.6; }
      .header { display:flex; align-items:center; gap:20px; margin-bottom:20px; }
      .photo { width:120px; height:120px; border-radius:50%; overflow:hidden; background:#ecf0f1; flex-shrink:0; border:3px solid #3498db; box-shadow:0 4px 8px rgba(0,0,0,0.2); }
      .photo img { width:100%; height:100%; object-fit:cover; }
      .heading { flex:1; }
      .name { font-size:28px; font-weight:700; margin-bottom:8px; }
      .meta { color:#7f8c8d; font-size:16px; margin-bottom:10px; }
      .summary { color:#34495e; font-style:italic; }
      .section { margin-top:20px; }
      .section h3 { border-bottom:4px solid #3498db; padding-bottom:8px; margin-bottom:15px; font-weight:600; color:#2c3e50; }
      .exp-header { display:flex; justify-content:space-between; align-items:center; }
      .dates { color:#95a5a6; font-size:14px; font-style:italic; }
      ul { margin:10px 0 0 25px; }
      .skill { display:inline-block; background:#ecf0f1; color:#34495e; padding:8px 12px; margin:5px; border-radius:25px; font-size:14px; font-weight:500; border:1px solid #bdc3c7; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="photo">${photoDataUrl ? `<img src="${photoDataUrl}" alt="Profile Photo"/>` : ''}</div>
      <div class="heading">
        <div class="name">${escapeHtml(name || '')}</div>
        <div class="meta">${escapeHtml(email || '')}${phone ? ' | ' + escapeHtml(phone) : ''}${location ? ' | ' + escapeHtml(location) : ''}</div>
        ${summary ? `<div class="summary">${escapeHtml(summary)}</div>` : ''}
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

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Auth middleware
function authenticate(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // expect payload contains id and email
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/generate-cv (protected)
app.post('/api/generate-cv', authenticate, upload.single('photo'), async (req, res) => {
  try {
    // Basic fields
    const { name, email, phone, location } = req.body;
    // If 'prompt' exists, use AI to expand into structured CV data
    let cvStructured;
    if (req.body.prompt) {
      cvStructured = await aiExpandCv(req.body.prompt);
    } else {
      try {
        cvStructured = {
          summary: req.body.summary || '',
          experience: req.body.experience ? JSON.parse(req.body.experience) : [],
          education: req.body.education ? JSON.parse(req.body.education) : [],
          skills: req.body.skills ? JSON.parse(req.body.skills) : []
        };
      } catch (e) {
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

    // Render to PDF using puppeteer-core for Vercel compatibility
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    await browser.close();

    // Save PDF to backend/generated/<userId>/
    const userId = String(req.user.id || req.user.sub || req.user.email || 'anonymous');
    const userDir = path.join(GENERATED_DIR, sanitizeFilename(userId));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    const timestamp = Date.now();
    const safeName = sanitizeFilename((name || 'cv') + '_' + timestamp + '.pdf');
    const filePath = path.join(userDir, safeName);
    fs.writeFileSync(filePath, pdfBuffer);

    // Send PDF back as response
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName.replace(/\s+/g, '_')}"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating CV:', err);
    res.status(500).json({ error: 'Failed to generate CV', details: err.message });
  }
});

// GET /api/my-cvs - list files for authenticated user
app.get('/api/my-cvs', authenticate, (req, res) => {
  try {
    const userId = String(req.user.id || req.user.sub || req.user.email || 'anonymous');
    const userDir = path.join(GENERATED_DIR, sanitizeFilename(userId));
    if (!fs.existsSync(userDir)) return res.json({ files: [] });
    const files = fs.readdirSync(userDir).filter(f => f.endsWith('.pdf')).map(f => ({ name: f, url: `/api/my-cvs/download/${encodeURIComponent(f)}`, created_at: fs.statSync(path.join(userDir, f)).mtime }));
    res.json({ files });
  } catch (err) {
    console.error('List CVs error', err);
    res.status(500).json({ error: 'Failed to list CVs' });
  }
});

// GET /api/my-cvs/download/:file - download a specific file for authenticated user
app.get('/api/my-cvs/download/:file', authenticate, (req, res) => {
  try {
    const filename = req.params.file || '';
    const safe = sanitizeFilename(filename);
    if (safe !== filename) return res.status(400).json({ error: 'Invalid filename' });
    const userId = String(req.user.id || req.user.sub || req.user.email || 'anonymous');
    const userDir = path.join(GENERATED_DIR, sanitizeFilename(userId));
    const filePath = path.join(userDir, safe);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath);
  } catch (err) {
    console.error('Download error', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Signup - create a new user
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const users = loadUsers();
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'User already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const user = { id: Date.now(), name: name || '', email, password: hashed };
    users.push(user);
    saveUsers(users);
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Signup error', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login - verify user
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const users = loadUsers();
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Simple testing route
app.get('/ping', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});