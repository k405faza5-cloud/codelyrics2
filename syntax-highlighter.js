/* ==========================================================================
   CodeLyrics Studio - Syntax Highlighter & Tokenizer
   Generates VS Code Dark+ style tokens with squiggly error support
   ========================================================================== */

class SyntaxHighlighter {
  static highlight(code, errorWord = null, isComment = false) {
    if (!code) return '';

    // If whole line is comment or starts with //
    if (isComment || code.trim().startsWith('//')) {
      return `<span class="syn-comment">${this.escapeHtml(code)}</span>`;
    }

    let result = '';
    let i = 0;
    const len = code.length;

    while (i < len) {
      // 1. Check for single-line comment //
      if (code[i] === '/' && code[i + 1] === '/') {
        result += `<span class="syn-comment">${this.escapeHtml(code.slice(i))}</span>`;
        break;
      }

      // 2. Check for strings (double or single quotes)
      if (code[i] === '"' || code[i] === "'") {
        const quote = code[i];
        let j = i + 1;
        while (j < len && code[j] !== quote) {
          if (code[j] === '\\') j++; // skip escaped
          j++;
        }
        if (j < len) j++; // include closing quote
        const strVal = code.slice(i, j);
        result += `<span class="syn-string">${this.escapeHtml(strVal)}</span>`;
        i = j;
        continue;
      }

      // 3. Arrow function =>
      if (code[i] === '=' && code[i + 1] === '>') {
        result += `<span class="syn-arrow">=&gt;</span>`;
        i += 2;
        continue;
      }

      // 4. Dot operator .
      if (code[i] === '.') {
        result += `<span class="syn-punct">.</span>`;
        i++;
        continue;
      }

      // 5. Parentheses, brackets, braces, semicolons, colons, commas
      if (/[()\[\]{};:,]/.test(code[i])) {
        result += `<span class="syn-punct">${this.escapeHtml(code[i])}</span>`;
        i++;
        continue;
      }

      // 6. Whitespace
      if (/\s/.test(code[i])) {
        result += code[i];
        i++;
        continue;
      }

      // 7. Words (Identifiers, Keywords, Methods)
      if (/[a-zA-Z0-9_$]/.test(code[i])) {
        let j = i;
        while (j < len && /[a-zA-Z0-9_$]/.test(code[j])) {
          j++;
        }
        const word = code.slice(i, j);
        
        // Peek ahead for `(` (indicates a function call)
        let k = j;
        while (k < len && /\s/.test(code[k])) k++;
        const isFunctionCall = k < len && code[k] === '(';

        // Check if word should have squiggly error underline
        const hasError = errorWord && word === errorWord;
        const errorClass = hasError ? ' squiggly-error' : '';

        // Determine token category
        if (word === 'then' || word === 'if' || word === 'const' || word === 'let' || word === 'return' || word === 'function') {
          result += `<span class="syn-keyword${errorClass}">${this.escapeHtml(word)}</span>`;
        } else if (isFunctionCall) {
          result += `<span class="syn-function${errorClass}">${this.escapeHtml(word)}</span>`;
        } else if (word === 'that' || word === 'nextTo') {
          // Object keys or properties
          result += `<span class="syn-object${errorClass}">${this.escapeHtml(word)}</span>`;
        } else if (!isNaN(Number(word))) {
          result += `<span class="syn-number${errorClass}">${this.escapeHtml(word)}</span>`;
        } else {
          // General identifiers/objects (he, you, me, everything, I, amI, its)
          result += `<span class="syn-object${errorClass}">${this.escapeHtml(word)}</span>`;
        }

        i = j;
        continue;
      }

      // Default fallback for any other char
      result += this.escapeHtml(code[i]);
      i++;
    }

    return result;
  }

  static escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
