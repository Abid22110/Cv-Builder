document.getElementById('cv-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById('status');
  status.textContent = 'Generating PDF...';

  const formData = new FormData(form);

  try {
    const res = await fetch('/api/generate-cv', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      status.textContent = 'Error: ' + (err.error || res.statusText);
      return;
    }

    const blob = await res.blob();
    // Download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = formData.get('name') || 'cv';
    a.download = `${name.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    status.textContent = 'Done — PDF downloaded';
  } catch (err) {
    console.error(err);
    status.textContent = 'Failed to generate PDF: ' + err.message;
  }
});
