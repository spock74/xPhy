/**
 * Wraps text to a specified line length.
 * @param text The input string.
 * @param lineLength The maximum length of a line.
 * @returns The wrapped string.
 */
function wordWrap(text: string, lineLength: number): string {
  const words = text.split(' ');
  let currentLine = '';
  const lines = [];

  for (const word of words) {
    if ((currentLine + ' ' + word).length > lineLength && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.join('\n');
}


/**
 * Pre-processes raw text by wrapping lines and adding line numbers.
 * @param rawText The raw text content from a file.
 * @returns The processed text with line numbers.
 */
export function preprocessText(rawText: string): string {
  const wrappedText = wordWrap(rawText.replace(/\s+/g, ' '), 80);
  const lines = wrappedText.split('\n');
  return lines.map((line, index) => `${index + 1}: ${line}`).join('\n');
}

/**
 * Parses a line number string (e.g., "Lines: 10-12, 15") into an array of numbers.
 * @param linesString The string containing line numbers.
 * @returns An array of numbers representing the lines.
 */
export function parseLineNumbers(linesString: string | null | undefined): number[] {
  if (!linesString) {
    return [];
  }

  const matches = linesString.match(/(\d+-\d+|\d+)/g);
  if (!matches) {
    return [];
  }

  const lines = new Set<number>();
  matches.forEach(match => {
    if (match.includes('-')) {
      const [start, end] = match.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        lines.add(i);
      }
    } else {
      lines.add(Number(match));
    }
  });

  return Array.from(lines);
}
