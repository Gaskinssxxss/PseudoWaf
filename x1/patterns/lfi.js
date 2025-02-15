module.exports = [
  /\.\.\/\.\.\/\.\.\/\.\.\/.*/,
  /\.\.\\\.\.\\\.\.\\\.\.\\/,
  /\/etc\/passwd/,
  /\/proc\/self\/environ/,
  /php:\/\/input/,
  /php:\/\/filter/,
  /file:\/\/.*/,
  /\b(base64_encode|base64_decode)\b/,
  /\b(?:cat|head|tail)\b.*(?:\.txt|\.log|\.conf)/,
];
