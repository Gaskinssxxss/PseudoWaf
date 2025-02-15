const url = require("url");
const querystring = require("querystring");

const sqlInjectionPatterns = require("../patterns/injection/sqlInjection");
const xssPatterns = require("../patterns/injection/xss");
const rcePatterns = require("../patterns/injection/rce");
const ssrfPatterns = require("../patterns/injection/ssrf");
const idorPatterns = require("../patterns/idor");
const commandInjectionPatterns = require("../patterns/injection/commandInjection");
const sstiPatterns = require("../patterns/injection/ssti");
const xxePatterns = require("../patterns/injection/xxe");
const brokenAccessControlPatterns = require("../patterns/brokenAccessControl");
const csrfPatterns = require("../patterns/csrf");
const corsPatterns = require("../patterns/cors");
const ddosPatterns = require("../patterns/ddos");
const informationExposurePatterns = require("../patterns/informationExposure");
const lfiPatterns = require("../patterns/lfi");
const x0MalwarePatterns = require("../patterns/malware/malware_x0");
const x1MalwarePatterns = require("../patterns/malware/malware_x2");
const x2MalwarePatterns = require("../patterns/malware/malware_x1");
const x3MalwarePatterns = require("../patterns/malware/malware_x3");

class AttackDetector {
  constructor(targetUrl) {
    this.targetUrl = targetUrl;
    this.attackPatterns = {
      sqlInjection: sqlInjectionPatterns,
      // xss: xssPatterns,
      // rce: rcePatterns,
      // ssrf: ssrfPatterns,
      // idor: idorPatterns,
      // commandInjection: commandInjectionPatterns,
      // ssti: sstiPatterns,
      // xxe: xxePatterns,
      // brokenAccessControl: brokenAccessControlPatterns,
      // csrf: csrfPatterns,
      // cors: corsPatterns,
      // ddos: ddosPatterns,
      // informationExposure: informationExposurePatterns,
      // lfi: lfiPatterns,
      // malwareEasy: x0MalwarePatterns,
      // malwareMedium: x1MalwarePatterns,
      // malwareHard: x2MalwarePatterns,
      // malwareVeryHard: x3MalwarePatterns,
    };
  }

  analyze() {
    console.log(`Memeriksa URL: ${this.targetUrl}`);

    const parsedUrl = url.parse(this.targetUrl);
    const params = querystring.parse(parsedUrl.query);

    let detectedAttacks = [];

    for (const [param, values] of Object.entries(params)) {
      const valueArray = Array.isArray(values) ? values : [values];

      for (const value of valueArray) {
        detectedAttacks.push(...this.detect(value, param));
      }
    }

    return detectedAttacks.length
      ? detectedAttacks
      : ["Tidak ditemukan serangan yang mencurigakan pada parameter url."];
  }

  detect(payload, param) {
    let detected = new Set();
    for (const [attackType, patterns] of Object.entries(this.attackPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(payload)) {
          detected.add(
            JSON.stringify(
              {
                attackType: attackType.toUpperCase(),
                param: param,
                payload: payload,
              },
              null,
              2
            )
          );
          break;
        }
      }
    }
    return Array.from(detected);
  }
}

module.exports = AttackDetector;
