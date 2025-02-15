module.exports = [
  /\b(cat|ls|whoami|uname|id|ping|wget|curl|bash|sh|netstat|ps|kill|chmod|sudo|mv|rm|cp|scp|ssh)\b/i,
  /`.*?`/,
  /\$\(.*?\)/,
  /;\s*(cat|ls|whoami|uname|id|ping|wget|curl|bash|sh)/i,
  /&&\s*(cat|ls|whoami|uname|id|ping|wget|curl|bash|sh)/i,
  /\|\|.*?(cat|ls|whoami|uname|id)/i,
];
