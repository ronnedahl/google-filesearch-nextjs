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

export interface ChatRequest {
  fileUri: string;
  message: string;
  history?: Message[];
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export interface UploadResponse {
  success: boolean;
  fileName: string;
  fileUri: string;
}
