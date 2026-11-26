const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MD_PATH = path.join(PROJECT_ROOT, 'docs', 'SRS_and_SDD_Emergency_Ambulance_Hospital_Resource_Allocation.md');
const PDF_PATH = path.join(PROJECT_ROOT, 'docs', 'SRS_and_SDD_Emergency_Ambulance_Hospital_Resource_Allocation.pdf');
const TMP_HTML = '/tmp/srs_document.html';

console.log('1. Converting Markdown to HTML via Pandoc...');
const pandocHtml = execSync(`pandoc -f gfm -t html5 "${MD_PATH}"`, { encoding: 'utf-8' });

console.log('2. Reading embedded JS/CSS assets...');
const mermaidJs = fs.readFileSync('/tmp/pdf-assets/mermaid.min.js', 'utf-8');
const katexJs = fs.readFileSync('/tmp/pdf-assets/katex.min.js', 'utf-8');
const katexCss = fs.readFileSync('/tmp/pdf-assets/katex.min.css', 'utf-8');
const katexAutoRenderJs = fs.readFileSync('/tmp/pdf-assets/auto-render.min.js', 'utf-8');

const customCss = `
  @page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    line-height: 1.55;
    font-size: 9.5pt;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }

  /* Cover Page Styling */
  .cover-page {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 80vh;
    padding: 40px 20px;
    border-bottom: 3px solid #0f172a;
  }

  .cover-title {
    font-size: 26pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
    margin-bottom: 12px;
  }

  .cover-subtitle {
    font-size: 16pt;
    font-weight: 600;
    color: #dc2626;
    margin-bottom: 30px;
  }

  .cover-badge-table {
    width: 100%;
    max-width: 550px;
    margin-top: 30px;
    border-collapse: collapse;
  }

  .cover-badge-table td {
    padding: 8px 12px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 10pt;
  }

  .cover-badge-table td.label {
    font-weight: bold;
    color: #475569;
    width: 35%;
  }

  .cover-badge-table td.value {
    color: #0f172a;
    font-weight: 600;
  }

  /* Main Headings */
  h1 {
    color: #0f172a;
    font-size: 17pt;
    font-weight: 800;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 6px;
    margin-top: 28px;
    margin-bottom: 14px;
    page-break-after: avoid;
  }

  h1#table-of-contents, h1#part-1-software-requirements-specification-srs, h1#part-2-uml--system-design-specification-sdd, h1#part-3-software-engineering-methodology--verification {
    page-break-before: always;
  }

  h2 {
    color: #1e293b;
    font-size: 13pt;
    font-weight: 700;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    margin-top: 22px;
    margin-bottom: 10px;
    page-break-after: avoid;
  }

  h3 {
    color: #334155;
    font-size: 11pt;
    font-weight: 600;
    margin-top: 16px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }

  p {
    margin-top: 0;
    margin-bottom: 8px;
    text-align: justify;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }

  th {
    background-color: #0f172a;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 7px 9px;
    border: 1px solid #0f172a;
  }

  td {
    padding: 6px 9px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }

  tr:nth-child(even) {
    background-color: #f8fafc;
  }

  /* Code Blocks */
  pre {
    background-color: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 10px;
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 8pt;
    overflow-x: auto;
    page-break-inside: avoid;
    line-height: 1.4;
  }

  code {
    background-color: #f1f5f9;
    padding: 2px 4px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 8.5pt;
    color: #b91c1c;
  }

  pre code {
    background-color: transparent;
    padding: 0;
    color: #0f172a;
  }

  /* Mermaid Diagrams */
  .mermaid-wrapper {
    margin: 16px 0;
    padding: 16px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    display: flex;
    justify-content: center;
    page-break-inside: avoid;
  }

  .mermaid-wrapper svg {
    max-width: 100% !important;
    height: auto !important;
  }

  /* Links */
  a {
    color: #0369a1;
    text-decoration: none;
  }

  hr {
    border: none;
    border-top: 1px solid #cbd5e1;
    margin: 20px 0;
  }

  /* Table of Contents Formatting */
  #table-of-contents + ul {
    list-style-type: none;
    padding-left: 0;
  }

  #table-of-contents + ul li {
    padding: 3px 0;
  }

  #table-of-contents + ul > li > a {
    font-weight: bold;
    color: #0f172a;
  }
`;

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Emergency Ambulance & Hospital Resource Allocation System — SRS & SDD</title>
  <style>${katexCss}</style>
  <style>${customCss}</style>
  <script>${mermaidJs}</script>
  <script>${katexJs}</script>
  <script>${katexAutoRenderJs}</script>
</head>
<body>
  <div class="document-content">
    ${pandocHtml}
  </div>

  <script>
    (async function initRender() {
      // 1. Convert Mermaid code blocks into wrapper divs
      const mermaidPres = document.querySelectorAll('pre.mermaid');
      mermaidPres.forEach((pre) => {
        const code = pre.querySelector('code') || pre;
        const text = code.textContent;
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-wrapper';
        const mDiv = document.createElement('div');
        mDiv.className = 'mermaid';
        mDiv.textContent = text;
        wrapper.appendChild(mDiv);
        pre.parentNode.replaceChild(wrapper, pre);
      });

      // 2. Initialize and run Mermaid
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: '-apple-system, sans-serif',
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
          sequence: { useMaxWidth: true, showSequenceNumbers: true },
          er: { useMaxWidth: true }
        });
        await mermaid.run();
      } catch (err) {
        console.error('Mermaid render error:', err);
      }

      // 3. Render KaTeX math equations
      try {
        renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\\\(', right: '\\\\)', display: false },
            { left: '\\\\[', right: '\\\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX render error:', err);
      }

      // Signal ready
      window.__PDF_RENDER_COMPLETE__ = true;
    })();
  </script>
</body>
</html>`;

fs.writeFileSync(TMP_HTML, fullHtml);
console.log('3. Wrote intermediate HTML to', TMP_HTML);

console.log('4. Launching Chrome headless via CDP to print PDF...');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_USER_DATA = '/tmp/chrome-pdf-profile';

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9222',
  `--user-data-dir=${CHROME_USER_DATA}`,
  '--allow-file-access-from-files',
], { stdio: 'ignore' });

async function printPdf() {
  await new Promise((r) => setTimeout(r, 2000));

  let version;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      version = await res.json();
      break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!version) {
    throw new Error('Could not connect to Chrome DevTools port 9222');
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  await new Promise((r) => (ws.onopen = r));

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  const { result: targetRes } = await send('Target.createTarget', { url: `file://${TMP_HTML}` });
  const targetId = targetRes.targetId;

  const { result: attachRes } = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attachRes.sessionId;

  function sendSession(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
    });
  }

  await sendSession('Page.enable');
  await sendSession('Runtime.enable');

  console.log('5. Waiting for Mermaid and KaTeX rendering to complete...');
  for (let attempt = 0; attempt < 30; attempt++) {
    const evalRes = await sendSession('Runtime.evaluate', {
      expression: 'window.__PDF_RENDER_COMPLETE__ === true',
    });
    if (evalRes?.result?.result?.value === true) {
      console.log('   Render signaled complete!');
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Small buffer for font layouts
  await new Promise((r) => setTimeout(r, 1000));

  console.log('6. Generating PDF with A4 dimensions and academic headers/footers...');
  const headerTemplate = `
    <div style="font-size: 7.5pt; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, sans-serif; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between;">
      <span>Emergency Ambulance & Hospital Resource Allocation System (EAHRAS)</span>
      <span>IEEE Std 830-1998 / ISO/IEC/IEEE 29148:2018</span>
    </div>
  `;

  const footerTemplate = `
    <div style="font-size: 7.5pt; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, sans-serif; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between;">
      <span>Confidential & Academic Submission</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `;

  const pdfData = await sendSession('Page.printToPDF', {
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    paperWidth: 8.27,  // A4
    paperHeight: 11.69, // A4
    marginTop: 0.8,
    marginBottom: 0.8,
    marginLeft: 0.6,
    marginRight: 0.6,
  });

  const buffer = Buffer.from(pdfData.result.data, 'base64');
  fs.writeFileSync(PDF_PATH, buffer);
  console.log(`✓ PDF successfully created: ${PDF_PATH} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  await send('Target.closeTarget', { targetId });
  ws.close();
}

printPdf()
  .catch((err) => {
    console.error('Error generating PDF:', err);
  })
  .finally(() => {
    chromeProc.kill();
  });
