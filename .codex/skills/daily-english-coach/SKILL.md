---
name: daily-english-coach
description: Generate recurring or on-demand daily English learning lessons for a Traditional Chinese-speaking CEFR B1 learner steadily moving toward B2. Use when creating self-contained interactive HTML English lessons, long-term English coaching materials, bilingual magazine-style reading lessons, spaced-review study content, or scheduled daily English practice files.
---

# Daily English Coach

## Goal

Create one complete daily English lesson as a self-contained interactive HTML file for a learner whose level is about CEFR B1, with reading stronger than writing. Keep the lesson understandable but gently challenging: about 80% familiar B1 English and about 20% new B2 vocabulary, phrases, and grammar.

Use Traditional Chinese for explanations, translations, instructions, and summaries. Use English only for the article, examples, and English practice sentences.

## Workflow

1. Determine the target date from the user's request, the automation date, or the local current date.
2. Work in the current folder unless the user specifies another output folder.
3. Search the output folder for previous lesson files named like `YYYY-MM-DD_*.html`; also read legacy `YYYY-MM-DD_*.md` files if they exist.
4. Build spaced review from lessons dated 1, 3, 7, 14, and 30 days before the target date.
5. Choose a fresh topic that has knowledge, story, and insight; avoid repeating recent topics when previous lessons exist.
6. Write the full lesson in HTML and save it as a `.html` file.
7. If the workspace uses the parent `index.html` reading library, save new lesson files under `articles/`, add the new article metadata to the `articles` array in the parent `index.html`, and keep that array sorted from newest to oldest.
8. When the reading library is connected to Google Sheets, make sure new article metadata can be synchronized to the `文章進度` sheet through the parent page's `syncArticles` flow. Do not require the learner to manually create a row for each new article.
9. Keep the final reply short and include the saved file path.

## File Rules

- Save exactly one lesson file as `.html` unless the user asks otherwise. Do not create a `.md` file by default.
- In addition to the lesson HTML, generate one separate 16:9 cover image for each article, save it in the workspace (for example under `assets/covers/`), and place it at the very top of the lesson page as a Banner before the title/header.
- Use filename format `YYYY-MM-DD_中文文章標題.html`.
- The filename title after the date must be Traditional Chinese, not English, romanization, or mixed English-Chinese. Example: `2026-07-01_小鎮最後一家電影院.html`.
- Make the title concise and filesystem-safe: remove or replace `<>:"/\|?*`, trim extra spaces, and avoid overly long filenames.
- Put the same Traditional Chinese title as the main `<h1>` title at the top of the HTML file. If an English title is useful, add it as a short subtitle inside the HTML, not in the filename.
- The HTML must work by opening the file directly in a browser. Inline the required CSS and JavaScript; do not require a build step.
- End the file with this checkbox:

```html
<label class="completion-check"><input type="checkbox"> 我已完成今天的英文學習 <span class="sync-note" data-sync-note>(尚未同步)</span></label>
```

- In reading-library mode, the completion checkbox and saved-word star buttons must be disabled until the parent `index.html` reports that Google Sheet sync has been unlocked with the password. When sync is locked, show `(尚未同步)` beside the completion text. Hide that note after sync is unlocked.

## HTML Rendering Requirements

Render the lesson as a complete HTML document with semantic structure and readable styling.

- Preserve Markdown-like formatting in the rendered page: headings, bold text, italic text when used, inline code, code blocks, ordered lists, unordered lists, links, and blockquotes.
- Use Traditional Chinese UI text.
- Keep the page calm and readable for long-form study: comfortable line height, responsive width, and good contrast.
- Set main reading/body text at about 150% of the previous default lesson size while keeping headings proportionally balanced and responsive.
- Keep CSS and JavaScript inside the file unless the user explicitly asks for separate assets.
- Avoid visible instructional UI copy explaining how the interactions work; make the affordances discoverable through hover, cursor, and polished behavior.

## Spaced Review

If usable historical content exists, start the lesson with `## 複習區`.

Review priority:

- 1 day before
- 3 days before
- 7 days before
- 14 days before
- 30 days before

Extract review items from previous generated lessons when possible:

- 5 old vocabulary items
- 2 old grammar points
- 3 old collocations

Keep review concise. Include the original English item, Traditional Chinese meaning or reminder, and one quick example or prompt. Avoid duplicates. If there is no usable historical content, omit the review section entirely.

## Article Requirements

Write a magazine-like English article, not a school textbook passage.

- English article length: about 1000 to 1500 English words.
- Difficulty: B1 base with a small, controlled amount of B2 language.
- Tone: interesting, story-rich, knowledgeable, and reflective.
- Avoid sudden C1-level jumps or a large pile of difficult words.
- Prefer common useful words over rare academic vocabulary.
- Gradually raise difficulty only when the user's performance or prior feedback suggests readiness.

Rotate topics across days, including:

- game design
- recent game news
- music
- plot and storytelling
- psychology
- philosophy
- history
- AI
- technology
- business
- productivity
- space
- mythology
- science
- film
- interesting people
- true events
- short stories

For recent news, current facts, prices, laws, schedules, or anything likely to have changed, browse and verify before writing. Use clear dates for time-sensitive facts. If sources are used, include a concise `## 資料來源` section with links near the end of the lesson.

## Interactive Bilingual Article Format

For every article paragraph, place the English paragraph first and its Traditional Chinese translation immediately after it. Do not place all translations at the end.

Do not add visible labels such as `English`, `中文翻譯`, `英文`, or similar markers before each paragraph pair.

In the HTML article, use this local structure for each paragraph pair:

```html
<div class="paragraph-pair">
  <p class="article-paragraph english">
    <span class="lesson-sentence sentence-en" data-pair="p01-s01">English sentence here.</span>
  </p>
  <p class="article-paragraph chinese">
    <span class="lesson-sentence sentence-zh" data-pair="p01-s01">對應的中文翻譯句。</span>
  </p>
</div>
```

Make the Traditional Chinese translation natural and fluent. Translate meaning and tone, not word by word.

Interactive behavior requirements:

- Split the English article and the Traditional Chinese translation into sentence spans.
- Assign matching English and Chinese sentence spans the same `data-pair` value.
- When the cursor points at an English sentence, highlight that English sentence and the corresponding Chinese sentence at the same time.
- When the cursor points at a Chinese sentence, highlight that Chinese sentence and the corresponding English sentence at the same time.
- Use different highlight colors for English and Chinese sentences.
- If one translated sentence naturally corresponds to two short source sentences, reuse the same `data-pair` value so the whole corresponding group highlights together.
- Make English words throughout the entire lesson clickable, including the article, vocabulary section, grammar section, collocations, confusing words, translation exercises, speaking practice, and any English title or examples.
- When a learner clicks an English word, show a small popup near the cursor with:
  - the word
  - Traditional Chinese meaning
  - IPA
  - part of speech
  - a pronunciation audio button that speaks the word in English
  - a star button for saving or unsaving the word
- The popup star button must prevent duplicate saved words by normalized lowercase word. In reading-library mode, keep the star button disabled until sync is unlocked, then communicate save/remove events to the parent page so the Google Sheet `收藏單字` sheet can be updated. When opened directly, it may use localStorage only after the saved sync-unlocked state exists.
- Include an embedded JavaScript dictionary for at least all 15 important vocabulary words and key B2/content words from the article. Normalize case and simple inflections when looking up clicked words. If an unlisted word is clicked, show a graceful fallback instead of breaking the page.
- Prefer the browser Web Speech API for pronunciation. If speech synthesis is unavailable, keep the audio button disabled gracefully.

## Required Lesson Sections

After the article, include all sections below in this order.

### 15 個重要單字
Choose common, genuinely useful words from the article. For each item include:

- English
- IPA
- part of speech
- Traditional Chinese meaning
- practical usage explanation in Traditional Chinese
- English example sentence
- Traditional Chinese translation of the example sentence

Do not include a collocation line inside each vocabulary item. Do not prefix lines with visible labels such as `用法：`, `Example:`, `例句：`, or `中文翻譯：`; write the usage and example content directly.

### 文法重點

Include 3 to 5 grammar points that appear in the article. For each:

1. Rule
2. Traditional Chinese explanation
3. Example from the article
4. One new example
5. Common mistake

### 句型解析
Choose 3 natural sentences from the article. For each, explain in Traditional Chinese:

- why it sounds natural
- which parts can be replaced
- how to use it in daily English

### Collocations

Choose 5 common native-like collocations. Explain their use context in Traditional Chinese and include one English example.

### 易混淆字

Introduce 2 groups of easily confused words, such as `say / tell`, `job / work`, `look / watch / see`, or `remember / remind`. Explain differences in Traditional Chinese and include short examples.

### 翻譯練習

Create:

- 5 Traditional Chinese to English sentences
- 5 English to Traditional Chinese sentences

Prioritize today's vocabulary and grammar. Provide reference answers after the exercises, not beside each question.

### 口說練習

Choose 5 sentences from today's lesson for reading aloud. For each sentence, add Traditional Chinese notes about linking, stress, and pauses.

### 今日總結

Summarize what the learner learned today in Traditional Chinese, within 200 Chinese characters.

## Style Rules

- Keep all non-article teaching explanations in Traditional Chinese.
- Make the lesson feel like a high-quality English magazine plus a personal coach.
- Keep section titles clear and consistent.
- Do not add unrelated motivational filler.
- Do not ask clarifying questions for routine daily lesson generation; make reasonable choices from the current context.
