'use client';

import { useState } from 'react';

interface PDFUploaderProps {
  onUploadComplete: (fileUri: string, fileName: string) => void;
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
    setProgress('Laddar upp och indexerar PDF...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const data = await uploadResponse.json();
        throw new Error(data.error || 'Kunde inte ladda upp PDF');
      }

      const { fileUri } = await uploadResponse.json();

      setProgress('Klar!');
      setTimeout(() => {
        onUploadComplete(fileUri, file.name);
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
