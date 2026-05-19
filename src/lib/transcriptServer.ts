import express, { Request, Response } from 'express';
import db from './db';
import { logger } from './logger';
import { SHARED_CSS, escapeHtml } from './transcriptGenerator';

export function getTranscriptBaseUrl(): string {
  return (process.env.TRANSCRIPT_BASE_URL || `http://localhost:${process.env.TRANSCRIPT_PORT || 3001}`).replace(/\/$/, '');
}

export function createTranscriptUrl(slug: string): string {
  return `${getTranscriptBaseUrl()}/transcript/${slug}`;
}

export function createTranscriptServer(port: number = 3001): void {
  const app = express();

  // Middleware
  app.use(express.static('public'));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`, { context: 'TranscriptServer', ip: req.ip });
    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Homepage ──────────────────────────────────────────────────────────
  app.get('/', (_req: Request, res: Response) => {
    const year = new Date().getFullYear();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NodeByte — Ticket Transcripts</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
  <style>
    ${SHARED_CSS}
    html, body { height: 100%; }
    body { display: flex; flex-direction: column; }
    main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
    .card {
      width: 100%; max-width: 480px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 40px;
      box-shadow: 0 24px 64px rgba(0,0,0,.5);
      animation: fadeUp .35s ease both;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 32px; }
    .logo-img { width: 48px; height: 48px; border-radius: 12px; object-fit: contain; background: var(--surface2); }
    .logo-text { display: flex; flex-direction: column; gap: 2px; }
    .logo-name { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
    .logo-sub  { font-size: 13px; color: var(--muted); }
    h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.25; margin-bottom: 8px; color: #fff; }
    .desc { font-size: 14px; color: var(--subtle); margin-bottom: 26px; line-height: 1.6; }
    .input-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .input-row { display: flex; gap: 8px; }
    input[type="text"] {
      flex: 1; padding: 11px 14px;
      background: var(--surface2); color: var(--text);
      border: 1px solid var(--border); border-radius: 10px;
      font-family: inherit; font-size: 14px; outline: none;
      transition: border-color .2s, box-shadow .2s;
    }
    input[type="text"]::placeholder { color: var(--muted); }
    input[type="text"]:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(59,91,219,.2); }
    button[type="submit"] {
      padding: 11px 20px; background: var(--accent); color: #fff;
      border: none; border-radius: 10px; font-family: inherit;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background .15s, transform .1s; white-space: nowrap;
      display: flex; align-items: center; gap: 7px;
    }
    button[type="submit"]:hover  { background: #2e49b5; }
    button[type="submit"]:active { transform: scale(.97); }
    .hints { margin-top: 14px; display: flex; gap: 14px; flex-wrap: wrap; }
    .hint-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
    .hint-item i { font-size: 10px; color: var(--accent-light); }
    @media (max-width: 520px) {
      .card { padding: 28px 20px; border-radius: 16px; }
      h1 { font-size: 20px; }
      .input-row { flex-direction: column; }
      button[type="submit"] { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <div class="logo-row">
        <img class="logo-img" src="https://nodebyte.host/logo.png" alt="NodeByte">
        <div class="logo-text">
          <span class="logo-name">NodeByte</span>
          <span class="logo-sub">Ticket Transcripts</span>
        </div>
      </div>
      <h1>Find a transcript</h1>
      <p class="desc">Enter a Transcript ID or Thread ID to view the full conversation history from a support ticket.</p>
      <div class="input-label"><i class="fa-solid fa-magnifying-glass"></i> Transcript or Thread ID</div>
      <form action="/search" method="GET">
        <div class="input-row">
          <input type="text" id="q" name="q" placeholder="e.g. a24855bbd0da" autocomplete="off" required>
          <button type="submit"><i class="fa-solid fa-arrow-right"></i> View</button>
        </div>
        <div class="hints">
          <span class="hint-item"><i class="fa-solid fa-fingerprint"></i>12-character transcript ID</span>
          <span class="hint-item"><i class="fa-brands fa-discord"></i>Discord thread / channel ID</span>
        </div>
      </form>
    </div>
  </main>
  <footer class="footer-bar">
    <span><i class="fa-solid fa-lock" style="margin-right:5px;"></i>Transcripts are private &amp; only accessible via direct link</span>
    <span class="footer-dot"></span>
    <span>&copy; ${year} NodeByte LTD</span>
  </footer>
</body>
</html>`);
  });

  // ── Search redirect ───────────────────────────────────────────────────
  app.get('/search', (req: Request, res: Response) => {
    const query = (req.query.q as string || '').trim();
    if (!query) return res.redirect('/');
    if (/^[a-f0-9]{12}$/.test(query)) return res.redirect(`/transcript/${query}`);
    return res.redirect(`/ticket/${query}`);
  });

  // ── Transcript by slug ───────────────────────────────────────────────
  app.get('/transcript/:slug', async (req: Request, res: Response) => {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      if (!/^[a-f0-9]{12}$/.test(slug)) {
        return res.status(400).send(errorPage('Invalid transcript ID', 'The ID you provided is not in the correct format.'));
      }
      const transcript = await db.getTranscriptBySlug(slug);
      if (!transcript) {
        return res.status(404).send(errorPage('Transcript not found', 'This transcript does not exist or may have been deleted.'));
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(transcript.htmlContent);
      logger.debug('Transcript served', { context: 'TranscriptServer', slug, guildId: transcript.guildId });
    } catch (err) {
      logger.error('Error serving transcript', { context: 'TranscriptServer', error: err });
      res.status(500).send(errorPage('Server error', 'Something went wrong. Please try again later.'));
    }
  });

  // ── Transcript by ticket/thread ID ───────────────────────────────────
  app.get('/ticket/:ticketId', async (req: Request, res: Response) => {
    try {
      const ticketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId;
      const transcript = await db.getTranscriptBySlug(ticketId);
      if (!transcript) {
        return res.status(404).send(errorPage('Transcript not found', 'No transcript was found for this ticket ID.'));
      }
      res.redirect(`/transcript/${transcript.slug}`);
    } catch (err) {
      logger.error('Error finding transcript by ticket ID', { context: 'TranscriptServer', error: err });
      res.status(500).send(errorPage('Server error', 'Something went wrong. Please try again later.'));
    }
  });

  // ── 404 ───────────────────────────────────────────────────────────────
  app.use((req: Request, res: Response) => {
    res.status(404).send(errorPage('Page not found', `The path <code>${escapeHtml(req.path)}</code> does not exist.`));
  });

  try {
    app.listen(port, () => {
      logger.info(`Transcript server running at ${getTranscriptBaseUrl()}`, { context: 'TranscriptServer' });
    });
  } catch (err) {
    logger.error('Failed to start transcript server', { context: 'TranscriptServer', error: err, port });
  }
}

// ── Error page helper ─────────────────────────────────────────────────
function errorPage(title: string, detail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — NodeByte</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
  <style>
    ${SHARED_CSS}
    body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:24px; text-align:center; }
    .err-wrap { max-width: 360px; }
    .err-icon { font-size:40px; margin-bottom:20px; color:var(--muted); display:block; }
    h1 { font-size:20px; font-weight:700; margin-bottom:10px; color:#fff; }
    p { font-size:14px; color:var(--subtle); line-height:1.6; }
    code { background:var(--surface2); padding:1px 6px; border-radius:4px; font-size:13px; color:var(--accent-light); }
    .back { margin-top:24px; font-size:13px; }
    .back a { display:inline-flex; align-items:center; gap:6px; color:var(--subtle); padding:8px 16px; border:1px solid var(--border); border-radius:8px; transition:all .15s; }
    .back a:hover { color:var(--text); background:var(--surface2); text-decoration:none; }
  </style>
</head>
<body>
  <div class="err-wrap">
    <i class="fa-solid fa-triangle-exclamation err-icon"></i>
    <h1>${escapeHtml(title)}</h1>
    <p>${detail}</p>
    <div class="back"><a href="/"><i class="fa-solid fa-arrow-left"></i> Back to search</a></div>
  </div>
</body>
</html>`;
}
