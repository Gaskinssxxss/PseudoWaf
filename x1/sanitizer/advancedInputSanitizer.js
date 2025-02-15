const patterns = {
  sqlInjection: require("../patterns/injection/sqlInjection"),
  xss: require("../patterns/injection/xss"),
  rce: require("../patterns/injection/rce"),
  ssrf: require("../patterns/injection/ssrf"),
  idor: require("../patterns/idor"),
  commandInjection: require("../patterns/injection/commandInjection"),
  ssti: require("../patterns/injection/ssti"),
  xxe: require("../patterns/injection/xxe"),
  brokenAccessControl: require("../patterns/brokenAccessControl"),
  csrf: require("../patterns/csrf"),
  cors: require("../patterns/cors"),
  ddos: require("../patterns/ddos"),
  informationExposure: require("../patterns/informationExposure"),
  lfi: require("../patterns/lfi"),
  malwareEasy: require("../patterns/malware/malware_x0"),
  malwareMedium: require("../patterns/malware/malware_x1"),
  malwareHard: require("../patterns/malware/malware_x2"),
  malwareVeryHard: require("../patterns/malware/malware_x3"),
};

class AdvancedInputSanitizer {
  static sanitize(input) {
    if (typeof input === "string") {
      return this.cleanString(input);
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitize(item));
    }

    if (typeof input === "object" && input !== null) {
      return Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, this.sanitize(value)])
      );
    }

    return input;
  }

  static cleanString(input) {
    let sanitizedInput = input;

    for (const [patternType, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        sanitizedInput = sanitizedInput.replace(regex, "");
      }
    }

    return sanitizedInput;
  }
}

module.exports = AdvancedInputSanitizer;
