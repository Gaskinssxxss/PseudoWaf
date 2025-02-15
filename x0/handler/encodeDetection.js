const zlib = require("zlib");
const { decode } = require("html-entities");

function detectCharEncode(input) {
  if (!input || typeof input !== "string") {
    return false;
  }

  const urlEncodedRegex = /(%[0-9A-Fa-f]{2})+/g;

  if (!urlEncodedRegex.test(input)) {
    return false;
  }

  try {
    const segments = input.split(/(%[0-9A-Fa-f]{2})/g).filter(Boolean);
    let decoded = "";

    for (const segment of segments) {
      if (segment.startsWith("%")) {
        decoded += decodeURIComponent(segment);
      } else {
        decoded += segment;
      }
    }

    return {
      detected: true,
      decoded: decoded,
    };
  } catch (error) {
    return false;
  }
}

function detectBinary(input) {
  if (!input) return false;

  const binaryPatterns = [
    /\bbinary NULL\b/,
    /\bTHEN\s+binary (\d+|0x[0-9a-fA-F]+)\s+ELSE\s+binary (\d+|0x[0-9a-fA-F]+)/,
    /(binary \d+\s*[>=]\s*binary \d+)/,
    /\b(AND|OR)\s*binary \d+/,
    /[>=]\s*binary \d+/,
    /\bbinary 0x[0-9a-fA-F]+/,
  ];

  const isBinaryTampered = binaryPatterns.some((pattern) =>
    pattern.test(input)
  );

  if (!isBinaryTampered) return false;

  const decodedPayload = input
    .replace(/\bbinary NULL\b/g, "NULL")
    .replace(
      /\bTHEN\s+binary (\d+|0x[0-9a-fA-F]+)\s+ELSE\s+binary (\d+|0x[0-9a-fA-F]+)/g,
      "THEN $1 ELSE $2"
    )
    .replace(/(binary \d+\s*[>=]\s*binary \d+)/g, (match) => {
      return match.replace(/binary /g, "");
    })
    .replace(/\b(AND|OR)\s*binary (\d+)/g, "$1 $2")
    .replace(/[>=]\s*binary (\d+)/g, ">$1")
    .replace(/\bbinary (0x[0-9a-fA-F]+)/g, "$1");

  return {
    detected: true,
    decoded: decodedPayload,
  };
}

function detectBetween(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const patterns = [
    {
      regex: /NOT BETWEEN 0 AND (\S+)/i,
      decode: (match, value) => input.replace(match, `> ${value}`),
    },
    {
      regex: /BETWEEN (\S+) AND \1/i,
      decode: (match, value) => input.replace(match, `= ${value}`),
    },
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern.regex);
    if (match) {
      const decoded = pattern.decode(match[0], match[1]);
      if (decoded) {
        return {
          detected: true,
          decoded,
        };
      }
    }
  }

  return { detected: false, decoded: null };
}

function detectCharUnicodeEncode(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const unicodeRegex = /%u[0-9A-Fa-f]{4}/g;
  const matches = input.match(unicodeRegex);

  if (matches) {
    try {
      const decoded = input.replace(unicodeRegex, (match) => {
        const codePoint = parseInt(match.slice(2), 16);
        return String.fromCharCode(codePoint);
      });

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return false;
    }
  }

  return { detected: false, decoded: null };
}

function detectCompression(input) {
  try {
    const buffer = Buffer.from(input, "base64");
    const decompressed = zlib.inflateSync(buffer).toString("utf-8");

    return decompressed
      ? { compressionEncoding: true, decoded: decompressed }
      : { compressionEncoding: true, decoded: null };
  } catch (error) {
    return false;
  }
}

function detectROT13(input) {
  if (!/^[A-Za-z]+$/.test(input)) return false;

  const decodeROT13 = (str) =>
    str.replace(/[A-Za-z]/g, (char) => {
      const base = char <= "Z" ? 65 : 97;
      return String.fromCharCode(
        ((char.charCodeAt(0) - base + 13) % 26) + base
      );
    });

  const decoded = decodeROT13(input);
  return decoded !== input ? { isROT13: true, decoded } : false;
}

function detectXOR(input, keyRange = 255) {
  const results = [];
  for (let key = 0; key <= keyRange; key++) {
    const decoded = input
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) ^ key))
      .join("");

    if (
      /^[A-Za-z0-9\s]+$/.test(decoded) &&
      decoded.length === input.length &&
      decoded !== input &&
      !/\s{2,}/.test(decoded)
    ) {
      results.push({ key, decoded });
    }
  }
  return results.length > 0 ? results : false;
}

function filterXORResults(results, expectedLength) {
  return results.filter(
    (result) =>
      /^[A-Za-z0-9\s]+$/.test(result.decoded) &&
      result.decoded.length === expectedLength
  );
}

function detectCustomEncoding(input, substitutionMap) {
  const decoded = input
    .split("")
    .map((char) => substitutionMap[char] || char)
    .join("");
  return { original: input, decoded };
}

function detectJavaScriptObfuscation(input) {
  const isObfuscated = /eval\(atob\(.+\)\)/.test(input);
  if (isObfuscated) {
    try {
      const decoded = input.match(/atob\(['"](.+)['"]\)/);
      if (decoded && decoded[1]) {
        const decodedValue = Buffer.from(decoded[1], "base64").toString(
          "utf-8"
        );
        return { isObfuscated, decoded: decodedValue };
      }
    } catch (error) {
      return { isObfuscated, error: error.message };
    }
  }
  return false;
}

function detectMorseCode(input) {
  const morseAlphabet = {
    ".-": "A",
    "-...": "B",
    "-.-.": "C",
    "-..": "D",
    ".": "E",
    "..-.": "F",
    "--.": "G",
    "....": "H",
    "..": "I",
    ".---": "J",
    "-.-": "K",
    ".-..": "L",
    "--": "M",
    "-.": "N",
    "---": "O",
    ".--.": "P",
    "--.-": "Q",
    ".-.": "R",
    "...": "S",
    "-": "T",
    "..-": "U",
    "...-": "V",
    ".--": "W",
    "-..-": "X",
    "-.--": "Y",
    "--..": "Z",
    ".----": "1",
    "..---": "2",
    "...--": "3",
    "....-": "4",
    ".....": "5",
    "-....": "6",
    "--...": "7",
    "---..": "8",
    "----.": "9",
    "-----": "0",
  };

  const isMorse = /^[.\- ]+$/.test(input);
  if (!isMorse) return false;

  const decoded = input
    .trim()
    .split(" ")
    .map((char) => morseAlphabet[char] || "?")
    .join("");

  return { isMorse: true, decoded };
}

function detectURLEncoding(input) {
  if (/%[0-9A-Fa-f]{2}/.test(input)) {
    try {
      const decoded = decodeURIComponent(input);
      return { urlEncoding: true, decoded };
    } catch {
      return { urlEncoding: true, decoded: null };
    }
  }
  return false;
}

function detectDoubleURLEncoding(input) {
  if (/%25[0-9A-Fa-f]{2}/.test(input)) {
    try {
      const decoded = decodeURIComponent(decodeURIComponent(input));
      return { doubleUrlEncoding: true, decoded };
    } catch {
      return { doubleUrlEncoding: true, decoded: null };
    }
  }
  return false;
}

function detectHtmlEntityEncoding(input) {
  if (/&[a-zA-Z]+;|&#[0-9]+;|&#x[0-9a-fA-F]+;/.test(input)) {
    try {
      const decoded = decode(input);
      return { htmlEntityEncoding: true, decoded };
    } catch {
      return { htmlEntityEncoding: true, decoded: null };
    }
  }
  return false;
}

function detectBase64EncodingGet(input) {
  if (
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      input
    )
  ) {
    try {
      const decoded = Buffer.from(input, "base64").toString("utf-8");
      return { base64Encoding: true, decoded };
    } catch {
      return { base64Encoding: true, decoded: null };
    }
  }
  return false;
}

function detectBase64EncodingPost(input) {
  if (/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2,3})?$/.test(input)) {
    try {
      const paddedInput = input.padEnd(
        input.length + ((4 - (input.length % 4)) % 4),
        "="
      );

      const decoded = Buffer.from(paddedInput, "base64").toString("utf-8");

      return { base64Encoding: true, decoded };
    } catch {
      return { base64Encoding: true, decoded: null };
    }
  }
  return false;
}

function detectHexadecimalEncoding(input) {
  if (/\\x[0-9A-Fa-f]{2}/.test(input)) {
    try {
      const decoded = input.replace(/\\x[0-9A-Fa-f]{2}/g, (match) =>
        String.fromCharCode(parseInt(match.slice(2), 16))
      );
      return { hexadecimalEncoding: true, decoded };
    } catch {
      return { hexadecimalEncoding: true, decoded: null };
    }
  }

  if (/^[0-9A-Fa-f]{2,}$/.test(input)) {
    try {
      const decoded = input
        .match(/.{1,2}/g)
        .map((hex) => String.fromCharCode(parseInt(hex, 16)))
        .join("");
      return { hexadecimalPayload: true, decoded };
    } catch {
      return { hexadecimalPayload: true, decoded: null };
    }
  }

  return false;
}

function detectUnicodeEncoding(input) {
  if (/\\u[0-9A-Fa-f]{4}/.test(input)) {
    try {
      const decoded = input.replace(/\\u[0-9A-Fa-f]{4}/g, (match) =>
        String.fromCharCode(parseInt(match.slice(2), 16))
      );
      return { unicodeEncoding: true, decoded };
    } catch {
      return { unicodeEncoding: true, decoded: null };
    }
  }

  if (/^(\\u[0-9A-Fa-f]{4})+$/.test(input)) {
    try {
      const decoded = input
        .match(/\\u[0-9A-Fa-f]{4}/g)
        .map((unicode) => String.fromCharCode(parseInt(unicode.slice(2), 16)))
        .join("");
      return { unicodePayload: true, decoded };
    } catch {
      return { unicodePayload: true, decoded: null };
    }
  }

  return false;
}

function detectOctalEncoding(input) {
  if (/\\[0-7]{3}/.test(input)) {
    try {
      const decoded = input.replace(/\\[0-7]{3}/g, (match) =>
        String.fromCharCode(parseInt(match.slice(1), 8))
      );
      return { octalEncoding: true, decoded };
    } catch {
      return { octalEncoding: true, decoded: null };
    }
  }
  return false;
}

function detectCharUnicodeEscape(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const singleBackslashInput = input.replace(/\\\\/g, "\\");

  const unicodeEscapeRegex = /\\u[0-9A-Fa-f]{4}/g;
  const matches = singleBackslashInput.match(unicodeEscapeRegex);

  if (matches) {
    try {
      const decoded = singleBackslashInput.replace(
        unicodeEscapeRegex,
        (match) => {
          const codePoint = parseInt(match.slice(2), 16);
          return String.fromCharCode(codePoint);
        }
      );

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return false;
    }
  }

  return { detected: false, decoded: null };
}

function detectDecimalEntities(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const decimalEntityRegex = /&#\d+;/g;
  const matches = input.match(decimalEntityRegex);

  if (matches) {
    try {
      const decoded = input.replace(decimalEntityRegex, (match) => {
        const codePoint = parseInt(match.slice(2, -1), 10);
        return String.fromCharCode(codePoint);
      });

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return false;
    }
  }

  return { detected: false, decoded: null };
}

function detectDunion(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const dunionRegex = /\d+DUNION/i;

  if (dunionRegex.test(input)) {
    try {
      const decoded = input.replace(/(\d+)DUNION/gi, "$1 UNION");

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectEqualToLike(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const equalToLikeRegex = /\sLIKE\s/i;

  if (equalToLikeRegex.test(input)) {
    try {
      const decoded = input.replace(/\sLIKE\s/gi, " = ");

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectEqualToRlike(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const equalToRlikeRegex = /\sRLIKE\s/i;

  if (equalToRlikeRegex.test(input)) {
    try {
      const decoded = input.replace(/\sRLIKE\s/gi, " = ");

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectGreatest(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const greatestRegex = /\bGREATEST\(([^,]+),([^\)]+)\)\s*=\s*\1/i;

  if (greatestRegex.test(input)) {
    try {
      const decoded = input.replace(greatestRegex, (match, a, bPlusOne) => {
        const b = bPlusOne.replace(/\+1/, "");
        return `${a} > ${b}`;
      });

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectHex2Char(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const concatCharRegex = /CONCAT\((CHAR\(\d+\)(?:,CHAR\(\d+\))*)\)/gi;

  if (concatCharRegex.test(input)) {
    try {
      const decoded = input.replace(concatCharRegex, (match, charSequence) => {
        const hexValues = charSequence.match(/CHAR\((\d+)\)/g).map((char) => {
          const num = parseInt(char.match(/\d+/)[0], 10);
          return num.toString(16).padStart(2, "0");
        });
        return `0x${hexValues.join("")}`;
      });

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectHexEntities(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const hexEntityRegex = /&#x[0-9a-fA-F]+;/g;

  if (hexEntityRegex.test(input)) {
    try {
      const decoded = input.replace(hexEntityRegex, (match) => {
        const hexValue = match.slice(3, -1);
        const charCode = parseInt(hexValue, 16);
        return String.fromCharCode(charCode);
      });

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectIf2Case(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const ifRegex = /IF\(([^,]+),([^,]+),([^\)]+)\)/g;
  const caseRegex =
    /CASE WHEN \(([^)]+)\) THEN \(([^)]+)\) ELSE \(([^)]+)\) END/g;

  if (ifRegex.test(input)) {
    try {
      const decoded = input.replace(
        ifRegex,
        (match, condition, thenExpr, elseExpr) => {
          return `CASE WHEN (${condition.trim()}) THEN (${thenExpr.trim()}) ELSE (${elseExpr.trim()}) END`;
        }
      );

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  if (caseRegex.test(input)) {
    try {
      const decoded = input.replace(
        caseRegex,
        (match, condition, thenExpr, elseExpr) => {
          return `IF(${condition.trim()}, ${thenExpr.trim()}, ${elseExpr.trim()})`;
        }
      );

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectIfnull2CaseWhenIsnull(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const caseWhenRegex =
    /CASE WHEN ISNULL\(([^)]+)\)\s+THEN\s+\(([^)]+)\)\s+ELSE\s+\(([^)]+)\)\s+END/gi;

  if (caseWhenRegex.test(input)) {
    try {
      const decoded = input.replace(caseWhenRegex, (match, a, b, c) => {
        if (a.trim() === c.trim()) {
          return `IFNULL(${a.trim()}, ${b.trim()})`;
        }
        return match;
      });

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectIfnull2IfIsnull(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const ifIsnullRegex = /IF\(ISNULL\(([^\)]+)\),([^,]+),([^\)]+)\)/gi;

  if (ifIsnullRegex.test(input)) {
    try {
      const decoded = input.replace(ifIsnullRegex, (match, a, b, c) => {
        if (a.trim() === c.trim()) {
          return `IFNULL(${a.trim()}, ${b.trim()})`;
        }
        return match;
      });

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectInformationSchemaComment(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const informationSchemaRegex = /INFORMATION_SCHEMA\/\*\*\/\./gi;

  if (informationSchemaRegex.test(input)) {
    try {
      const decoded = input.replace(
        informationSchemaRegex,
        "INFORMATION_SCHEMA."
      );

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectLeast(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const leastRegex = /\bLEAST\(([^,]+),([^\)]+)\)=([^\)]+)\+1/gi;

  if (leastRegex.test(input)) {
    try {
      const decoded = input.replace(leastRegex, (match, a, b, c) => {
        const originalB = b.replace(/\+1/, "");
        return `${a.trim()} > ${originalB.trim()}`;
      });

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectUppercase(input) {
  if (/^[A-Z]+$/.test(input)) {
    try {
      const decoded = input.toLowerCase();
      return { UpperCase: true, decoded };
    } catch {
      return { UpperCase: true, decoded: null };
    }
  }
  return false;
}

function detectLuaNginx(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }
  const luaNginxRegex = /([A-Za-z0-9]{2}=&){100,}/;

  if (luaNginxRegex.test(input)) {
    try {
      const decoded = input.replace(luaNginxRegex, "").trim();

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }

  return { detected: false, decoded: null };
}

function detectNullByte(input) {
  if (typeof input !== "string") {
    return { detected: false, decoded: null };
  }

  const nullByteRegex = /%00/g;

  if (nullByteRegex.test(input)) {
    try {
      const decoded = input.replace(nullByteRegex, "");

      return {
        detected: true,
        decoded,
      };
    } catch (error) {
      return {
        detected: true,
        decoded: null,
        error: error.message,
      };
    }
  }
}

function detectSpacedTagEncoding(input) {
  const spacedTagPattern = /<\s*([\w\s]+)\s*>(.*?)<\/\s*([\w\s]+)\s*>/gi;

  if (spacedTagPattern.test(input)) {
    try {
      const decoded = input
        .replace(
          /<\s*([\w\s]+)\s*>/gi,
          (match, tagName) => `<${tagName.replace(/\s+/g, "")}>`
        )
        .replace(
          /<\/\s*([\w\s]+)\s*>/gi,
          (match, tagName) => `</${tagName.replace(/\s+/g, "")}>`
        );

      return { detected: true, decoded };
    } catch {
      return { detected: true, decoded: null };
    }
  }
}

function detectObfuscation(input) {
  const obfuscationPattern = /["']\s*\+\s*["']/;

  if (obfuscationPattern.test(input)) {
    try {
      const decoded = input.replace(/["']\s*\+\s*["']/g, "");

      const detected = input !== decoded;

      return { detected, decoded };
    } catch {
      return { detected: true, decoded: null };
    }
  }
}

function detectStringManipulation(input) {
  const stringManipulationPattern = /String\.fromCharCode\(([\d,\s]+)\)/;

  if (stringManipulationPattern.test(input)) {
    try {
      const match = input.match(stringManipulationPattern);
      const charCodes = match[1]
        .split(",")
        .map((code) => parseInt(code.trim(), 10));

      const decoded = String.fromCharCode(...charCodes);

      return { detected: true, decoded };
    } catch {
      return { detected: true, decoded: null };
    }
  }
}

function detectJsonBreakingPayload(input) {
  const payloadPattern = /[\(\)\,"'\.\+\-\*\&\|\^\$\!\@\#\%\`\~\<\>]/;

  if (payloadPattern.test(input)) {
    try {
      const decoded = input.replace(
        /[\(\)\,"'\.\+\-\*\&\|\^\$\!\@\#\%\`\~\<\>]/g,
        ""
      );

      const detected = input !== decoded;

      return { detected, decoded };
    } catch {
      return { detected: true, decoded: null };
    }
  }

  return { detected: false, decoded: input };
}

module.exports = {
  detectJsonBreakingPayload,
  detectCompression,
  detectROT13,
  detectXOR,
  detectCustomEncoding,
  detectJavaScriptObfuscation,
  detectMorseCode,
  detectURLEncoding,
  detectDoubleURLEncoding,
  detectHtmlEntityEncoding,
  detectBase64EncodingGet,
  detectBase64EncodingPost,
  detectHexadecimalEncoding,
  detectUnicodeEncoding,
  detectOctalEncoding,
  detectCharEncode,
  detectBinary,
  detectBetween,
  detectCharUnicodeEncode,
  detectCharUnicodeEscape,
  detectDecimalEntities,
  detectDunion,
  detectEqualToLike,
  detectEqualToRlike,
  detectGreatest,
  detectHex2Char,
  detectHexEntities,
  detectIf2Case,
  detectIfnull2CaseWhenIsnull,
  detectIfnull2IfIsnull,
  detectInformationSchemaComment,
  detectLeast,
  detectUppercase,
  detectLuaNginx,
  detectNullByte,
  detectSpacedTagEncoding,
  detectObfuscation,
  detectStringManipulation,
};
