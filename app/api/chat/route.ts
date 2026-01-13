import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, ChatResponse, Citation, Message, ExtractedImage } from '@/lib/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

/**
 * Build system instruction with image references
 */
function buildSystemInstruction(images?: ExtractedImage[]): string {
  const baseInstruction = `Du är en dokumentassistent som ENDAST svarar baserat på innehållet i det bifogade PDF-dokumentet.

STRIKTA REGLER:
1. Svara ENDAST med information som finns i PDF-dokumentet
2. Om informationen INTE finns i dokumentet, säg tydligt: "Jag kan inte hitta information om detta i dokumentet."
3. Citera eller referera till specifika delar av dokumentet när du svarar
4. Gissa eller hitta på ALDRIG information
5. Om frågan är otydlig, be om förtydligande
6. Svara på samma språk som användaren skriver

Kom ihåg: Det är bättre att säga "jag vet inte" än att ge felaktig information.`;

  if (!images || images.length === 0) {
    return baseInstruction;
  }

  // Build image reference section
  const imageList = images
    .map(img => `- ${img.label} (${img.id})`)
    .join('\n');

  const imageInstruction = `

DOKUMENTETS SIDOR:
Dokumentet har följande sidor som bilder:
${imageList}

BILDREFERENSER:
- När du beskriver monteringssteg eller instruktioner, referera ALLTID till relevant sida
- Använd formatet: [Se ${images[0]?.label || 'Sida X'}] för att hänvisa till en specifik sida
- Om en fråga handlar om något visuellt (diagram, bild, illustration), ange vilken sida det finns på
- Exempel: "Enligt instruktionerna [Se Sida 3] ska du först..."`;

  return baseInstruction + imageInstruction;
}

export async function POST(request: NextRequest) {
  try {
    const { fileUri, message, history = [], images }: ChatRequest = await request.json();

    if (!fileUri || !message) {
      return NextResponse.json(
        { error: 'Missing fileUri or message' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: buildSystemInstruction(images),
    });

    // Build conversation history - include file reference in each user message
    const chatHistory = history.map((msg: Message) => ({
      role: msg.role,
      parts: msg.role === 'user'
        ? [
            { fileData: { mimeType: 'application/pdf', fileUri: fileUri } },
            { text: msg.content }
          ]
        : [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: chatHistory
    });

    // Always include file reference with each message
    const result = await chat.sendMessage([
      {
        fileData: {
          mimeType: 'application/pdf',
          fileUri: fileUri
        }
      },
      { text: message }
    ]);

    const response = result.response;

    // Extract citations from grounding metadata if available
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const citations: Citation[] = [];

    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web) {
          citations.push({
            title: chunk.web.title || 'Source',
            text: '',
            uri: chunk.web.uri
          });
        }
      }
    }

    const chatResponse: ChatResponse = {
      answer: response.text(),
      citations
    };

    return NextResponse.json(chatResponse);
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat' },
      { status: 500 }
    );
  }
}
