'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message, ExtractedImage } from '@/lib/types';

interface ChatInterfaceProps {
  fileUri: string;
  images: ExtractedImage[];
  onPageReference?: (pageNumber: number) => void;  // Callback when AI references a page
}

/**
 * Parse AI response to find page references like [Se Sida 3]
 */
function parsePageReferences(text: string): number[] {
  const regex = /\[Se Sida (\d+)\]/gi;
  const matches = [...text.matchAll(regex)];
  return matches.map(match => parseInt(match[1], 10));
}

/**
 * Format message content with clickable page references
 */
function formatMessageContent(
  content: string,
  onPageClick: (pageNumber: number) => void
): React.ReactNode {
  const parts = content.split(/(\[Se Sida \d+\])/gi);

  return parts.map((part, index) => {
    const match = part.match(/\[Se Sida (\d+)\]/i);
    if (match) {
      const pageNumber = parseInt(match[1], 10);
      return (
        <button
          key={index}
          onClick={() => onPageClick(pageNumber)}
          className="inline-flex items-center px-2 py-0.5 mx-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm font-medium"
        >
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Sida {pageNumber}
        </button>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function ChatInterface({ fileUri, images, onPageReference }: ChatInterfaceProps) {
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

  const handlePageClick = useCallback((pageNumber: number) => {
    onPageReference?.(pageNumber);
  }, [onPageReference]);

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
          fileUri,
          message: input,
          history: messages,
          images  // Pass images for AI context
        })
      });

      if (!response.ok) {
        throw new Error('Kunde inte skicka meddelande');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'model',
        content: data.answer,
        citations: data.citations
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Check for page references in the response
      const pageRefs = parsePageReferences(data.answer);
      if (pageRefs.length > 0 && onPageReference) {
        // Highlight the first referenced page
        onPageReference(pageRefs[0]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'model',
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
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="mb-2">Ställ en fråga om PDF-dokumentet</p>
            <p className="text-sm text-gray-400">
              AI:n kommer referera till specifika sidor när det är relevant
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap">
                {msg.role === 'model'
                  ? formatMessageContent(msg.content, handlePageClick)
                  : msg.content
                }
              </div>

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
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
            onKeyDown={handleKeyPress}
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
