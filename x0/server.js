const http = require("http");
const httpProxy = require("http-proxy");
const fs = require("fs");
const { parse } = require("querystring");
const { detectEncoding } = require("./handler/encodeHandler");
const { handleMultipart } = require("./handler/multipartHandler");

const proxy = httpProxy.createProxyServer({
  target: "http://localhost:8000",
  changeOrigin: true,
});

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
  responseBody,
  formattedQuery,
  formattedBody,
  formattedHeaders
) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    request: {
      method: req.method,
      url: req.url,
      headers: formattedHeaders,
      query: formattedQuery,
      body: formattedBody,
    },
    response: {
      status: res.statusCode,
      headers: res.getHeaders(),
      body: responseBody ? JSON.parse(responseBody) : {},
    },
  };

  logToFile(logData);
}

function simplifyEncodingResult(input, encodingResult) {
  if (
    encodingResult &&
    Object.values(encodingResult).some((result) => result && result.decoded)
  ) {
    const detected = Object.values(encodingResult).find(
      (result) => result && result.decoded
    );
    return {
      raw: input,
      decoded: detected.decoded,
    };
  }
  return {
    raw: input,
    decoded: input,
  };
}

function sanitizePayload(payload) {
  const sanitizedPayload = payload.replace(
    /[^a-zA-Z0-9\s\.\,\-\_\=\&\%\:\?\/\#\~\+\(\)]/g,
    ""
  );
  return sanitizedPayload;
}

const delayResponse = (time) =>
  new Promise((resolve) => setTimeout(resolve, time));

function simplifyHeaderEncoding(headers) {
  const simplifiedHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    simplifiedHeaders[key] = simplifyEncodingResult(
      value,
      detectEncoding(value)
    );
  }

  return simplifiedHeaders;
}

http
  .createServer((req, res) => {
    if (req.headers["content-type"]?.includes("multipart/form-data")) {
      handleMultipart(req, res);
      return;
    }

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

      const rawQuery = req.url.split("?")[1] || "";
      const urlParams = {};
      rawQuery.split("&").forEach((pair) => {
        const [key, value] = pair.split("=");
        if (key) {
          urlParams[key] = decodeURIComponent(value || "");
        }
      });

      const formattedQuery = Object.fromEntries(
        Object.entries(urlParams).map(([key, value]) => [
          key,
          simplifyEncodingResult(value, detectEncoding(value)),
        ])
      );

      const formattedBody = Object.fromEntries(
        Object.entries(parsedBody).map(([key, value]) => [
          key,
          simplifyEncodingResult(value, detectEncoding(value.toString())),
        ])
      );

      const formattedHeaders = simplifyHeaderEncoding(req.headers);

      req.url =
        req.url.split("?")[0] +
        "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(formattedQuery).map(([key, value]) => [
              key,
              value.decoded,
            ])
          )
        ).toString();

      let responseBody = "";
      proxy.once("proxyReq", (proxyReq) => {
        if (["POST", "PUT"].includes(req.method)) {
          const bodyString = JSON.stringify(
            Object.fromEntries(
              Object.entries(formattedBody).map(([key, value]) => [
                key,
                value.decoded,
              ])
            )
          );
          proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyString));
          proxyReq.write(bodyString);
        }
      });

      proxy.on("proxyRes", (proxyRes) => {
        proxyRes.on("data", (chunk) => {
          responseBody += chunk;
        });
        proxyRes.on("end", () => {
          logRequestResponse(
            req,
            res,
            responseBody,
            formattedQuery,
            formattedBody,
            formattedHeaders
          );
        });
      });

      proxy.web(req, res, (err) => {
        if (!res.headersSent) {
          res.statusCode = 502;
          res.end("Bad Gateway");
        }
        console.error("Proxy Error:", err.message);
      });
    });

    req.on("error", (err) => {
      console.error("Request Error:", err.message);
      if (!res.headersSent) {
        res.statusCode = 400;
        res.end("Bad Request");
      }
      logRequestResponse(req, res, "{}", {}, {});
    });
  })
  .listen(9000, () => {
    console.log("Server Proxy berjalan di http://localhost:9000");
  });
