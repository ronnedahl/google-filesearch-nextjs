// Message types
export interface Message {
  role: 'user' | 'model';
  content: string;
  citations?: Citation[];
}

export interface Citation {
  title: string;
  text: string;
  uri?: string;
}

// Chat types
export interface ChatRequest {
  fileUri: string;
  message: string;
  history?: Message[];
  images?: ExtractedImage[];  // For AI context
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

// Image types
export interface ExtractedImage {
  id: string;           // Unique ID (e.g., "img-1")
  pageNumber: number;   // Which page the image is from
  label: string;        // "Bild 1", "Figur 2"
  url: string;          // /api/images/[sessionId]/[imageId]
  width: number;
  height: number;
}

// Upload types
export interface UploadResponse {
  success: boolean;
  fileName: string;
  fileUri: string;
  sessionId: string;           // For image management
  images: ExtractedImage[];    // Extracted images
}

// Image store types
export interface StoredImage {
  id: string;
  sessionId: string;
  pageNumber: number;
  filePath: string;
  width: number;
  height: number;
  createdAt: Date;
}
