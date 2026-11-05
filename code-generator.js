/* ==========================================================================
   CodeLyrics Studio - Smart Lyrics to Code Generator
   Converts standard song lyrics (English / Indonesian) into aesthetic code syntax
   ========================================================================== */

class CodeGenerator {
  static convertLyricsToCode(rawText) {
    if (!rawText || !rawText.trim()) return [];

    const rawLines = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const convertedLines = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const codeLine = this.transformSingleLine(line);
      convertedLines.push(codeLine);
    }

    return convertedLines;
  }

  static transformSingleLine(raw) {
    const clean = raw.trim();
    const lower = clean.toLowerCase();

    // 1. Comments / Ad-libs / Interjections ("oh", "yeah", "baby", "hmm", "intro", "outro")
    if (lower.startsWith('//') || lower.startsWith('(') && lower.endsWith(')') || /^(oh|ooh|yeah|baby|ah|woah|hmm|and oh)[.!?…]*$/i.test(lower)) {
      return {
        text: `// ${clean.replace(/^[()]/g, '')}`,
        isComment: true
      };
    }

    // 2. Conditionals ("if ...", "kalau ...", "bila ...", "jika ...")
    if (lower.startsWith('if ') || lower.startsWith('bila ') || lower.startsWith('kalau ') || lower.startsWith('jika ')) {
      const condition = this.toCamelCase(clean.replace(/^(if|bila|kalau|jika)\s+/i, ''));
      return {
        text: `if (${condition}()) {`
      };
    }

    // 3. Closures / Ends ("}", "});")
    if (clean === '}' || clean === '});') {
      return { text: clean };
    }

    // 4. Promises / Then chains ("then let me go", "kemudian kau pergi")
    if (lower.startsWith('then ') || lower.startsWith('lalu ') || lower.startsWith('kemudian ')) {
      const action = this.toCamelCase(clean.replace(/^(then|lalu|kemudian)\s+/i, ''));
      return {
        text: `.then(() => ${action}());`
      };
    }

    // 5. English Subject + Verb patterns ("he loves me not", "you gotta say...", "I don't need to worry")
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      const first = words[0].toLowerCase();
      const rest = words.slice(1).join(' ');

      // Common subjects
      const subjects = ['i', 'you', 'he', 'she', 'we', 'they', 'it', 'everything', 'world', 'ami', 'its', 'aku', 'kamu', 'kau', 'dia', 'kita', 'hati', 'semesta'];
      
      if (subjects.includes(first) || /^[a-zA-Z]+$/.test(words[0])) {
        const subject = words[0];
        const predicate = words[1];

        // "he loves me not" -> he.loves(me, "not");
        if (words.length === 4 && words[3].toLowerCase() === 'not') {
          return {
            text: `${subject}.${words[1]}(${words[2]}, "not");`
          };
        }

        // "I don't need to worry" -> I.dontNeedTo(worry);
        if (words.length >= 4 && (words[1].toLowerCase() === "don't" || words[1].toLowerCase() === "dont")) {
          const fnName = 'dont' + this.capitalize(words[2]);
          const errorTarget = words[words.length - 1].replace(/[^a-zA-Z]/g, '');
          return {
            text: `${subject}.${fnName}(${errorTarget});`,
            errorWord: errorTarget
          };
        }

        // "you gotta say that you're sorry" -> you.gottaSay({that: "you're sorry"});
        if (words.length >= 4 && words.some(w => w.toLowerCase() === 'that')) {
          const verb = this.toCamelCase(words.slice(1, 3).join(' '));
          const thatIndex = words.findIndex(w => w.toLowerCase() === 'that');
          const thatPart = words.slice(thatIndex + 1).join(' ').replace(/["']/g, '');
          return {
            text: `${subject}.${verb}({that: "${thatPart}"});`
          };
        }

        // General: subject.verb("remainder")
        const method = this.toCamelCase(words[1]);
        const args = words.slice(2).join(' ').replace(/["']/g, '');
        if (args.length > 0) {
          return {
            text: `${subject}.${method}("${args}");`
          };
        } else {
          return {
            text: `${subject}.${method}();`
          };
        }
      }
    }

    // 6. Function invocation fallback: verb(remainder)
    const methodName = this.toCamelCase(words[0]);
    const remaining = words.slice(1).join(' ').replace(/["']/g, '');
    return {
      text: `${methodName}("${remaining}");`
    };
  }

  static toCamelCase(str) {
    return str
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .map((w, idx) => idx === 0 ? w.toLowerCase() : this.capitalize(w))
      .join('');
  }

  static capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static calculateAutoTimings(lines, totalDuration = 25.0) {
    if (!lines || lines.length === 0) return [];

    // Distribute time proportional to character length
    const totalChars = lines.reduce((acc, l) => acc + (l.text.length || 10), 0);
    const usableDuration = Math.max(5, totalDuration - 1.5);
    let currentTime = 0.4;

    return lines.map((l, index) => {
      const weight = (l.text.length || 10) / totalChars;
      const duration = Math.max(1.2, weight * usableDuration);
      const timeStart = parseFloat(currentTime.toFixed(2));
      const timeEnd = parseFloat((currentTime + duration).toFixed(2));
      currentTime = timeEnd + 0.15;

      return {
        ...l,
        id: index + 1,
        timeStart,
        timeEnd,
        lineNum: String(index + 1).padStart(2, '0')
      };
    });
  }
}
