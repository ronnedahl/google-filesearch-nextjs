# PDF Chat med Google AI

Chatta med dina PDF-dokument med hjälp av Google Gemini AI. Ladda upp en PDF och ställ frågor om innehållet - AI:n svarar baserat på dokumentet och refererar till specifika sidor.

![Demo](demo.png)

## Funktioner

- **PDF-uppladdning** - Ladda upp PDF-filer för AI-analys
- **Intelligent chat** - Ställ frågor och få svar baserade på dokumentinnehållet
- **Sidreferenser** - AI:n refererar till specifika sidor med klickbara länkar
- **Bildgalleri** - Se alla PDF-sidor som bilder med lightbox
- **Realtidsextraktion** - PDF-sidor extraheras automatiskt vid uppladdning

## Arkitektur

```
┌─────────────────────┐     ┌─────────────────────┐
│   Next.js Frontend  │────▶│  Python PDF Service │
│     (port 3000)     │     │     (port 8001)     │
└─────────────────────┘     └─────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│   Google Gemini AI  │     │   PyMuPDF (fitz)    │
│   (File Search)     │     │   Image Extraction  │
└─────────────────────┘     └─────────────────────┘
```

## Förutsättningar

- Node.js 18+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Google AI API-nyckel

## Installation

### 1. Klona repot

```bash
git clone https://github.com/your-username/google-file-search.git
cd google-file-search
```

### 2. Installera Next.js dependencies

```bash
npm install
```

### 3. Installera Python dependencies

```bash
cd pdf-service
uv sync
cd ..
```

### 4. Konfigurera miljövariabler

Skapa `.env.local` i root-mappen:

```env
GOOGLE_API_KEY=din_google_ai_api_nyckel
```

## Starta applikationen

### Terminal 1 - Python PDF Service

```bash
cd pdf-service
uv run uvicorn main:app --port 8001
```

### Terminal 2 - Next.js

```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i webbläsaren.

## Användning

1. **Ladda upp PDF** - Dra och släpp eller klicka för att välja en PDF-fil
2. **Vänta på bearbetning** - Filen laddas upp till Google AI och sidor extraheras
3. **Ställ frågor** - Skriv dina frågor i chatten
4. **Utforska sidor** - Klicka på sidreferenser eller bläddra i galleriet

## API-endpoints

### Next.js API

| Endpoint | Metod | Beskrivning |
|----------|-------|-------------|
| `/api/upload-pdf` | POST | Ladda upp PDF för analys |
| `/api/chat` | POST | Skicka chattmeddelande |

### Python Service

| Endpoint | Metod | Beskrivning |
|----------|-------|-------------|
| `/health` | GET | Hälsokontroll |
| `/extract` | POST | Extrahera PDF-sidor som bilder |
| `/images/{session}/{id}` | GET | Hämta extraherad bild |

## Tech Stack

**Frontend:**
- Next.js 16
- React 19
- Tailwind CSS
- TypeScript

**Backend:**
- Next.js API Routes
- Python FastAPI
- PyMuPDF (fitz)

**AI:**
- Google Gemini AI
- Google AI File Manager

## Utveckling

```bash
# Kör TypeScript-kontroll
npm run lint

# Bygg för produktion
npm run build
```

## Deploy

### Hetzner / VPS

1. Klona repot på servern
2. Installera dependencies
3. Konfigurera miljövariabler
4. Använd PM2 eller systemd för att köra tjänsterna
5. Sätt upp Nginx som reverse proxy

### Miljövariabler för produktion

```env
GOOGLE_API_KEY=din_api_nyckel
PDF_SERVICE_URL=http://localhost:8001
```

## Licens

MIT
