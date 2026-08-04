async function translateChunk(chunk: string, targetLang: string): Promise<string> {
  if (!chunk.trim()) return chunk;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`;
    const response = await fetch(url);
    const data = await response.json();

    // Google Translate API returns an array of translated segments in data[0]
    if (data && data[0] && Array.isArray(data[0])) {
      return data[0].map((segment: unknown[]) => typeof segment[0] === 'string' ? segment[0] : '').join('');
    }
    return chunk;
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

      // Google's `sl=auto` detects a single source language for the whole query.
      // A long block that mixes mostly-English prose with a bit of embedded
      // Chinese (e.g. a table with Chinese labels) can get misdetected as
      // already being the target language, which makes Google echo the text
      // back unchanged instead of translating it. Splitting on paragraph
      // boundaries keeps detection scoped to each paragraph so mixed-language
      // messages still translate correctly.
      const paragraphs = block.split(/(\n\s*\n)/);
      const translatedParagraphs = await Promise.all(
        paragraphs.map((p) => (/^\n\s*\n$/.test(p) ? p : translateChunk(p, targetLang)))
      );
      return translatedParagraphs.join('');
    })
  );

  return translatedBlocks.join('');
}
