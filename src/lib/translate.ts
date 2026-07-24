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

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(block)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        // Google Translate API returns an array of translated segments in data[0]
        if (data && data[0] && Array.isArray(data[0])) {
          return data[0].map((segment: unknown[]) => typeof segment[0] === 'string' ? segment[0] : '').join('');
        }
        return block;
      } catch (err) {
        console.error('Translation error:', err);
        return block;
      }
    })
  );

  return translatedBlocks.join('');
}
