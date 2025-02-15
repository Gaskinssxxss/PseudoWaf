const http = require("http");
const fs = require("fs");
const { parse } = require("querystring");
const AttackDetector = require("./exec/attackDetector");
const DDOSHandler = require("./ddos/ddosHandler");
const AdvancedInputSanitizer = require("./sanitizer/advancedInputSanitizer");
const { handleMultipart } = require("./exec/multipartHandler");

function logToFile(logData) {
  const logFilePath = "reqRes.json";
  let existingLogs = [];

  if (fs.existsSync(logFilePath)) {
    try {
      existingLogs = JSON.parse(fs.readFileSync(logFilePath, "utf-8")) || [];
    } catch (error) {
      console.error("Error parsing JSON file:", error.message);
      existingLogs = [];
    }
  }

  existingLogs.push(logData);
  fs.writeFileSync(logFilePath, JSON.stringify(existingLogs, null, 2));
  console.log(logData);
}

function logRequestResponse(
  req,
  res,
  responseBody = {},
  requestBody = {},
  detectedAttacks = []
) {
  const timestamp = new Date().toISOString();
  const sanitizedHeaders = AdvancedInputSanitizer.sanitize(req.headers);

  const headersToCheck = ["user-agent", "referer", "location"];

  const logData = {
    timestamp,
    request: {
      method: req.method,
      url: req.url,
      headers: sanitizedHeaders,
      body: requestBody,
    },
    response: {
      status: res.statusCode,
      headers: res.getHeaders(),
      body: responseBody,
    },
    detectedAttacks: detectedAttacks.map((attack) => ({
      ...attack,
      message: JSON.parse(attack.message),
    })),
  };
  const detector = new AttackDetector(req.url);
  headersToCheck.forEach((header) => {
    const headerValue = sanitizedHeaders[header];
    if (headerValue) {
      const headerDetected = detector.detect(headerValue, header);
      if (headerDetected.length) {
        detectedAttacks.push(
          ...headerDetected.map((attack) => ({
            type: "Header",
            message: JSON.stringify(JSON.parse(attack), null, 2),
          }))
        );
      }
    }
  });

  logToFile(logData);
  console.log(logData);
}

const delayResponse = (time) =>
  new Promise((resolve) => setTimeout(resolve, time));

http
  .createServer((req, res) => {
    if (req.headers["content-type"]?.includes("multipart/form-data")) {
      handleMultipart(req, res);
      return;
    }

    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      await delayResponse(50);

      let parsedBody = {};
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = parse(body);
      }

      const ddosHandler = new DDOSHandler(100, 30 * 1000);
      const ddosAlert = ddosHandler.detect(clientIP);
      if (ddosAlert) {
        console.warn(ddosAlert);
        res.statusCode = 429;
        res.end("Terlalu Banyak Permintaan. Permintaan Anda diblokir.");
        logRequestResponse(req, res, {}, parsedBody, [
          { type: "DDoS", message: ddosAlert },
        ]);
        return;
      }

      const urlToAnalyze = `http://${req.headers.host}${req.url}`;
      const detector = new AttackDetector(urlToAnalyze);
      const urlParams = new URLSearchParams(req.url.split("?")[1] || "");
      const detectedAttacks = [];

      for (const [param, value] of urlParams) {
        const urlDetected = detector.detect(value, param);
        if (urlDetected.length) {
          detectedAttacks.push(
            ...urlDetected.map((attack) => ({
              type: "URL",
              message: JSON.stringify(JSON.parse(attack), null, 2),
            }))
          );
        }
      }

      if (["POST", "PUT"].includes(req.method)) {
        for (const key in parsedBody) {
          const bodyDetected = detector.detect(parsedBody[key], key);
          if (bodyDetected.length) {
            detectedAttacks.push(
              ...bodyDetected.map((attack) => ({
                type: "Body",
                message: JSON.stringify(JSON.parse(attack), null, 2),
              }))
            );
          }
        }
      }

      const headersToCheck = ["user-agent", "referer", "location"];

      for (const header of headersToCheck) {
        const value = req.headers[header];
        if (value) {
          const headerDetected = detector.detect(value, header);
          if (headerDetected.length) {
            detectedAttacks.push(
              ...headerDetected.map((attack) => ({
                type: "Header",
                message: JSON.stringify(JSON.parse(attack), null, 2),
              }))
            );
          }
        }
      }

      const sanitizedParams = AdvancedInputSanitizer.sanitize(
        Object.fromEntries(urlParams)
      );
      const sanitizedBody = AdvancedInputSanitizer.sanitize(parsedBody);
      const sanitizedBodyString = JSON.stringify(sanitizedBody);

      const proxyReq = http.request(
        {
          hostname: "localhost",
          port: 4000,
          path:
            req.url.split("?")[0] + "?" + new URLSearchParams(sanitizedParams),
          method: req.method,
          headers: {
            ...req.headers,
            "Content-Length": Buffer.byteLength(sanitizedBodyString),
          },
        },
        (proxyRes) => {
          let responseBody = "";
          proxyRes.on("data", (chunk) => {
            responseBody += chunk;
          });

          proxyRes.on("end", () => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            res.end(responseBody);
            logRequestResponse(
              req,
              res,
              JSON.parse(responseBody || "{}"),
              sanitizedBody,
              detectedAttacks
            );
          });
        }
      );

      proxyReq.on("error", (err) => {
        console.error("Proxy Error:", err.message);
        res.statusCode = 502;
        res.end("Bad Gateway");
        logRequestResponse(req, res, {}, sanitizedBody, detectedAttacks);
      });

      if (["POST", "PUT"].includes(req.method)) {
        proxyReq.write(sanitizedBodyString);
      }

      proxyReq.end();
    });

    req.on("error", (err) => {
      console.error("Request Error:", err.message);
      if (!res.headersSent) {
        res.statusCode = 400;
        res.end("Bad Request");
      }
      logRequestResponse(req, res, {}, {}, []);
    });
  })
  .listen(8000, () => {
    console.log("Server Proxy berjalan di http://localhost:8000");
  });
