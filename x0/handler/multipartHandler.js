const multiparty = require("multiparty");
const fs = require("fs");
const httpProxy = require("http-proxy");
const { detectEncoding } = require("./encodeHandler");

const proxy = httpProxy.createProxyServer({
  target: "http://localhost:8000",
  changeOrigin: true,
});

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

    const parsedFields = Object.fromEntries(
      Object.entries(fields).map(([key, values]) => [key, values.join(",")])
    );

    const parsedFiles = Object.entries(files).flatMap(
      ([fieldName, fileArray]) => {
        return fileArray.map((file) => {
          const fileContent = fs.readFileSync(file.path, { encoding: "utf8" });

          const filenameEncoding = detectEncoding(file.originalFilename);
          const contentEncoding = detectEncoding(fileContent);

          return {
            fieldName,
            originalFilename: {
              raw: file.originalFilename,
              detected: filenameEncoding.detected,
              decoded: filenameEncoding.decoded || file.originalFilename,
            },
            size: file.size,
            content: {
              raw: fileContent,
              detected: contentEncoding.detected,
              decoded: contentEncoding.decoded || fileContent,
            },
          };
        });
      }
    );

    const logData = {
      timestamp,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        fields: parsedFields,
        files: parsedFiles.map((file) => ({
          fieldName: file.fieldName,
          originalFilename: file.originalFilename.decoded,
          size: file.size,
          content: file.content.decoded,
        })),
      },
      response: null,
    };

    console.log(JSON.stringify(logData, null, 2));

    const boundary = req.headers["content-type"].split("boundary=")[1];
    const multipartBody = buildMultipartBody(fields, files, boundary);

    req.headers["content-length"] = Buffer.byteLength(multipartBody);

    console.log("[DEBUG] Forwarding multipart data to proxy");

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
      }
      console.error("[ERROR] Proxy Error:", err.message);
    });

    proxy.on("proxyRes", (proxyRes) => {
      let responseBody = "";

      proxyRes.on("data", (chunk) => {
        responseBody += chunk;
      });

      proxyRes.on("end", () => {
        logData.response = {
          status: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: responseBody,
        };

        console.log(
          "[DEBUG] Proxy Response Captured:",
          JSON.stringify(logData, null, 2)
        );
      });
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(logData.request.files, null, 2));
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

  Object.entries(files).forEach(([fieldName, fileArray]) => {
    fileArray.forEach((file) => {
      const fileContent = fs.readFileSync(file.path);
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name=\"${fieldName}\"; filename=\"${file.originalFilename}\"\r\n`;
      body += `Content-Type: ${file.headers["content-type"]}\r\n\r\n`;
      body += fileContent + "\r\n";
      fs.unlinkSync(file.path);
    });
  });

  body += `--${boundary}--\r\n`;

  return body;
}

module.exports = { handleMultipart };
