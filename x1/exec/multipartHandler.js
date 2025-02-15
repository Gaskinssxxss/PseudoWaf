const multiparty = require("multiparty");
const fs = require("fs");
const httpProxy = require("http-proxy");
const AdvancedInputSanitizer = require("../sanitizer/advancedInputSanitizer");
const AttackDetector = require("./attackDetector");

const proxy = httpProxy.createProxyServer({
  target: "http://localhost:4000",
  changeOrigin: true,
});

function sanitizeFileContent(content) {
  return AdvancedInputSanitizer.sanitize(content);
}

function handleMultipart(req, res) {
  const timestamp = new Date().toISOString();
  console.log("[DEBUG] Received multipart request");

  const form = new multiparty.Form();

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error("[ERROR] Error parsing multipart data:", err);
      res.statusCode = 400;
      res.end("Bad Request: Failed to parse multipart data");
      return;
    }

    const sanitizedFields = {};
    const detectedAttacks = [];
    const parsedFiles = [];

    const detector = new AttackDetector(req.url);

    Object.entries(fields).forEach(([key, values]) => {
      const sanitizedKey = AdvancedInputSanitizer.sanitize(key);
      sanitizedFields[sanitizedKey] = values.map((value) =>
        AdvancedInputSanitizer.sanitize(value)
      );
      values.forEach((value) => {
        detectedAttacks.push(...detector.detect(value, key));
      });
    });

    Object.entries(files).forEach(([fieldName, fileArray]) => {
      fileArray.forEach((file) => {
        const sanitizedFileName = AdvancedInputSanitizer.sanitize(
          file.originalFilename
        );
        const fileContent = fs.readFileSync(file.path, { encoding: "utf8" });
        const sanitizedFileContent = sanitizeFileContent(fileContent);

        detectedAttacks.push(
          ...detector.detect(file.originalFilename, "fileName")
        );
        detectedAttacks.push(...detector.detect(fileContent, "fileContent"));

        parsedFiles.push({
          fieldName,
          originalFilename: sanitizedFileName,
          size: file.size,
          content: sanitizedFileContent,
        });

        fs.unlinkSync(file.path);
      });
    });

    const logData = {
      timestamp,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        fields: sanitizedFields,
        files: parsedFiles,
      },
      response: null,
      detectedAttacks,
    };

    console.log(
      "[DEBUG] Detected Attacks:",
      JSON.stringify(detectedAttacks, null, 2)
    );

    const boundary = req.headers["content-type"].split("boundary=")[1];
    const multipartBody = buildMultipartBody(
      sanitizedFields,
      parsedFiles,
      boundary
    );

    req.headers["content-length"] = Buffer.byteLength(multipartBody);

    proxy.once("proxyReq", (proxyReq) => {
      proxyReq.setHeader(
        "Content-Type",
        `multipart/form-data; boundary=${boundary}`
      );
      proxyReq.write(multipartBody);
    });

    proxy.web(req, res, (err) => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end("Bad Gateway");
        logData.response = {
          status: res.statusCode,
          headers: res.getHeaders(),
          body: "Bad Gateway",
        };
        logToFile(logData);
      }
      console.error("[ERROR] Proxy Error:", err.message);
    });

    proxy.on("proxyRes", (proxyRes) => {
      let responseBody = "";
      proxyRes.on("data", (chunk) => {
        responseBody += chunk;
      });
      proxyRes.on("end", () => {
        if (!res.headersSent) {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          res.end(responseBody);
          logData.response = {
            status: proxyRes.statusCode,
            headers: proxyRes.headers,
            body: JSON.parse(responseBody || "{}"),
          };
          logToFile(logData);
        }
      });
    });
  });
}

function buildMultipartBody(fields, files, boundary) {
  let body = "";

  Object.entries(fields).forEach(([key, values]) => {
    values.forEach((value) => {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name=\"${key}\"\r\n\r\n`;
      body += `${value}\r\n`;
    });
  });

  files.forEach((file) => {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name=\"${file.fieldName}\"; filename=\"${file.originalFilename}\"\r\n`;
    body += `Content-Type: application/octet-stream\r\n\r\n`;
    body += `${file.content}\r\n`;
  });

  body += `--${boundary}--\r\n`;
  return body;
}

function logToFile(logData) {
  const logFilePath = "reqRes.json";
  const existingLogs = fs.existsSync(logFilePath)
    ? JSON.parse(fs.readFileSync(logFilePath, "utf-8"))
    : [];

  const id = existingLogs.length + 1;
  logData.id = id;

  existingLogs.push(logData);
  fs.writeFileSync(logFilePath, JSON.stringify(existingLogs, null, 2));
}

module.exports = { handleMultipart };
