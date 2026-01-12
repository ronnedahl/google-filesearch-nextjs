'use client';

import { useState } from 'react';
import { PDFUploader } from './components/PDFUploader';
import { ChatInterface } from './components/ChatInterface';

export default function Home() {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleUploadComplete = (uri: string, name: string) => {
    setFileUri(uri);
    setFileName(name);
  };

  const resetChat = () => {
    setFileUri(null);
    setFileName('');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PDF Chat med Google AI
          </h1>
          <p className="text-gray-600">
            Ladda upp en PDF och chatta om innehållet
          </p>
        </header>

        {!fileUri ? (
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
            <ChatInterface fileUri={fileUri} />
          </div>
        )}
      </div>
    </main>
  );
}
