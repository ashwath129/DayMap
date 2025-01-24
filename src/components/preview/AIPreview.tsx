import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface AIPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  content: string | null;
  isLoading: boolean;
}

export function AIPreview({ isOpen, onClose, content, isLoading }: AIPreviewProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">AI Generated Travel Plan</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : content ? (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-base">
                {content}
              </pre>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-12">
              No content available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}