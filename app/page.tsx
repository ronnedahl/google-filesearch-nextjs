'use client';

import { useState } from 'react';
import { PDFUploader } from './components/PDFUploader';
import { ChatInterface } from './components/ChatInterface';
import { ImageGallery } from './components/ImageGallery';
import type { UploadResponse, ExtractedImage } from '@/lib/types';

export default function Home() {
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [highlightedPage, setHighlightedPage] = useState<number | undefined>();

  const handleUploadComplete = (response: UploadResponse) => {
    setUploadData(response);
    setHighlightedPage(undefined);
  };

  const handlePageReference = (pageNumber: number) => {
    setHighlightedPage(pageNumber);
    // Scroll gallery into view on mobile
    const gallery = document.getElementById('image-gallery');
    if (gallery && window.innerWidth < 1024) {
      gallery.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const resetChat = () => {
    setUploadData(null);
    setHighlightedPage(undefined);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            PDF Bruksanvisning Chat
          </h1>
          <p className="text-gray-600">
            Ladda upp en bruksanvisning och få hjälp med montering
          </p>
        </header>

        {!uploadData ? (
          <PDFUploader onUploadComplete={handleUploadComplete} />
        ) : (
          <div className="space-y-4">
            {/* Info bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white rounded-lg p-3 shadow">
              <div>
                <p className="text-sm text-gray-600">
                  Dokument: <span className="font-semibold">{uploadData.fileName}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {uploadData.images.length} sidor extraherade
                </p>
              </div>
              <button
                onClick={resetChat}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Ladda upp nytt dokument
              </button>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Chat - takes 2/3 on large screens */}
              <div className="lg:col-span-2">
                <ChatInterface
                  fileUri={uploadData.fileUri}
                  images={uploadData.images}
                  onPageReference={handlePageReference}
                />
              </div>

              {/* Gallery - takes 1/3 on large screens */}
              <div id="image-gallery" className="lg:col-span-1">
                <ImageGallery
                  images={uploadData.images}
                  highlightedPage={highlightedPage}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
