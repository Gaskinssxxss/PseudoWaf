module.exports = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
  /on\w+="[^"]*"/i,
  /javascript:/i,
  /(<|%3C).*?alert.*?(>|%3E)/i,
  /(<|%3C).*?document\..*?(>|%3E)/i,
  /(<|%3C).*?window\..*?(>|%3E)/i,
  /(<|%3C).*?eval\(.*?(>|%3E)/i,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i, // Tag <script>
  /javascript:/i, // URI javascript
  /(<|%3C).*?(alert|document\.|window\.|eval\().*?(>|%3E)/i, // Tag HTML atau JS
  /on\w+=["'][^"']*["']/i, // Event handler inline
  /(&lt;|<).*(alert|confirm|prompt).*(&gt;|>)/i, // Entitas HTML untuk XSS
];
