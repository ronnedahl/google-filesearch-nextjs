# Google File Search RAG-implementering med Next.js

## Översikt
Google File Search är en managed RAG-lösning som hanterar vektorisering, chunking och semantic search automatiskt. Ingen extern vektordatabas behövs - allt körs via Gemini API.

## Arkitektur

### Next.js App Router
- API Routes för backend-logik
- Server Components för initial rendering
- Client Components för interaktivitet
- Automatisk file-based routing

### Struktur
```
app/
├── api/
│   ├── create-store/
│   │   └── route.ts
│   ├── upload-pdf/
│   │   └── route.ts
│   └── chat/
│       └── route.ts
├── components/
│   ├── PDFUploader.tsx
│   ├── ChatInterface.tsx
│   └── MessageList.tsx
├── page.tsx
└── layout.tsx
```

## Installation och Setup

### Dependencies
```bash
npm install @google/generative-ai
npm install -D @types/node
```

### Miljövariabler (.env.local)
```
GOOGLE_API_KEY=din_api_nyckel_från_google_ai_studio
```

### Typ-definitioner (lib/types.ts)
```typescript
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export interface Citation {
  title: string;
  text: string;
  uri?: string;
}

export interface ChatRequest {
  storeId: string;
  message: string;
  history?: Message[];
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}
```

## API Routes

### 1. Skapa File Search Store
**app/api/create-store/route.ts**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST() {
  try {
    const store = await genAI.fileSearchStores.create({
      displayName: `chat-${Date.now()}`
    });
    
    return NextResponse.json({ 
      storeId: store.name 
    });
  } catch (error) {
    console.error('Store creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create store' },
      { status: 500 }
    );
  }
}
```

### 2. Ladda upp PDF
**app/api/upload-pdf/route.ts**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const storeId = formData.get('storeId') as string;

    if (!file || !storeId) {
      return NextResponse.json(
        { error: 'Missing file or storeId' },
        { status: 400 }
      );
    }

    // Spara filen temporärt
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempPath = join('/tmp', file.name);
    await writeFile(tempPath, buffer);

    // Ladda upp till File Search Store
    const operation = await genAI.fileSearchStores.uploadToFileSearchStore({
      file: tempPath,
      fileSearchStoreName: storeId,
      config: {
        displayName: file.name,
        chunkingConfig: {
          whiteSpaceConfig: {
            maxTokensPerChunk: 300,
            maxOverlapTokens: 30
          }
        }
      }
    });

    // Vänta på indexering
    let status = operation;
    while (!status.done) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      status = await genAI.operations.get(operation.name);
    }

    // Rensa temporär fil
    await unlink(tempPath);

    return NextResponse.json({ 
      success: true, 
      fileName: file.name 
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}

// Tillåt större filer
export const config = {
  api: {
    bodyParser: false,
  },
};
```

### 3. Chat med File Search
**app/api/chat/route.ts**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, ChatResponse, Citation } from '@/lib/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { storeId, message, history = [] }: ChatRequest = await request.json();

    if (!storeId || !message) {
      return NextResponse.json(
        { error: 'Missing storeId or message' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      tools: [{
        fileSearch: {
          fileSearchStoreNames: [storeId]
        }
      }]
    });

    // Bygg conversation history
    const chatHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const response = result.response;

    // Extrahera citations
    const citations: Citation[] = response.candidates[0]?.groundingMetadata?.groundingChunks?.map(chunk => ({
      title: chunk.retrievedContext.title,
      text: chunk.retrievedContext.text,
      uri: chunk.retrievedContext.uri
    })) || [];

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
```

## Client Components

### 1. PDF Uploader
**app/components/PDFUploader.tsx**
```tsx
'use client';

import { useState } from 'react';

interface PDFUploaderProps {
  onUploadComplete: (storeId: string) => void;
}

export function PDFUploader({ onUploadComplete }: PDFUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Endast PDF-filer tillåtna');
      return;
    }

    setUploading(true);
    setError('');
    setProgress('Skapar lagring...');

    try {
      // 1. Skapa File Search Store
      const storeResponse = await fetch('/api/create-store', {
        method: 'POST'
      });

      if (!storeResponse.ok) {
        throw new Error('Kunde inte skapa lagring');
      }

      const { storeId } = await storeResponse.json();

      // 2. Ladda upp PDF
      setProgress('Laddar upp och indexerar PDF...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storeId', storeId);

      const uploadResponse = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Kunde inte ladda upp PDF');
      }

      setProgress('Klar!');
      setTimeout(() => {
        onUploadComplete(storeId);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      setProgress('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Ladda upp PDF</h2>
      
      <div className="mb-4">
        <label
          htmlFor="pdf-upload"
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-10 h-10 mb-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Klicka för att ladda upp</span> eller dra och släpp
            </p>
            <p className="text-xs text-gray-500">PDF-filer (max 20MB)</p>
          </div>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {uploading && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">{progress}</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full"></div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
```

### 2. Chat Interface
**app/components/ChatInterface.tsx**
```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/lib/types';

interface ChatInterfaceProps {
  storeId: string;
}

export function ChatInterface({ storeId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId,
          message: input,
          history: messages
        })
      });

      if (!response.ok) {
        throw new Error('Kunde inte skicka meddelande');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        citations: data.citations
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Ett fel uppstod. Försök igen.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-w-4xl mx-auto bg-white rounded-lg shadow">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p>Ställ en fråga om PDF-dokumentet</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <p className="text-sm font-semibold mb-2">Källor:</p>
                  <div className="space-y-2">
                    {msg.citations.map((cite, i) => (
                      <details key={i} className="text-sm">
                        <summary className="cursor-pointer hover:underline">
                          {cite.title}
                        </summary>
                        <p className="mt-2 pl-4 text-gray-700">
                          {cite.text.substring(0, 200)}...
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ställ en fråga om PDF:en..."
            disabled={loading}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Skickar...' : 'Skicka'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Main Page
**app/page.tsx**
```tsx
'use client';

import { useState } from 'react';
import { PDFUploader } from './components/PDFUploader';
import { ChatInterface } from './components/ChatInterface';

export default function Home() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleUploadComplete = (id: string) => {
    setStoreId(id);
  };

  const resetChat = () => {
    setStoreId(null);
    setFileName('');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PDF Chat med Google File Search
          </h1>
          <p className="text-gray-600">
            Ladda upp en PDF och chatta om innehållet
          </p>
        </header>

        {!storeId ? (
          <PDFUploader onUploadComplete={handleUploadComplete} />
        ) : (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Chattar om: <span className="font-semibold">{fileName || 'PDF-dokument'}</span>
              </p>
              <button
                onClick={resetChat}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Ladda upp ny PDF
              </button>
            </div>
            <ChatInterface storeId={storeId} />
          </div>
        )}
      </div>
    </main>
  );
}
```

### 4. Layout med Tailwind
**app/layout.tsx**
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PDF Chat - Google File Search',
  description: 'Chatta med dina PDF-dokument med AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

## Tailwind Setup

**tailwind.config.ts**
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        'bounce': 'bounce 1s infinite',
      },
      keyframes: {
        bounce: {
          '0%, 100%': {
            transform: 'translateY(-25%)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

## Viktiga Next.js-specifika punkter

### Edge Runtime (Optional)
För snabbare API-responses kan du använda Edge Runtime:
```typescript
// app/api/chat/route.ts
export const runtime = 'edge';
```

### Server Actions (Alternativ till API Routes)
Du kan också använda Server Actions för enklare dataflöde:

**app/actions.ts**
```typescript
'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function createStore() {
  const store = await genAI.fileSearchStores.create({
    displayName: `chat-${Date.now()}`
  });
  return { storeId: store.name };
}

export async function sendChatMessage(
  storeId: string,
  message: string,
  history: any[]
) {
  // ... samma logik som API route
}
```

### Streaming Responses (Advanced)
För realtidsresponser:
```typescript
// app/api/chat/route.ts
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Stream response chunks
      const result = await chat.sendMessageStream(message);
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        controller.enqueue(encoder.encode(text));
      }
      
      controller.close();
    }
  });

  return new Response(stream);
}
```

## Deployment (Vercel)

### Miljövariabler
Lägg till `GOOGLE_API_KEY` i Vercel Dashboard under Settings → Environment Variables

### Fil-uppladdning limits
Vercel Free: Max 4.5MB body size
Vercel Pro: Max 50MB

För större filer, använd signed URLs eller chunked upload.

### Build Command
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

## Felsökning

### CORS-problem
Next.js API routes har CORS aktiverat by default. Om problem uppstår:
```typescript
export async function POST(request: NextRequest) {
  // ...
  return NextResponse.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
  });
}
```

### File Upload Size
Justera i `next.config.js`:
```javascript
module.exports = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
```

### TypeScript Errors
Se till att `@types/node` är installerat och `tsconfig.json` har:
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

## Kostnader och Begränsningar

### Google File Search
- **Indexering**: $0.15 per miljon tokens (engångskostnad)
- **Queries**: Ingen extra kostnad utöver Gemini API
- **Lagring**: Gratis och persistent
- **Max storlek**: 20GB per store
- **Max antal stores**: 10 per Google Cloud-projekt

### Next.js/Vercel
- **Hobby Plan**: Gratis, 100GB bandwidth/månad
- **Pro Plan**: $20/månad, 1TB bandwidth
- **Serverless Function Timeout**: 10s (Hobby), 60s (Pro)

## Best Practices

1. **Validera PDF-filer** på både client och server
2. **Implementera rate limiting** för API-routes
3. **Cacha storeId** i localStorage för att undvika onödiga re-uploads
4. **Använd React Suspense** för bättre UX
5. **Implementera error boundaries** för robust felhantering
6. **Logga alla API-anrop** för debugging
7. **Sätt timeout** på File Search-operationer (max 60s)

## Exempel på förbättringar

- **Flera PDFs**: Låt användare ladda upp flera dokument till samma store
- **Historik**: Spara tidigare konversationer i database (Postgres/MongoDB)
- **Autentisering**: Lägg till NextAuth.js för user management
- **Delning**: Dela conversations via unika länkar
- **Export**: Exportera chat-historik som PDF eller Markdown