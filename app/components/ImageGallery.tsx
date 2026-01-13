'use client';

import { useState } from 'react';
import type { ExtractedImage } from '@/lib/types';

interface ImageGalleryProps {
  images: ExtractedImage[];
  highlightedPage?: number;  // Page number to highlight
}

export function ImageGallery({ images, highlightedPage }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<ExtractedImage | null>(null);

  if (images.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-700 mb-2">Dokumentsidor</h3>
        <p className="text-sm text-gray-500">Inga sidor extraherade</p>
      </div>
    );
  }

  return (
    <>
      {/* Gallery */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-700 mb-3">
          Dokumentsidor ({images.length})
        </h3>

        <div className="grid grid-cols-2 gap-2 max-h-[500px] overflow-y-auto">
          {images.map((image) => {
            const isHighlighted = highlightedPage === image.pageNumber;

            return (
              <button
                key={image.id}
                onClick={() => setSelectedImage(image)}
                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                  isHighlighted
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {/* Thumbnail */}
                <img
                  src={image.url}
                  alt={image.label}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />

                {/* Label overlay */}
                <div className={`absolute bottom-0 left-0 right-0 py-1 px-2 text-xs font-medium ${
                  isHighlighted
                    ? 'bg-blue-500 text-white'
                    : 'bg-black/60 text-white'
                }`}>
                  {image.label}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                {/* Highlighted indicator */}
                {isHighlighted && (
                  <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                    Aktuell
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b">
              <h4 className="font-semibold text-gray-800">
                {selectedImage.label}
              </h4>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg
                  className="w-6 h-6 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Image */}
            <div className="overflow-auto max-h-[calc(90vh-60px)]">
              <img
                src={selectedImage.url}
                alt={selectedImage.label}
                className="w-full h-auto"
              />
            </div>

            {/* Navigation */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = images.findIndex(img => img.id === selectedImage.id);
                  const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
                  setSelectedImage(images[prevIndex]);
                }}
                className="p-2 bg-white/90 rounded-full shadow hover:bg-white transition-colors"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>

            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = images.findIndex(img => img.id === selectedImage.id);
                  const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
                  setSelectedImage(images[nextIndex]);
                }}
                className="p-2 bg-white/90 rounded-full shadow hover:bg-white transition-colors"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
