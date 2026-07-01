const SPREADSHEET_ID = '';
const ARTICLE_SHEET = '文章進度';
const VOCAB_SHEET = '收藏單字';

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  if (params.action === 'write') {
    const result = handleCommand(params.command, parsePayload(params.payload));
    return outputResponse(result, params.callback);
  }
  if (params.action === 'list') {
    const data = {
      ok: true,
      articles: readArticles(),
      words: readWords()
    };
    return outputResponse(data, params.callback);
  }
  return outputResponse({ ok: true }, params.callback);
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    return outputJson(handleCommand(body.command, body.payload || {}));
  } catch (error) {
    return outputJson({ ok: false, error: String(error) });
  }
}

function handleCommand(command, payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (command === 'syncArticles') syncArticles(payload.articles || []);
    if (command === 'setArticleDone') setArticleDone(payload.article || {}, payload.done);
    if (command === 'saveWord') saveWord(payload);
    if (command === 'removeSavedWord') removeSavedWord(payload.normalized || payload.word);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    lock.releaseLock();
  }
}

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(payload);
  } catch (error) {
    return {};
  }
}

function outputJson(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function outputResponse(value, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(value) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return outputJson(value);
}

function getBook() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name, headers) {
  const book = getBook();
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = firstRow.some(String);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRows(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() || [];
  return values
    .filter(function (row) { return row.some(String); })
    .map(function (row, index) {
      const item = { rowNumber: index + 2 };
      headers.forEach(function (header, col) {
        item[header] = row[col];
      });
      return item;
    });
}

function setArticleDone(article, done) {
  const headers = ['articleId', 'title', 'file', 'date', 'done', 'updatedAt'];
  const sheet = getSheet(ARTICLE_SHEET, headers);
  const rows = readRows(sheet);
  const articleId = article.id || '';
  if (!articleId) return;
  const existing = rows.find(function (row) { return row.articleId === articleId; });
  const values = [
    articleId,
    article.title || '',
    article.file || '',
    (articleId.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0],
    !!done,
    new Date()
  ];
  if (existing) sheet.getRange(existing.rowNumber, 1, 1, headers.length).setValues([values]);
  else sheet.appendRow(values);
}

function syncArticles(articles) {
  const headers = ['articleId', 'title', 'file', 'date', 'done', 'updatedAt'];
  const sheet = getSheet(ARTICLE_SHEET, headers);
  const rows = readRows(sheet);
  (articles || []).forEach(function (article) {
    const articleId = article.id || '';
    if (!articleId) return;
    const existing = rows.find(function (row) { return row.articleId === articleId; });
    const values = [
      articleId,
      article.title || '',
      article.file || '',
      article.date || (articleId.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0],
      existing ? existing.done : false,
      new Date()
    ];
    if (existing) sheet.getRange(existing.rowNumber, 1, 1, headers.length).setValues([values]);
    else sheet.appendRow(values);
  });
}

function saveWord(entry) {
  const headers = ['normalized', 'word', 'zh', 'ipa', 'pos', 'articleId', 'articleTitle', 'articleFile', 'savedAt', 'updatedAt'];
  const sheet = getSheet(VOCAB_SHEET, headers);
  const rows = readRows(sheet);
  const normalized = normalizeWord(entry.normalized || entry.word);
  if (!normalized) return;
  const existing = rows.find(function (row) { return normalizeWord(row.normalized || row.word) === normalized; });
  const values = [
    normalized,
    entry.word || normalized,
    entry.zh || '',
    entry.ipa || '',
    entry.pos || '',
    entry.articleId || '',
    entry.articleTitle || '',
    entry.articleFile || '',
    entry.savedAt ? new Date(entry.savedAt) : new Date(),
    new Date()
  ];
  if (existing) sheet.getRange(existing.rowNumber, 1, 1, headers.length).setValues([values]);
  else sheet.appendRow(values);
}

function removeSavedWord(raw) {
  const headers = ['normalized', 'word', 'zh', 'ipa', 'pos', 'articleId', 'articleTitle', 'articleFile', 'savedAt', 'updatedAt'];
  const sheet = getSheet(VOCAB_SHEET, headers);
  const rows = readRows(sheet);
  const normalized = normalizeWord(raw);
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (normalizeWord(row.normalized || row.word) === normalized) {
      sheet.deleteRow(row.rowNumber);
    }
  }
}

function readArticles() {
  const headers = ['articleId', 'title', 'file', 'date', 'done', 'updatedAt'];
  const sheet = getSheet(ARTICLE_SHEET, headers);
  const result = {};
  readRows(sheet).forEach(function (row) {
    if (row.articleId) result[row.articleId] = row.done === true || row.done === 'TRUE' || row.done === 'true';
  });
  return result;
}

function readWords() {
  const headers = ['normalized', 'word', 'zh', 'ipa', 'pos', 'articleId', 'articleTitle', 'articleFile', 'savedAt', 'updatedAt'];
  const sheet = getSheet(VOCAB_SHEET, headers);
  return readRows(sheet).map(function (row) {
    return {
      normalized: normalizeWord(row.normalized || row.word),
      word: row.word || row.normalized,
      zh: row.zh || '',
      ipa: row.ipa || '',
      pos: row.pos || '',
      articleId: row.articleId || '',
      articleTitle: row.articleTitle || '',
      articleFile: row.articleFile || '',
      savedAt: row.savedAt ? new Date(row.savedAt).toISOString() : ''
    };
  }).filter(function (row) {
    return row.normalized;
  });
}

function normalizeWord(raw) {
  return String(raw || '').toLowerCase().trim().replace(/^'+|'+$/g, '');
}
