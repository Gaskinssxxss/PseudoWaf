module.exports = [
  /<!ENTITY.*?>/i,
  /<!DOCTYPE.*?>/i,
  /<\?xml.*?>/i,
  /SYSTEM\s+["'].*?["']/i,
  /PUBLIC\s+["'].*?["']/i,
];
