import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { UploadResponse, ExtractedImage } from '@/lib/types';

const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY!);

// Python PDF service URL
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://localhost:8001';

/**
 * Extract images from PDF using Python service
 */
async function extractImagesFromPython(
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ sessionId: string; images: ExtractedImage[] }> {
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), fileName);

  const response = await fetch(`${PDF_SERVICE_URL}/extract`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Python service error: ${error}`);
  }

  const data = await response.json();

  // Convert Python response to our format
  const images: ExtractedImage[] = data.images.map((img: any) => ({
    id: img.id,
    pageNumber: img.page_number,
    label: img.label,
    url: `${PDF_SERVICE_URL}/images/${data.session_id}/${img.id}`,
    width: img.width,
    height: img.height,
  }));

  return {
    sessionId: data.session_id,
    images,
  };
}

export async function POST(request: NextRequest) {
  let tempPath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Missing file' },
        { status: 400 }
      );
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save file temporarily for Google upload
    tempPath = join(tmpdir(), `upload-${Date.now()}-${file.name}`);
    await writeFile(tempPath, buffer);

    // Extract images from PDF using Python service (in parallel with Google upload)
    let sessionId = '';
    let images: ExtractedImage[] = [];

    const extractionPromise = extractImagesFromPython(buffer, file.name)
      .then(result => {
        sessionId = result.sessionId;
        images = result.images;
        console.log(`Extracted ${images.length} pages from PDF via Python service`);
      })
      .catch(error => {
        console.error('Image extraction failed:', error);
        // Continue without images
      });

    // Upload to Google AI File Manager
    const uploadResult = await fileManager.uploadFile(tempPath, {
      mimeType: 'application/pdf',
      displayName: file.name,
    });

    // Wait for file to be processed
    let fileState = await fileManager.getFile(uploadResult.file.name);
    while (fileState.state === FileState.PROCESSING) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      fileState = await fileManager.getFile(uploadResult.file.name);
    }

    if (fileState.state === FileState.FAILED) {
      throw new Error('File processing failed');
    }

    // Wait for image extraction to complete
    await extractionPromise;

    // Clean up temp file
    if (tempPath) {
      await unlink(tempPath).catch(() => {});
    }

    const response: UploadResponse = {
      success: true,
      fileName: file.name,
      fileUri: uploadResult.file.uri,
      sessionId,
      images,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Upload error:', error);

    // Clean up temp file on error
    if (tempPath) {
      await unlink(tempPath).catch(() => {});
    }

    return NextResponse.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
