import { ThreadChannel, Message } from 'discord.js';
import { createHash } from 'crypto';

const FA_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css';
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';

// ── Shared CSS (design tokens + shared components) ──────────────────
export const SHARED_CSS = `
  :root {
    --bg:          #0d0f13;
    --surface:     #13161b;
    --surface2:    #1a1e26;
    --surface3:    #222731;
    --border:      rgba(255,255,255,0.065);
    --border2:     rgba(255,255,255,0.1);
    --accent:      #3b5bdb;
    --accent-glow: rgba(59,91,219,0.25);
    --accent-light:#6c8aef;
    --text:        #dde1e7;
    --muted:       #5c6370;
    --subtle:      #8b949e;
    --green:       #3fb950;
    --yellow:      #d29922;
    --red:         #f85149;
    --radius:      12px;
    --radius-sm:   8px;
    --nav-h:       58px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--text); line-height: 1.5;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  a { color: var(--accent-light); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .navbar {
    position: sticky; top: 0; z-index: 200;
    height: var(--nav-h);
    background: rgba(13,15,19,0.88);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center;
    padding: 0 24px; gap: 12px;
    backdrop-filter: blur(16px) saturate(1.5);
    -webkit-backdrop-filter: blur(16px) saturate(1.5);
  }
  .navbar-logo { width: 30px; height: 30px; border-radius: 8px; object-fit: contain; flex-shrink: 0; }
  .navbar-brand { font-size: 15px; font-weight: 700; letter-spacing: -0.3px; color: #fff; }
  .navbar-div { width: 1px; height: 20px; background: var(--border2); margin: 0 4px; }
  .navbar-sub { font-size: 13px; color: var(--subtle); }
  .navbar-sep { flex: 1; }
  .navbar-btn {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 13px; font-weight: 500; color: var(--subtle);
    padding: 6px 14px; border-radius: 8px;
    border: 1px solid var(--border); transition: all .15s;
    cursor: pointer; background: transparent;
  }
  .navbar-btn:hover { color: var(--text); background: var(--surface2); text-decoration: none; border-color: var(--border2); }
  .navbar-btn i { font-size: 11px; }
  .chip {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600; padding: 3px 10px;
    border-radius: 999px; letter-spacing: 0.3px; white-space: nowrap; line-height: 1.4;
  }
  .chip i { font-size: 9px; }
  .chip-blue   { background: rgba(59,91,219,.2);  color: #6c8aef; border: 1px solid rgba(59,91,219,.3); }
  .chip-green  { background: rgba(63,185,80,.15); color: #3fb950; border: 1px solid rgba(63,185,80,.3); }
  .chip-muted  { background: rgba(255,255,255,.06); color: var(--subtle); border: 1px solid var(--border); }
  .chip-yellow { background: rgba(210,153,34,.12); color: #e3b341; border: 1px solid rgba(210,153,34,.3); }
  .chip-red    { background: rgba(248,81,73,.1);  color: #f85149; border: 1px solid rgba(248,81,73,.3); }
  .footer-bar {
    border-top: 1px solid var(--border);
    padding: 22px 24px; font-size: 12px; color: var(--muted);
    display: flex; align-items: center; justify-content: center; gap: 16px;
    flex-wrap: wrap; text-align: center;
  }
  .footer-bar a { color: var(--muted); }
  .footer-bar a:hover { color: var(--subtle); }
  .footer-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
`;

// ── Types ────────────────────────────────────────────────────────────
interface ParsedMessage {
  id:        string;
  author:    string;
  authorId:  string;
  avatar:    string;
  isBot:     boolean;
  content:   string;
  embeds: Array<{
    title:       string | null;
    description: string | null;
    color:       number | null;
    footer:      string | null;
    fields:      Array<{ name: string; value: string; inline: boolean }>;
  }>;
  timestamp: Date;
  isPinned:  boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────
export function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, c => map[c]);
}

function colorToHex(color: number | null): string {
  if (!color) return '#3b5bdb';
  return `#${color.toString(16).padStart(6, '0')}`;
}

function formatContent(raw: string): string {
  return escapeHtml(raw)
    .replace(/https?:\/\/[^\s<>"]+/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
    .replace(/&lt;@!?(\d+)&gt;/g, (_, id) => `<span class="mention"><i class="fa-solid fa-at" style="font-size:10px;margin-right:2px;"></i>${id}</span>`)
    .replace(/&lt;#(\d+)&gt;/g, (_, id) => `<span class="mention mention-channel"><i class="fa-solid fa-hashtag" style="font-size:10px;margin-right:2px;"></i>${id}</span>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

function parseMessages(messages: Message[]): ParsedMessage[] {
  return messages.map(msg => ({
    id:        msg.id,
    author:    msg.author.username,
    authorId:  msg.author.id,
    avatar:    msg.author.displayAvatarURL({ size: 64, extension: 'png' }),
    isBot:     msg.author.bot,
    content:   msg.content,
    embeds:    msg.embeds.map(e => ({
      title:       e.title,
      description: e.description ?? null,
      color:       e.color,
      footer:      e.footer?.text ?? null,
      fields:      e.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? false })),
    })),
    timestamp: msg.createdAt,
    isPinned:  msg.pinned,
  }));
}

function renderMessages(msgs: ParsedMessage[]): string {
  let html = '';
  let prevAuthorId  = '';
  let prevTimestamp: Date | null = null;

  for (const msg of msgs) {
    const sameAuthor = msg.authorId === prevAuthorId;
    const timeDiff   = prevTimestamp ? msg.timestamp.getTime() - prevTimestamp.getTime() : Infinity;
    const grouped    = sameAuthor && timeDiff < 7 * 60 * 1000;

    const hasContent = msg.content.trim().length > 0;
    const hasEmbeds  = msg.embeds.length > 0;
    if (!hasContent && !hasEmbeds) { prevAuthorId = msg.authorId; prevTimestamp = msg.timestamp; continue; }

    const timeStr = msg.timestamp.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const shortTime = msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const embedsHtml = msg.embeds.map(e => {
      const hex      = colorToHex(e.color);
      const fieldsHtml = e.fields.length
        ? `<div class="embed-fields">${e.fields.map(f => `
            <div class="embed-field${f.inline ? ' embed-field-inline' : ''}">
              <div class="embed-field-name">${escapeHtml(f.name)}</div>
              <div class="embed-field-value">${escapeHtml(f.value)}</div>
            </div>`).join('')}</div>`
        : '';
      return `
        <div class="embed" style="--ec:${hex}">
          ${e.title       ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}
          ${e.description ? `<div class="embed-desc">${formatContent(e.description)}</div>` : ''}
          ${fieldsHtml}
          ${e.footer      ? `<div class="embed-footer"><i class="fa-regular fa-clock"></i>${escapeHtml(e.footer)}</div>` : ''}
        </div>`;
    }).join('');

    if (grouped) {
      html += `
      <div class="message msg-grouped${msg.isPinned ? ' msg-pinned' : ''}">
        <div class="msg-gutter">
          <time class="msg-compact-time" datetime="${msg.timestamp.toISOString()}" title="${timeStr}">${shortTime}</time>
        </div>
        <div class="msg-body">
          ${hasContent ? `<p class="msg-text">${formatContent(msg.content)}</p>` : ''}
          ${embedsHtml}
        </div>
      </div>`;
    } else {
      html += `
      <div class="message${msg.isPinned ? ' msg-pinned' : ''}">
        <div class="msg-gutter">
          <img class="avatar" src="${msg.avatar}" alt="${escapeHtml(msg.author)}" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="msg-body">
          <div class="msg-header">
            <span class="msg-author">${escapeHtml(msg.author)}</span>
            ${msg.isBot    ? '<span class="chip chip-blue"><i class="fa-solid fa-robot"></i>Bot</span>' : ''}
            ${msg.isPinned ? '<span class="chip chip-yellow"><i class="fa-solid fa-thumbtack"></i>Pinned</span>' : ''}
            <time class="msg-time" datetime="${msg.timestamp.toISOString()}" title="${timeStr}">${timeStr}</time>
          </div>
          ${hasContent ? `<p class="msg-text">${formatContent(msg.content)}</p>` : ''}
          ${embedsHtml}
        </div>
      </div>`;
    }
    prevAuthorId  = msg.authorId;
    prevTimestamp = msg.timestamp;
  }
  return html;
}

// ── Main export ──────────────────────────────────────────────────────
export async function generateTranscriptHTML(
  thread:      ThreadChannel,
  guildName:   string,
  channelName: string,
  messages:    Message[],
  closedBy?:   string,
  closeMsg?:   string,
  category?:   string,
  createMsg?:  string,
): Promise<string> {
  const parsed             = parseMessages([...messages].reverse());
  const messagesHtml       = renderMessages(parsed);
  const uniqueParticipants = new Set(parsed.map(m => m.authorId)).size;
  const isClosed           = !!closedBy;

  const createdAt = thread.createdAt?.toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }) ?? 'Unknown';
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const statusChip  = isClosed
    ? '<span class="chip chip-muted"><i class="fa-solid fa-lock"></i>Closed</span>'
    : '<span class="chip chip-green"><i class="fa-solid fa-circle" style="font-size:7px;"></i>Open</span>';
  const categoryChip = category
    ? `<span class="chip chip-blue"><i class="fa-solid fa-tag"></i>${escapeHtml(category)}</span>`
    : '';

  const metaStats = [
    { icon: 'fa-solid fa-calendar',         label: 'Opened',        value: createdAt },
    { icon: 'fa-solid fa-comment',          label: 'Messages',      value: String(parsed.length) },
    { icon: 'fa-solid fa-users',            label: 'Participants',  value: String(uniqueParticipants) },
    { icon: 'fa-solid fa-clock-rotate-left', label: 'Generated',     value: generatedAt },
    ...(closedBy  ? [{ icon: 'fa-solid fa-user-shield', label: 'Closed By',   value: closedBy }]   : []),
    ...(closeMsg  ? [{ icon: 'fa-solid fa-comment-dots', label: 'Close Note', value: closeMsg }]   : []),
  ].map(s => `
    <div class="stat-item">
      <div class="stat-icon"><i class="${s.icon}"></i></div>
      <div>
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${escapeHtml(s.value)}</div>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>#${escapeHtml(channelName)} — NodeByte Transcripts</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONTS_URL}" rel="stylesheet">
  <link rel="stylesheet" href="${FA_CDN}" crossorigin="anonymous" referrerpolicy="no-referrer">
  <style>
    ${SHARED_CSS}

    body { display: flex; flex-direction: column; min-height: 100vh; }
    .page-wrap { flex: 1; max-width: 900px; width: 100%; margin: 0 auto; padding: 28px 20px 60px; }

    /* ── Ticket header ── */
    .ticket-header {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden; margin-bottom: 16px;
    }
    .ticket-header-accent {
      height: 4px;
      background: linear-gradient(90deg, var(--accent), #6c8aef 50%, #a78bfa);
    }
    .ticket-header-body {
      padding: 22px 24px 20px;
      display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;
    }
    .ticket-icon {
      width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
      background: rgba(59,91,219,.15);
      display: flex; align-items: center; justify-content: center;
      color: var(--accent-light); font-size: 20px;
    }
    .ticket-title-area { flex: 1; min-width: 0; }
    .ticket-name {
      font-size: 20px; font-weight: 800; letter-spacing: -0.4px;
      color: #fff; line-height: 1.2; margin-bottom: 5px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ticket-name .hash { color: var(--muted); font-weight: 600; margin-right: 1px; }
    .ticket-server { font-size: 13px; color: var(--subtle); display: flex; align-items: center; gap: 6px; }
    .ticket-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-start; padding-top: 2px; }

    /* ── Stats grid ── */
    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
      gap: 1px; background: var(--border); border-top: 1px solid var(--border);
    }
    .stat-item {
      background: var(--surface); padding: 14px 20px;
      display: flex; align-items: flex-start; gap: 12px;
    }
    .stat-icon {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      background: var(--surface2); display: flex; align-items: center;
      justify-content: center; color: var(--accent-light); font-size: 13px;
    }
    .stat-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.7px; color: var(--muted); margin-bottom: 4px;
    }
    .stat-value { font-size: 13px; font-weight: 500; color: var(--text); word-break: break-word; line-height: 1.4; }

    /* ── Messages panel ── */
    .msg-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden;
    }
    .msg-panel-head {
      padding: 12px 20px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 10px; background: var(--surface2);
    }
    .msg-panel-head-icon { color: var(--accent-light); font-size: 14px; }
    .msg-panel-head-title {
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.6px; color: var(--subtle); flex: 1;
    }
    .msg-count-badge {
      font-size: 11px; font-weight: 600;
      background: var(--surface); color: var(--subtle);
      padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border);
    }

    /* ── Messages ── */
    .message {
      display: flex; padding: 6px 16px 6px 20px;
      border-bottom: 1px solid var(--border);
      transition: background .1s; position: relative;
    }
    .message:last-child { border-bottom: none; }
    .message:hover { background: rgba(255,255,255,0.02); }
    .msg-pinned { border-left: 3px solid var(--yellow) !important; background: rgba(210,153,34,0.04); }
    .msg-pinned:hover { background: rgba(210,153,34,0.07); }
    .msg-grouped { padding-top: 2px; padding-bottom: 2px; }
    .msg-gutter { width: 56px; flex-shrink: 0; display: flex; justify-content: center; padding-top: 4px; }
    .avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; background: var(--surface2); }
    .msg-compact-time {
      font-size: 10px; color: var(--muted); opacity: 0;
      transition: opacity .15s; white-space: nowrap; padding-top: 4px; text-align: center;
    }
    .message:hover .msg-compact-time { opacity: 1; }
    .msg-body { flex: 1; min-width: 0; padding: 4px 0; }
    .msg-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .msg-author { font-size: 14px; font-weight: 700; color: #fff; line-height: 1; }
    .msg-time { font-size: 11px; color: var(--muted); margin-left: auto; white-space: nowrap; }
    .msg-text { font-size: 14px; color: #c4c9d4; white-space: pre-wrap; word-break: break-word; line-height: 1.65; }
    .mention {
      background: rgba(59,91,219,.2); color: #7b9ef0;
      border-radius: 4px; padding: 0 4px; font-size: 13px; font-weight: 500;
    }
    .mention-channel { background: rgba(59,91,219,.15); color: #6c8aef; }
    .inline-code {
      font-family: 'Fira Code', 'Consolas', monospace;
      background: var(--surface2); color: #e06c75;
      padding: 1px 6px; border-radius: 4px; font-size: 12.5px;
    }

    /* ── Embeds ── */
    .embed {
      margin-top: 8px; padding: 10px 14px 12px;
      background: var(--surface2); border-left: 4px solid var(--ec, var(--accent));
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0; max-width: 500px;
    }
    .embed-title { font-weight: 700; font-size: 13px; color: var(--accent-light); margin-bottom: 6px; }
    .embed-desc { font-size: 13px; color: var(--subtle); white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
    .embed-fields { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .embed-field { min-width: 120px; flex: 1; }
    .embed-field-inline { max-width: 200px; }
    .embed-field-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--subtle); margin-bottom: 3px; }
    .embed-field-value { font-size: 13px; color: var(--text); word-break: break-word; }
    .embed-footer {
      margin-top: 10px; font-size: 11px; color: var(--muted);
      display: flex; align-items: center; gap: 5px;
      border-top: 1px solid var(--border); padding-top: 8px;
    }

    .empty-state { padding: 56px 24px; text-align: center; color: var(--muted); font-size: 14px; }
    .empty-state i { font-size: 32px; margin-bottom: 12px; display: block; color: var(--surface2); }

    @media (max-width: 640px) {
      .page-wrap { padding: 14px 12px 48px; }
      .ticket-header-body { padding: 16px; gap: 12px; }
      .ticket-icon { width: 40px; height: 40px; font-size: 17px; }
      .ticket-name { font-size: 17px; }
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .msg-gutter { width: 44px; }
      .avatar { width: 32px; height: 32px; }
      .msg-text { font-size: 13px; }
      .navbar { padding: 0 14px; }
      .embed { max-width: 100%; }
    }
    @media (max-width: 400px) {
      .stats-grid { grid-template-columns: 1fr; }
      .ticket-icon { display: none; }
      .msg-time { display: none; }
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <img class="navbar-logo" src="https://nodebyte.host/logo.png" alt="NodeByte">
    <span class="navbar-brand">NodeByte</span>
    <div class="navbar-div"></div>
    <span class="navbar-sub">Transcripts</span>
    <div class="navbar-sep"></div>
    <a href="/" class="navbar-btn"><i class="fa-solid fa-arrow-left"></i> Search</a>
  </nav>

  <div class="page-wrap">
    <div class="ticket-header">
      <div class="ticket-header-accent"></div>
      <div class="ticket-header-body">
        <div class="ticket-icon"><i class="fa-solid fa-ticket"></i></div>
        <div class="ticket-title-area">
          <div class="ticket-name"><span class="hash">#</span>${escapeHtml(channelName)}</div>
          <div class="ticket-server">
            <i class="fa-solid fa-server" style="font-size:11px;color:var(--muted)"></i>
            ${escapeHtml(guildName)}
          </div>
        </div>
        <div class="ticket-chips">${categoryChip}${statusChip}</div>
      </div>
      <div class="stats-grid">${metaStats}</div>
    </div>

    ${createMsg ? `
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 16px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--subtle); margin-bottom: 8px;">
        <i class="fa-solid fa-pencil" style="margin-right: 6px;"></i>Initial Message
      </div>
      <div style="font-size: 13px; color: var(--text); line-height: 1.6; white-space: pre-wrap; word-break: break-word;">
        ${escapeHtml(createMsg)}
      </div>
    </div>
    ` : ''}

    <div class="msg-panel">
      <div class="msg-panel-head">
        <span class="msg-panel-head-icon"><i class="fa-solid fa-comments"></i></span>
        <span class="msg-panel-head-title">Conversation</span>
        <span class="msg-count-badge">${parsed.length} messages</span>
      </div>
      ${messagesHtml || `<div class="empty-state"><i class="fa-regular fa-comment-dots"></i>No messages to display.</div>`}
    </div>
  </div>

  <footer class="footer-bar">
    <span><i class="fa-solid fa-robot" style="margin-right:5px;"></i>Generated by NodeByte Bot</span>
    <span class="footer-dot"></span>
    <span>&copy; ${new Date().getFullYear()} NodeByte LTD</span>
    <span class="footer-dot"></span>
    <span>Transcripts are private &amp; only accessible via direct link</span>
  </footer>
</body>
</html>`;
}

export function generateTranscriptSlug(): string {
  return createHash('sha256')
    .update(Date.now() + Math.random().toString())
    .digest('hex')
    .substring(0, 12);
}