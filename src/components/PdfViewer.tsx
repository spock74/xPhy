import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page } from 'react-pdf';
import { useI18n } from '../i18n';

interface PdfViewerProps {
  file: File;
  highlightText: string;
}

// Re-using the robust normalization function for more forgiving text comparison.
const normalizeTextForComparison = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/\s+/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .toLowerCase();
};

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, highlightText }) => {
  const { t } = useI18n();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // A ref to store the DOM elements of each page's container
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  // A ref to prevent re-scrolling on re-renders for the same highlight
  const hasScrolledRef = useRef(false);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };
  
  const onDocumentLoadError = (loadError: Error) => {
      console.error('Error while loading document!', loadError);
      setError(t('pdfViewerErrorLoading'));
      setIsLoading(false);
  };

  // This function clears all previous highlights from all pages.
  const clearAllHighlights = useCallback(() => {
    pageRefs.current.forEach((pageDiv) => {
      if (!pageDiv) return;
      const textLayer = pageDiv.querySelector('.react-pdf__Page__textLayer');
      if (textLayer) {
        const spans = textLayer.querySelectorAll('span');
        spans.forEach(span => {
          if ((span as HTMLElement).style.backgroundColor) {
             (span as HTMLElement).style.backgroundColor = 'transparent';
          }
        });
      }
    });
  }, []);

  // This is the core highlighting logic. It runs after a page's text layer is rendered.
  const highlightTextOnPage = useCallback((pageNumber: number) => {
      if (!highlightText) {
          return;
      }

      const pageDiv = pageRefs.current.get(pageNumber);
      if (!pageDiv) return;

      const textLayer = pageDiv.querySelector('.react-pdf__Page__textLayer');
      if (!textLayer) return;

      const textSpans = Array.from(textLayer.querySelectorAll('span'));
      if (textSpans.length === 0) return;
      
      const pageTextContent = textSpans.map(span => (span as HTMLElement).textContent || '').join('');
      const normalizedPageText = normalizeTextForComparison(pageTextContent);
      const normalizedQuery = normalizeTextForComparison(highlightText);

      if (!normalizedQuery) return;

      const matchIndex = normalizedPageText.indexOf(normalizedQuery);
      if (matchIndex === -1) return;

      const matchEndIndex = matchIndex + normalizedQuery.length;
      let accumulatedLen = 0;
      let firstMatchSpan: HTMLSpanElement | null = null;
      
      textSpans.forEach(span => {
          const spanText = (span as HTMLElement).textContent || '';
          const normalizedSpanText = normalizeTextForComparison(spanText);
          const spanStart = accumulatedLen;
          const spanEnd = accumulatedLen + normalizedSpanText.length;

          // Check if the current span overlaps with the matched text range
          if (Math.max(spanStart, matchIndex) < Math.min(spanEnd, matchEndIndex)) {
              (span as HTMLElement).style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
              if (!firstMatchSpan) {
                  firstMatchSpan = span as HTMLSpanElement;
              }
          }
          accumulatedLen = spanEnd;
      });

      // Scroll to the first highlighted span if we haven't scrolled yet for this highlight
      if (firstMatchSpan && !hasScrolledRef.current) {
          firstMatchSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
          hasScrolledRef.current = true;
      }
  }, [highlightText]);

  // Effect to reset state and clear highlights when the file changes
  useEffect(() => {
      setIsLoading(true);
      setError(null);
      setNumPages(null);
      hasScrolledRef.current = false;
      clearAllHighlights();
  }, [file, clearAllHighlights]);

  // Effect to re-run highlighting when the highlightText prop changes
  useEffect(() => {
    hasScrolledRef.current = false; // Allow scrolling for new highlight
    clearAllHighlights();
    if (numPages) {
      for (let i = 1; i <= numPages; i++) {
        highlightTextOnPage(i);
      }
    }
  }, [highlightText, numPages, clearAllHighlights, highlightTextOnPage]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-auto relative bg-gray-900">
        {isLoading && (
            <div className="absolute inset-0 bg-gray-800/50 flex items-center justify-center text-white z-10">
                {t('loadingDefault')}
            </div>
        )}
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          className="flex flex-col items-center"
        >
          {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map(pageNumber => (
            <div
                key={pageNumber}
                // Fix: The `ref` callback should not return a value.
                // Using a block statement `{ ... }` ensures the arrow function returns `void`.
                ref={(el) => { pageRefs.current.set(pageNumber, el); }}
                className="my-4 shadow-lg"
            >
                <Page
                  pageNumber={pageNumber}
                  scale={1.5}
                  renderAnnotationLayer={false} // Disable annotation layer for cleaner view
                  renderTextLayer={true} // MUST be true for highlighting to work
                  onRenderSuccess={() => highlightTextOnPage(pageNumber)}
                />
            </div>
          ))}
        </Document>
        {error && <div className="text-red-400 p-4 text-center">{error}</div>}
      </div>
    </div>
  );
};