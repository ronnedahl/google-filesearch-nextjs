import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY!);

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

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempPath = join(tmpdir(), `upload-${Date.now()}-${file.name}`);
    await writeFile(tempPath, buffer);

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

    // Clean up temp file
    if (tempPath) {
      await unlink(tempPath).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileUri: uploadResult.file.uri
    });
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
