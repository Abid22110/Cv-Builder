// Enhanced frontend: dynamic entries, photo preview, live CV preview, and form submission
(function(){
  const form = document.getElementById('cv-form');
  const expList = document.getElementById('experience-list');
  const eduList = document.getElementById('education-list');
  const addExpBtn = document.getElementById('add-exp');
  const addEduBtn = document.getElementById('add-edu');
  const previewBtn = document.getElementById('preview-btn');
  const previewEl = document.getElementById('cv-preview');
  const status = document.getElementById('status');
  const photoInput = document.getElementById('photo-input');
  let photoDataUrl = null;

  function createExperienceEntry(data = {}){
    const wrapper = document.createElement('div');
    wrapper.className = 'entry exp-entry';
    wrapper.innerHTML = `
      <div class="row">
        <input name="role" placeholder="Role (e.g. Senior Frontend Engineer)" value="${data.role||''}" />
        <input name="company" placeholder="Company" value="${data.company||''}" />
      </div>
      <div class="row" style="margin-top:8px;">
        <input name="dates" placeholder="Dates (e.g. 2020 - Present)" value="${data.dates||''}" />
        <button type="button" class="small remove">Remove</button>
      </div>
      <label>Bullets (one per line)<textarea name="bullets">${(data.bullets||[]).join('\n')}</textarea></label>
    `;
    wrapper.querySelector('.remove').addEventListener('click', () => wrapper.remove());
    return wrapper;
  }

  function createEducationEntry(data = {}){
    const wrapper = document.createElement('div');
    wrapper.className = 'entry edu-entry';
    wrapper.innerHTML = `
      <div class="row">
        <input name="degree" placeholder="Degree (e.g. BSc Computer Science)" value="${data.degree||''}" />
        <input name="school" placeholder="School" value="${data.school||''}" />
      </div>
      <div class="row" style="margin-top:8px;">
        <input name="dates" placeholder="Dates" value="${data.dates||''}" />
        <button type="button" class="small remove">Remove</button>
      </div>
    `;
    wrapper.querySelector('.remove').addEventListener('click', () => wrapper.remove());
    return wrapper;
  }

  addExpBtn.addEventListener('click', () => {
    expList.appendChild(createExperienceEntry());
  });
  addEduBtn.addEventListener('click', () => {
    eduList.appendChild(createEducationEntry());
  });

  // Start with one empty entry
  expList.appendChild(createExperienceEntry());
  eduList.appendChild(createEducationEntry());

  // Photo preview
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) { photoDataUrl = null; updatePreview(); return; }
    const reader = new FileReader();
    reader.onload = () => { photoDataUrl = reader.result; updatePreview(); };
    reader.readAsDataURL(file);
  });

  function collectData(){
    const fd = new FormData(form);
    const data = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      phone: fd.get('phone') || '',
      location: fd.get('location') || '',
      prompt: fd.get('prompt') || '',
      skills: (fd.get('skills') || '').split(',').map(s=>s.trim()).filter(Boolean),
      experience: [],
      education: []
    };

    // experiences
    expList.querySelectorAll('.exp-entry').forEach(node => {
      const role = node.querySelector('input[name="role"]').value;
      const company = node.querySelector('input[name="company"]').value;
      const dates = node.querySelector('input[name="dates"]').value;
      const bullets = node.querySelector('textarea[name="bullets"]').value.split('\n').map(s=>s.trim()).filter(Boolean);
      if (role || company) data.experience.push({ role, company, dates, bullets });
    });

    // education
    eduList.querySelectorAll('.edu-entry').forEach(node => {
      const degree = node.querySelector('input[name="degree"]').value;
      const school = node.querySelector('input[name="school"]').value;
      const dates = node.querySelector('input[name="dates"]').value;
      if (degree || school) data.education.push({ degree, school, dates });
    });

    return data;
  }

  function escapeHtml(text){
    if (!text) return '';
    return String(text).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderCvHtml(data){
    const expHtml = (data.experience||[]).map(exp => `\n      <div class="exp-item">\n        <div class="exp-header"><strong>${escapeHtml(exp.role||'')}</strong> — ${escapeHtml(exp.company||'')}<span class="dates">${escapeHtml(exp.dates||'')}</span></div>\n        <ul>${(exp.bullets||[]).map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>\n      </div>`).join('');

    const eduHtml = (data.education||[]).map(ed => `\n      <div class="edu-item"><strong>${escapeHtml(ed.degree||'')}</strong>, ${escapeHtml(ed.school||'')} <span class="dates">${escapeHtml(ed.dates||'')}</span></div>`).join('');

    const skillsHtml = (data.skills||[]).map(s=>`<span class="skill">${escapeHtml(s)}</span>`).join(' ');

    return `\n      <div class="cv">\n        <div class="header">\n          <div class="photo">${photoDataUrl ? `<img src="${photoDataUrl}" alt="photo"/>` : ''}</div>\n          <div>\n            <div class="name">${escapeHtml(data.name)}</div>\n            <div class="meta">${escapeHtml(data.email)}${data.phone? ' | '+escapeHtml(data.phone):''}${data.location? ' | '+escapeHtml(data.location):''}</div>\n            <div style="margin-top:8px;color:#444;">${escapeHtml(data.prompt || '')}</div>\n          </div>\n        </div>\n\n        <div>\n          <h3>Experience</h3>\n          ${expHtml || '<div>No experience provided</div>'}\n        </div>\n\n        <div>\n          <h3>Education</h3>\n          ${eduHtml || '<div>No education provided</div>'}\n        </div>\n\n        <div>\n          <h3>Skills</h3>\n          <div>${skillsHtml || 'No skills provided'}</div>\n        </div>\n      </div>\n    `;
  }

  function updatePreview(){
    const data = collectData();
    previewEl.innerHTML = renderCvHtml(data);
  }

  previewBtn.addEventListener('click', updatePreview);

  // Auto update preview on input changes (debounced)
  let debounceTimer = null;
  form.addEventListener('input', ()=>{
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updatePreview, 600);
  });

  // Initial preview
  updatePreview();

  // Form submission - send structured JSON (unless prompt is provided, in which case server may use AI)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Generating PDF...';
    const data = collectData();
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('phone', data.phone);
    formData.append('location', data.location);
    if (data.prompt) formData.append('prompt', data.prompt);
    formData.append('skills', JSON.stringify(data.skills));
    formData.append('experience', JSON.stringify(data.experience));
    formData.append('education', JSON.stringify(data.education));
    // attach photo file if present
    const file = photoInput.files && photoInput.files[0];
    if (file) formData.append('photo', file);

    try {
      const res = await fetch('/api/generate-cv', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        status.textContent = 'Error: ' + (err.error || res.statusText);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = data.name || 'cv';
      a.download = `${name.replace(/\s+/g,'_')}.pdf`;
      document.body.appendChild(a);
      a.click(); a.remove(); window.URL.revokeObjectURL(url);
      status.textContent = 'Done — PDF downloaded';
    } catch (err) {
      console.error(err);
      status.textContent = 'Failed to generate PDF: ' + err.message;
    }
  });
})();
