import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const articlesDir = path.join(root, 'articles');
const coversDir = path.join(root, 'assets', 'covers');
const indexPath = path.join(root, 'index.html');
const coverVersion = '20260705-content-covers';

const catalog = [
  { number: 1, date: '2026-07-01', title: '小鎮最後一家電影院', tag: '電影' },
  { number: 2, date: '2026-07-02', title: '會寫信的機器', tag: 'AI' },
  { number: 3, date: '2026-07-02', title: '城市裡的無手機早晨俱樂部', tag: '專注' },
  { number: 4, date: '2026-07-03', title: '城市裡的安靜音樂', tag: '音樂' },
  { number: 5, date: '2026-07-04', title: '好遊戲怎麼教玩家', tag: '遊戲設計' },
  { number: 6, date: '2026-07-04', title: '慢一點其實更快的決定力', tag: '決策' },
  { number: 7, date: '2026-07-05', title: '一張來自火星的照片', tag: '太空' },
  { number: 8, date: '2026-07-06', title: '迷宮裡的線', tag: '神話' },
].map((item) => {
  const id = `${item.date}_${item.title}`;
  return {
    ...item,
    id,
    file: `articles/${id}.html`,
    htmlPath: path.join(articlesDir, `${id}.html`),
    mdPath: path.join(articlesDir, `${id}.md`),
    coverPath: path.join(coversDir, `${id}.png`),
    displayTitle: `#${item.number}${item.title}`,
  };
});

const titleByBase = new Map(catalog.map((item) => [item.title, item]));
const titleById = new Map(catalog.map((item) => [item.id, item]));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function wrapEnglishWords(text) {
  return text.replace(/\b[A-Za-z](?:[A-Za-z'-]|&#39;|&rsquo;)*\b/g, (word) => {
    const dataWord = word.replace(/&#39;|&rsquo;/g, "'");
    return `<button type="button" class="word" data-word="${escapeAttr(dataWord)}">${word}</button>`;
  });
}

function wrapTextSegments(html) {
  return html.split(/(<[^>]+>)/g).map((segment) => {
    return segment.startsWith('<') ? segment : wrapEnglishWords(segment);
  }).join('');
}

function renderInline(markdown) {
  const codeSpans = [];
  let html = String(markdown).replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@CODE${codeSpans.length}@@`;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });
  html = escapeHtml(html);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = wrapTextSegments(html);
  codeSpans.forEach((code, index) => {
    html = html.replace(`@@${wrapEnglishWords(`CODE${index}`)}@@`, code);
    html = html.replace(`@@CODE${index}@@`, code);
  });
  return html;
}

function closeList(state, out) {
  if (!state.list) return;
  out.push(`</${state.list}>`);
  state.list = null;
}

function renderMarkdown(lines) {
  const out = [];
  const state = { list: null, paragraph: [] };

  function closeParagraph() {
    if (!state.paragraph.length) return;
    out.push(`<p>${renderInline(state.paragraph.join(' '))}</p>`);
    state.paragraph = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed || /^---+$/.test(trimmed)) {
      closeParagraph();
      closeList(state, out);
      continue;
    }

    if (/^- \[ \]\s+/.test(trimmed)) {
      closeParagraph();
      closeList(state, out);
      continue;
    }

    const heading = /^(#{2,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeParagraph();
      closeList(state, out);
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    if (unordered) {
      closeParagraph();
      if (state.list !== 'ul') {
        closeList(state, out);
        out.push('<ul>');
        state.list = 'ul';
      }
      out.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }

    const ordered = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      closeParagraph();
      if (state.list !== 'ol') {
        closeList(state, out);
        out.push('<ol>');
        state.list = 'ol';
      }
      out.push(`<li>${renderInline(ordered[2])}</li>`);
      continue;
    }

    if (/^\s{2,}\S/.test(line) && state.list && out.length && out[out.length - 1].endsWith('</li>')) {
      out[out.length - 1] = out[out.length - 1].replace('</li>', `<br>${renderInline(trimmed)}</li>`);
      continue;
    }

    closeList(state, out);
    state.paragraph.push(trimmed);
  }

  closeParagraph();
  closeList(state, out);
  return out.join('\n');
}

function splitBlocks(lines) {
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) {
        blocks.push(current.join(' ').trim());
        current = [];
      }
    } else {
      current.push(line.trim());
    }
  }
  if (current.length) blocks.push(current.join(' ').trim());
  return blocks;
}

function splitSentences(text, language) {
  const source = String(text).trim();
  if (!source) return [];
  const pattern = language === 'zh'
    ? /[^。！？!?]+[。！？!?」”]?/g
    : /[^.!?]+[.!?]["”]?/g;
  const matches = source.match(pattern);
  return (matches && matches.length ? matches : [source]).map((item) => item.trim()).filter(Boolean);
}

function renderSentenceSpans(sentences, pairPrefix, language, maxPairs) {
  return sentences.map((sentence, index) => {
    const pairIndex = Math.min(index + 1, maxPairs);
    const pair = `${pairPrefix}-s${String(pairIndex).padStart(2, '0')}`;
    const classes = language === 'en' ? 'sentence-en' : 'sentence-zh';
    return `<span class="lesson-sentence ${classes}" data-pair="${pair}">${wrapTextSegments(escapeHtml(sentence))}</span>`;
  }).join(' ');
}

function renderArticlePairs(lines) {
  const blocks = splitBlocks(lines).filter((block) => !/^#{1,6}\s/.test(block));
  const pairs = [];
  for (let index = 0; index < blocks.length - 1; index += 2) {
    const english = blocks[index];
    const chinese = blocks[index + 1];
    const pairNumber = String(pairs.length + 1).padStart(2, '0');
    const englishSentences = splitSentences(english, 'en');
    const chineseSentences = splitSentences(chinese, 'zh');
    const maxPairs = Math.max(englishSentences.length, chineseSentences.length, 1);
    pairs.push(`<div class="paragraph-pair">
<p class="article-paragraph english">${renderSentenceSpans(englishSentences, `p${pairNumber}`, 'en', maxPairs)}</p>
<p class="article-paragraph chinese">${renderSentenceSpans(chineseSentences, `p${pairNumber}`, 'zh', maxPairs)}</p>
</div>`);
  }
  return pairs.join('\n');
}

function findLine(lines, pattern, start = 0) {
  for (let index = start; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) return index;
  }
  return -1;
}

function parseVocabulary(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = findLine(lines, /^##\s+(15 個重要單字|Vocabulary)\s*$/);
  if (start === -1) return [];
  const entries = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s+/.test(line)) break;
    const match = /^\d+\.\s+\*\*([^*]+)\*\*\s*(?:\/([^/]+)\/)?\s*(?:\(([^)]+)\))?\s*[:：]?\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    entries.push({
      word: match[1].trim(),
      ipa: (match[2] || '').trim(),
      pos: (match[3] || '').trim(),
      zh: (match[4] || '').replace(/\s{2,}.*/, '').trim(),
    });
  }
  return entries;
}

function dictionaryScript(entries) {
  const dictionary = {};
  for (const entry of entries) {
    const key = entry.word.toLowerCase();
    dictionary[key] = {
      word: entry.word,
      zh: entry.zh || '文章中的重要字詞',
      ipa: entry.ipa || '',
      pos: entry.pos || '',
    };
  }
  return JSON.stringify(dictionary, null, 2);
}

function css() {
  return `
:root {
  color-scheme: light;
  --page: #f6f7f4;
  --surface: #ffffff;
  --ink: #20211f;
  --muted: #666b61;
  --line: #d8ddd2;
  --accent: #0f766e;
  --accent-ink: #084b45;
  --en-highlight: #ffe58a;
  --zh-highlight: #bfeee7;
  --shadow: 0 18px 48px rgba(22, 30, 28, .14);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;
  line-height: 1.76;
}
a { color: var(--accent); text-underline-offset: .18em; }
.lesson-shell { max-width: 1260px; margin: 0 auto; padding: 40px 28px 80px; }
.cover-banner { margin: 0 0 28px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); background: #e8ece5; }
.cover-banner img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.lesson-header { padding: 28px 0 30px; border-bottom: 1px solid var(--line); }
.lesson-kicker { margin: 0 0 10px; color: var(--accent-ink); font-size: .82rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
h1, h2, h3 { line-height: 1.2; letter-spacing: 0; }
h1 { margin: 0; font-size: clamp(2.2rem, 5vw, 4.7rem); font-weight: 800; }
.core-tag { margin: 14px 0 0; }
.core-tag span { display: inline-flex; align-items: center; min-height: 28px; border: 1px solid rgba(15, 118, 110, .28); border-radius: 4px; background: #e8f4f1; color: var(--accent-ink); padding: 3px 9px; font-size: .86rem; font-weight: 800; letter-spacing: 0; }
.lesson-subtitle { margin: 14px 0 0; color: var(--muted); font-size: clamp(1.35rem, 2vw, 1.62rem); }
.article-section { padding: 34px 0 10px; }
.article-section h2, .lesson-prose h2 { margin: 40px 0 22px; font-size: clamp(1.95rem, 3vw, 2.65rem); }
.lesson-prose h3 { margin: 32px 0 12px; font-size: clamp(1.45rem, 2vw, 1.8rem); }
.article-pairs { border-top: 1px solid var(--line); }
.paragraph-pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(22px, 4vw, 52px); padding: 36px 0; border-bottom: 1px solid var(--line); }
.article-paragraph { margin: 0; font-size: 1.56rem; line-height: 1.82; }
.article-paragraph.english { font-family: Georgia, "Times New Roman", serif; font-size: 1.62rem; }
.article-paragraph.chinese { color: #33413d; }
.lesson-sentence { border-radius: 5px; padding: .08em .13em; margin: -.08em -.04em; transition: background-color .16s ease, box-shadow .16s ease, color .16s ease; }
.lesson-sentence.active.sentence-en { background: var(--en-highlight); box-shadow: 0 0 0 2px rgba(204, 147, 18, .22); }
.lesson-sentence.active.sentence-zh { background: var(--zh-highlight); box-shadow: 0 0 0 2px rgba(15, 118, 110, .18); }
.word { display: inline; appearance: none; border: 0; border-bottom: 1px dotted rgba(15, 118, 110, .46); border-radius: 0; background: transparent; color: inherit; padding: 0; font: inherit; cursor: pointer; }
.word:hover, .word:focus-visible { color: var(--accent-ink); border-bottom-color: var(--accent-ink); outline: none; }
.lesson-prose { max-width: 980px; padding-top: 12px; font-size: 1.5rem; line-height: 1.78; }
.lesson-prose p { margin: 14px 0; }
.lesson-prose li { margin: 8px 0 16px; }
.lesson-prose ol, .lesson-prose ul { padding-left: 1.45rem; }
.completion-check { display: inline-flex; align-items: center; gap: 10px; margin-top: 28px; padding: 12px 0; font-weight: 700; color: var(--accent-ink); }
.completion-check input { width: 20px; height: 20px; accent-color: var(--accent); }
.completion-check:has(input:disabled) { color: var(--muted); }
.sync-note { color: var(--muted); font-weight: 650; }
.sync-note.hidden { display: none; }
.lookup-popover { position: fixed; z-index: 30; min-width: 260px; max-width: min(380px, calc(100vw - 28px)); padding: 16px 17px; border: 1px solid rgba(15, 118, 110, .22); border-radius: 8px; background: rgba(255, 255, 255, .97); box-shadow: var(--shadow); opacity: 0; transform: translateY(6px); pointer-events: none; transition: opacity .14s ease, transform .14s ease; }
.lookup-popover.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
.lookup-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.lookup-word { margin: 0; font-size: 1.22rem; font-weight: 800; color: var(--accent-ink); }
.lookup-actions { display: inline-flex; gap: 8px; }
.speak-button, .star-button { border: 1px solid rgba(15, 118, 110, .25); border-radius: 7px; background: #eff8f6; color: var(--accent-ink); font: inherit; font-size: .92rem; font-weight: 700; padding: 5px 9px; cursor: pointer; }
.star-button { width: 34px; height: 34px; padding: 0; background: #fff; color: #8a6d1d; font-size: 1.12rem; line-height: 1; }
.star-button.is-saved { border-color: rgba(180, 83, 9, .32); background: #fff7da; color: #b45309; }
.speak-button:disabled, .star-button:disabled { opacity: .45; cursor: not-allowed; }
.lookup-row { margin: 4px 0; color: var(--muted); font-size: 1rem; }
.lookup-row strong { color: var(--ink); }
@media (max-width: 760px) {
  .lesson-shell { padding: 24px 18px 60px; }
  .cover-banner { margin-bottom: 22px; }
  .paragraph-pair { grid-template-columns: 1fr; gap: 14px; padding: 28px 0; }
  .article-paragraph, .article-paragraph.english, .lesson-prose { font-size: 1.32rem; }
  .lesson-subtitle { font-size: 1.22rem; }
}
`;
}

function lessonScript(dictionary) {
  return `
const lessonDictionary = ${dictionary};
const labels = {
  fallbackZh: '這個字未收錄在本課字典中，請先依上下文猜意思。',
  fallbackIpa: '未收錄',
  fallbackPos: '未收錄',
  meaning: '中文',
  ipa: 'IPA',
  pos: '詞性',
  audio: '播放'
};
function normalizeCandidates(raw) {
  const base = String(raw || '').toLowerCase().trim().replace(/^[^a-z]+|[^a-z]+$/g, '');
  const candidates = [base];
  if (base.endsWith('ies')) candidates.push(base.slice(0, -3) + 'y');
  if (base.endsWith('es')) candidates.push(base.slice(0, -2));
  if (base.endsWith('s')) candidates.push(base.slice(0, -1));
  if (base.endsWith('ing')) candidates.push(base.slice(0, -3));
  if (base.endsWith('ed')) candidates.push(base.slice(0, -2));
  return Array.from(new Set(candidates.filter(Boolean)));
}
function localLookup(raw) {
  for (const key of normalizeCandidates(raw)) {
    if (lessonDictionary[key]) return lessonDictionary[key];
  }
  return { word: raw, zh: labels.fallbackZh, ipa: labels.fallbackIpa, pos: labels.fallbackPos };
}
function activatePair(pairId) {
  document.querySelectorAll('.lesson-sentence.active').forEach((node) => node.classList.remove('active'));
  if (!pairId) return;
  document.querySelectorAll('.lesson-sentence[data-pair="' + pairId + '"]').forEach((node) => node.classList.add('active'));
}
const articleMeta = {
  id: decodeURIComponent(location.pathname.split('/').pop() || document.title).replace(/\\.html$/i, ''),
  title: (document.querySelector('h1') && document.querySelector('h1').textContent.trim()) || document.title,
  file: decodeURIComponent(location.pathname.split('/').pop() || '')
};
const parentWindow = window.parent && window.parent !== window ? window.parent : null;
let cloudSyncEnabled = localStorage.getItem('englishCoach.syncEnabled') === 'true';
const savedWords = new Set();
function normalizeSaveKey(raw) { return String(raw || '').toLowerCase().trim().replace(/^'+|'+$/g, ''); }
function readJsonStorage(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (error) { return fallback; }
}
function writeJsonStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {} }
function loadLocalSavedWords() {
  readJsonStorage('englishCoach.savedWords', []).forEach(function (item) {
    const key = normalizeSaveKey(item && (item.normalized || item.word || item));
    if (key) savedWords.add(key);
  });
}
function updateLocalSavedWord(entry, isSaved) {
  const words = readJsonStorage('englishCoach.savedWords', []);
  const key = normalizeSaveKey(entry.normalized || entry.word);
  const filtered = words.filter(function (item) { return normalizeSaveKey(item && (item.normalized || item.word || item)) !== key; });
  if (isSaved) filtered.push(entry);
  writeJsonStorage('englishCoach.savedWords', filtered);
}
function sendDataCommand(command, payload) {
  if (parentWindow) parentWindow.postMessage({ type: 'english-coach:data', command: command, payload: payload }, '*');
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]; });
}
function renderLookup(entry, requestedWord) {
  const displayWord = entry && entry.word ? entry.word : requestedWord;
  const zh = entry && entry.zh ? entry.zh : labels.fallbackZh;
  const ipa = entry && entry.ipa ? entry.ipa : labels.fallbackIpa;
  const pos = entry && entry.pos ? entry.pos : labels.fallbackPos;
  const normalized = normalizeSaveKey(displayWord);
  const isSaved = savedWords.has(normalized);
  const saveTitle = !cloudSyncEnabled ? '請先在設定輸入密碼開啟同步' : (isSaved ? '取消收藏' : '收藏單字');
  return '<div class="lookup-head"><p class="lookup-word">' + escapeHtml(displayWord) + '</p>' +
    '<div class="lookup-actions"><button type="button" class="star-button' + (isSaved ? ' is-saved' : '') + '" data-save-word="' + escapeHtml(displayWord) + '" data-normalized="' + escapeHtml(normalized) + '" data-zh="' + escapeHtml(zh) + '" data-ipa="' + escapeHtml(ipa) + '" data-pos="' + escapeHtml(pos) + '" title="' + saveTitle + '" aria-label="' + saveTitle + '" aria-pressed="' + (isSaved ? 'true' : 'false') + '"' + (!cloudSyncEnabled ? ' disabled' : '') + '>' + (isSaved ? '★' : '☆') + '</button>' +
    '<button type="button" class="speak-button" data-speak-word="' + escapeHtml(displayWord) + '"' + ('speechSynthesis' in window ? '' : ' disabled') + '>' + labels.audio + '</button></div></div>' +
    '<p class="lookup-row"><strong>' + labels.meaning + '</strong> ' + escapeHtml(zh) + '</p>' +
    '<p class="lookup-row"><strong>' + labels.ipa + '</strong> ' + escapeHtml(ipa) + '</p>' +
    '<p class="lookup-row"><strong>' + labels.pos + '</strong> ' + escapeHtml(pos) + '</p>';
}
function updateStarButtons() {
  document.querySelectorAll('[data-save-word]').forEach(function (button) {
    const key = normalizeSaveKey(button.dataset.normalized || button.dataset.saveWord);
    const isSaved = savedWords.has(key);
    const title = !cloudSyncEnabled ? '請先在設定輸入密碼開啟同步' : (isSaved ? '取消收藏' : '收藏單字');
    button.classList.toggle('is-saved', isSaved);
    button.textContent = isSaved ? '★' : '☆';
    button.disabled = !cloudSyncEnabled;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
  });
}
function updateSyncLockedUI() {
  const input = document.querySelector('.completion-check input');
  const note = document.querySelector('[data-sync-note]');
  if (input) {
    input.disabled = !cloudSyncEnabled;
    input.title = cloudSyncEnabled ? '' : '請先在設定輸入密碼開啟同步';
  }
  if (note) note.classList.toggle('hidden', cloudSyncEnabled);
  updateStarButtons();
}
function toggleSavedWord(button) {
  if (!cloudSyncEnabled) return;
  const entry = {
    normalized: normalizeSaveKey(button.dataset.normalized || button.dataset.saveWord),
    word: button.dataset.saveWord || '',
    zh: button.dataset.zh || '',
    ipa: button.dataset.ipa || '',
    pos: button.dataset.pos || '',
    articleId: articleMeta.id,
    articleTitle: articleMeta.title,
    articleFile: articleMeta.file,
    savedAt: new Date().toISOString()
  };
  const willSave = !savedWords.has(entry.normalized);
  if (willSave) savedWords.add(entry.normalized); else savedWords.delete(entry.normalized);
  updateLocalSavedWord(entry, willSave);
  updateStarButtons();
  sendDataCommand(willSave ? 'saveWord' : 'removeSavedWord', entry);
}
function placePopover(popover, x, y) {
  const margin = 14;
  popover.style.left = x + margin + 'px';
  popover.style.top = y + margin + 'px';
  requestAnimationFrame(function () {
    const rect = popover.getBoundingClientRect();
    let left = x + margin;
    let top = y + margin;
    if (rect.right > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - rect.width - margin);
    if (rect.bottom > window.innerHeight - margin) top = Math.max(margin, y - rect.height - margin);
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
  });
}
function speakWord(raw) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(raw);
  utterance.lang = 'en-US';
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
}
const popover = document.querySelector('[data-lookup-popover]');
const completionInput = document.querySelector('.completion-check input');
loadLocalSavedWords();
if (completionInput) {
  const localDone = localStorage.getItem('englishCoach.articleDone.' + articleMeta.id);
  if (localDone !== null) completionInput.checked = localDone === 'true';
  completionInput.addEventListener('change', function () {
    if (!cloudSyncEnabled) { completionInput.checked = false; updateSyncLockedUI(); return; }
    localStorage.setItem('englishCoach.articleDone.' + articleMeta.id, String(completionInput.checked));
    sendDataCommand('setArticleDone', { article: articleMeta, done: completionInput.checked });
  });
}
updateSyncLockedUI();
window.addEventListener('message', function (event) {
  const message = event.data || {};
  if (message.type === 'english-coach:sync-state') {
    cloudSyncEnabled = !!message.enabled;
    localStorage.setItem('englishCoach.syncEnabled', String(cloudSyncEnabled));
    updateSyncLockedUI();
  }
  if (message.type === 'english-coach:saved-words') {
    savedWords.clear();
    (message.words || []).forEach(function (item) { const key = normalizeSaveKey(item && (item.normalized || item.word || item)); if (key) savedWords.add(key); });
    updateStarButtons();
  }
  if (message.type === 'english-coach:article-states' && completionInput) {
    const state = message.articles && message.articles[articleMeta.id];
    if (typeof state === 'boolean') completionInput.checked = state;
  }
});
if (parentWindow) parentWindow.postMessage({ type: 'english-coach:article-ready', article: articleMeta }, '*');
document.addEventListener('mouseover', function (event) {
  const sentence = event.target.closest('.lesson-sentence');
  if (sentence) activatePair(sentence.dataset.pair);
});
document.addEventListener('focusin', function (event) {
  const sentence = event.target.closest('.lesson-sentence');
  if (sentence) activatePair(sentence.dataset.pair);
});
document.addEventListener('mouseout', function (event) {
  if (!event.relatedTarget || !event.relatedTarget.closest || !event.relatedTarget.closest('.lesson-sentence')) activatePair(null);
});
document.addEventListener('click', function (event) {
  const starButton = event.target.closest('[data-save-word]');
  if (starButton) { event.stopPropagation(); if (!starButton.disabled) toggleSavedWord(starButton); return; }
  const speakButton = event.target.closest('[data-speak-word]');
  if (speakButton) { event.stopPropagation(); speakWord(speakButton.dataset.speakWord); return; }
  const word = event.target.closest('.word');
  if (!word) { if (!event.target.closest('.lookup-popover')) popover.classList.remove('visible'); return; }
  event.stopPropagation();
  const raw = word.dataset.word;
  placePopover(popover, event.clientX, event.clientY);
  popover.innerHTML = renderLookup(localLookup(raw), raw);
  popover.classList.add('visible');
});
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') popover.classList.remove('visible');
});
`;
}

async function convertMarkdownArticle(item) {
  try {
    await fs.access(item.mdPath);
  } catch {
    return;
  }

  const markdown = await fs.readFile(item.mdPath, 'utf8');
  const lines = markdown.split(/\r?\n/);
  const articleHeading = findLine(lines, /^##\s+(今日文章|Reading Article)\s*$/);
  if (articleHeading === -1) throw new Error(`Cannot find article section in ${item.mdPath}`);

  const englishTitleIndex = findLine(lines, /^###\s+(.+)$/, articleHeading + 1);
  if (englishTitleIndex === -1) throw new Error(`Cannot find English article title in ${item.mdPath}`);

  const englishTitle = lines[englishTitleIndex].replace(/^###\s+/, '').trim();
  const articleEnd = findLine(lines, /^##\s+(15 個重要單字|Vocabulary)\s*$/, englishTitleIndex + 1);
  if (articleEnd === -1) throw new Error(`Cannot find post-article section in ${item.mdPath}`);

  const introLines = lines.slice(1, articleHeading);
  const articleLines = lines.slice(englishTitleIndex + 1, articleEnd);
  const lessonLines = lines.slice(articleEnd);
  const dictionary = dictionaryScript(parseVocabulary(markdown));
  const coverRelative = `../assets/covers/${item.id}.png?v=${coverVersion}`;

  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(item.displayTitle)}</title>
<style>
${css()}
</style>
</head>
<body>
<main class="lesson-shell">
<figure class="cover-banner">
  <img src="${escapeAttr(coverRelative)}" alt="${escapeAttr(item.title)}封面圖">
</figure>
<header class="lesson-header">
<p class="lesson-kicker"><button type="button" class="word" data-word="Daily">Daily</button> <button type="button" class="word" data-word="English">English</button> <button type="button" class="word" data-word="Coach">Coach</button></p>
<h1>${escapeHtml(item.displayTitle)}</h1>
<p class="core-tag" aria-label="核心標籤"><span>${escapeHtml(item.tag)}</span></p>
<p class="lesson-subtitle">${wrapEnglishWords(escapeHtml(englishTitle))}</p>
</header>
${introLines.some((line) => line.trim()) ? `<section class="lesson-prose review">
${renderMarkdown(introLines)}
</section>` : ''}
<section class="article-section" aria-labelledby="article-title">
<h2 id="article-title">文章</h2>
<div class="article-pairs">
${renderArticlePairs(articleLines)}
</div>
</section>
<section class="lesson-prose">
${renderMarkdown(lessonLines)}
</section>
<label class="completion-check"><input type="checkbox"> 我已完成今天的英文學習 <span class="sync-note" data-sync-note>(尚未同步)</span></label>
</main>
<div class="lookup-popover" data-lookup-popover></div>
<script>
${lessonScript(dictionary)}
</script>
</body>
</html>
`;
  await fs.writeFile(item.htmlPath, html, 'utf8');
}

function ensureCoreTagCss(html) {
  if (html.includes('.core-tag')) return html;
  const cssBlock = `.core-tag { margin: 14px 0 0; }
.core-tag span { display: inline-flex; align-items: center; min-height: 28px; border: 1px solid rgba(15, 118, 110, .28); border-radius: 4px; background: #e8f4f1; color: var(--accent-ink); padding: 3px 9px; font-size: .86rem; font-weight: 800; letter-spacing: 0; }
`;
  return html.replace(/(\.lesson-subtitle\s*\{[^}]+\}\s*)/, `$1${cssBlock}`);
}

function ensureCoreTagMarkup(html, item) {
  const tagMarkup = `<p class="core-tag" aria-label="核心標籤"><span>${escapeHtml(item.tag)}</span></p>`;
  if (/<p class="core-tag"[\s\S]*?<\/p>/.test(html)) {
    return html.replace(/<p class="core-tag"[\s\S]*?<\/p>/, tagMarkup);
  }
  return html.replace(/(<h1>[\s\S]*?<\/h1>)/, `$1\n${tagMarkup}`);
}

async function updateArticlePage(item) {
  try {
    let html = await fs.readFile(item.htmlPath, 'utf8');
    html = ensureCoreTagCss(html);
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(item.displayTitle)}</title>`);
    html = html.replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${escapeHtml(item.displayTitle)}</h1>`);
    html = html.replace(
      new RegExp(`src="\\.\\./assets/covers/${item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.png(?:\\?[^"]*)?"`),
      `src="../assets/covers/${item.id}.png?v=${coverVersion}"`,
    );
    html = ensureCoreTagMarkup(html, item);
    await fs.writeFile(item.htmlPath, html, 'utf8');
  } catch {
    // The converter may create it in a later step, or the file may not exist yet.
  }
}

function catalogJs() {
  const rows = [...catalog].sort((a, b) => {
    return b.date.localeCompare(a.date) || b.number - a.number;
  }).map((item) => `  {
    id: '${item.id}',
    title: '${item.displayTitle}',
    date: '${item.date}',
    tag: '${item.tag}',
    file: '${item.file}'
  }`);
  return `const articles = [
${rows.join(',\n')}
].sort(function (a, b) {
  return b.date.localeCompare(a.date) || b.title.localeCompare(a.title);
});`;
}

function updateIndexCss(html) {
  let next = html;
  if (!next.includes('.article-title-row')) {
    next = next.replace(
      /.article-title \{ display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 750; line-height: 1.35; \}/,
      `.article-title-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
.article-title { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 750; line-height: 1.35; }
.article-tag { flex: 0 0 auto; display: inline-flex; align-items: center; min-height: 19px; border: 1px solid rgba(15, 118, 110, .24); border-radius: 3px; background: #e8f4f1; color: var(--accent); padding: 1px 5px; font-size: .68rem; font-weight: 850; line-height: 1.1; }`,
    );
  }
  if (!next.includes('.article-item.done .article-tag')) {
    next = next.replace(
      '.article-item.done .article-title { color: #586052; font-weight: 650; }',
      `.article-item.done .article-title { color: #586052; font-weight: 650; }
.article-item.done .article-tag { border-color: rgba(88, 96, 82, .24); background: #f5f6f0; color: #687260; }`,
    );
  }
  return next;
}

function updateIndexRender(html) {
  let next = html;
  if (!next.includes('function escapeHtml(value)')) {
    next = next.replace(
      'function renderList() {',
      `function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}
function renderList() {`,
    );
  }
  next = next.replace(
    /'<span class="article-date">' \+ article\.date \+ '<\/span><span class="article-title">' \+ article\.title \+ '<\/span><\/button>';/,
    `'<span class="article-date">' + escapeHtml(article.date) + '</span><span class="article-title-row"><span class="article-title">' + escapeHtml(article.title) + '</span><span class="article-tag">' + escapeHtml(article.tag || '') + '</span></span></button>';`,
  );
  next = next.replace('titleNode.textContent = article.title;', 'titleNode.textContent = article.title;');
  return next;
}

async function updateIndex() {
  let html = await fs.readFile(indexPath, 'utf8');
  html = updateIndexCss(html);
  html = html.replace(/const articles = \[[\s\S]*?\]\.sort\(function \(a, b\) \{\s*return b\.date\.localeCompare\(a\.date\) \|\| b\.title\.localeCompare\(a\.title\);\s*\}\);/, catalogJs());
  html = updateIndexRender(html);
  await fs.writeFile(indexPath, html, 'utf8');
}

async function main() {
  for (const item of catalog) {
    await convertMarkdownArticle(item);
  }
  for (const item of catalog) {
    await updateArticlePage(item);
  }
  await updateIndex();

  const missingCovers = [];
  for (const item of catalog) {
    try {
      await fs.access(item.coverPath);
    } catch {
      missingCovers.push(item.coverPath);
    }
  }
  if (missingCovers.length) {
    console.warn(`Missing cover images:\n${missingCovers.join('\n')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
