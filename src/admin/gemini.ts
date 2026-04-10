export async function generateTemplateName(base64Image: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Berikan 1 nama singkat yang kreatif (maksimal 3 kata) untuk desain bingkai photobooth ini. Tanpa tanda kutip. Contoh: Retro Strip, Blue Ocean, dll.' },
        { inlineData: { mimeType: 'image/png', data: base64Image } },
      ],
    }],
  };

  const delays = [1000, 2000, 4000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('HTTP error!');
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (error) {
      if (i === delays.length) throw error;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
  return '';
}
