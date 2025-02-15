const http = require("http");
const httpProxy = require("http-proxy");
const AttackCleaner = require("./cleaner/attackCleaner");

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  const target = "http://localhost:4000";

  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    let parsedBody = {};
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = {};
    }

    // Placeholder untuk deteksi serangan dari header hasil layer X1
    const detectedAttacks = req.headers["x-detected-attacks"]
      ? JSON.parse(req.headers["x-detected-attacks"])
      : [];

    if (detectedAttacks.length) {
      console.log("Serangan terdeteksi. Melakukan pembersihan payload...");
      parsedBody = AttackCleaner.cleanRequest(parsedBody, detectedAttacks);
    }

    // Update body request dengan payload yang sudah dibersihkan
    const cleanedBody = JSON.stringify(parsedBody);
    req.headers["content-length"] = Buffer.byteLength(cleanedBody);

    proxy.web(req, res, { target, buffer: Buffer.from(cleanedBody) }, (err) => {
      console.error("Proxy error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Proxy error.");
    });
  });

  req.on("error", (err) => {
    console.error("Request Error:", err.message);
    if (!res.headersSent) {
      res.statusCode = 400;
      res.end("Bad Request");
    }
  });
});

const PORT = 7000;
server.listen(PORT, () => {
  console.log(
    `Proxy server is running on port ${PORT}, forwarding to port 4000`
  );
});
