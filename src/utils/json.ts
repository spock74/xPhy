/**
 * Extracts a JSON object or array from a string that may contain other text,
 * like explanations from an AI. It prioritizes JSON within markdown code blocks.
 *
 * @param text The raw string potentially containing JSON.
 * @returns The cleaned JSON string, or the original string if no specific JSON block is found.
 */
export const extractJsonFromString = (text: string): string => {
  // 1. First, try to find a JSON markdown code block
  const markdownMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].trim();
  }

  // 2. If no code block, find the first '{' or '[' and the last '}' or ']'
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  let startIndex = -1;

  // If no JSON structures are found, return the original text for the parser to handle.
  if (firstBrace === -1 && firstBracket === -1) {
    return text;
  }

  // Determine the start index (the first occurrence of either bracket or brace)
  if (firstBrace > -1 && firstBracket > -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace > -1) {
    startIndex = firstBrace;
  } else {
    startIndex = firstBracket;
  }
  
  const startChar = text[startIndex];
  const endChar = startChar === '{' ? '}' : ']';

  const lastIndex = text.lastIndexOf(endChar);

  // If a valid start and end are found, extract the substring.
  if (lastIndex > startIndex) {
    return text.substring(startIndex, lastIndex + 1).trim();
  }

  // 3. If fallbacks fail, return the original string for the caller to handle.
  return text;
};
