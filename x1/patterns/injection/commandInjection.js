module.exports = [
  /;\s*(cat|ls|whoami|uname|id|ping|wget|curl|bash|sh)/i,
  /&&\s*(cat|ls|whoami|uname|id|ping|wget|curl|bash|sh)/i,
  /\|\|.*?(cat|ls|whoami|uname|id)/i,
  /\b(exec|system|passthru|shell_exec|popen|proc_open)\b/i,
];
