async function callTranslateApi(chunk: string, targetLang: string, sourceLang: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`;
  const response = await fetch(url);
  const data = await response.json();

  // Google Translate API returns an array of translated segments in data[0]
  if (data && data[0] && Array.isArray(data[0])) {
    return data[0].map((segment: unknown[]) => typeof segment[0] === 'string' ? segment[0] : '').join('');
  }
  return chunk;
}

// A chunk is "clearly Latin-script prose" if it has enough plain letters that
// it reads as English regardless of a few embedded target-language words.
function looksLikeLatinProse(chunk: string): boolean {
  return (chunk.match(/[A-Za-z]/g) || []).length >= 20;
}

async function translateChunk(chunk: string, targetLang: string): Promise<string> {
  if (!chunk.trim()) return chunk;

  try {
    const translated = await callTranslateApi(chunk, targetLang, 'auto');

    // `sl=auto` detects one source language per query. A chunk that's mostly
    // English but carries a few already-target-language words/labels (e.g.
    // "1=待付款, 2=待发货, ...") can get the whole chunk misdetected as
    // already being the target language, so Google echoes it back unchanged.
    // If that happened and the chunk clearly reads as English, force the
    // source language and retry once.
    if (translated === chunk && looksLikeLatinProse(chunk)) {
      return await callTranslateApi(chunk, targetLang, 'en');
    }
    return translated;
  } catch (err) {
    console.error('Translation error:', err);
    return chunk;
  }
}

export async function translateText(text: string, targetLang: string = 'zh-CN'): Promise<string> {
  // Split text into code blocks and normal text to protect code from translation
  const blocks = text.split(/(```[\s\S]*?```)/g);

  const translatedBlocks = await Promise.all(
    blocks.map(async (block) => {
      // If it's a code block (odd index if it starts with text, but checking prefix is safer)
      if (block.startsWith('```') && block.endsWith('```')) {
        return block;
      }

      // If it's just whitespace, return as is
      if (!block.trim()) {
        return block;
      }

      // Translate line-by-line rather than the whole block in one query.
      // Google's `sl=auto` detects a single source language per query, and a
      // multi-line block (e.g. a bullet list) that mixes mostly-English text
      // with embedded Chinese words/labels on just one line can get the
      // *entire* block misdetected as already being the target language.
      // Keeping detection scoped to each line limits the damage to that one
      // line (translateChunk has its own fallback for a line that's still
      // dense enough with target-language words to trip up detection alone).
      const lines = block.split(/(\n)/);
      const translatedLines = await Promise.all(
        lines.map((line) => (line === '\n' || !line.trim() ? line : translateChunk(line, targetLang)))
      );
      return translatedLines.join('');
    })
  );

  return translatedBlocks.join('');
}
