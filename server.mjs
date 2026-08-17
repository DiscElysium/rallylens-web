import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.argv[2] || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function safeFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = normalize(join(root, relative));
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return null;
  return filePath;
}

function sendError(response, status, message) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

const server = createServer((request, response) => {
  const filePath = safeFilePath(request.url || "/");
  if (!filePath) {
    sendError(response, 403, "Forbidden");
    return;
  }

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    sendError(response, 404, "Not found");
    return;
  }

  if (!stats.isFile()) {
    sendError(response, 404, "Not found");
    return;
  }

  const size = stats.size;
  const contentType = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  const range = request.headers.range;
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "Content-Type": contentType
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      response.writeHead(416, { ...baseHeaders, "Content-Range": `bytes */${size}` });
      response.end();
      return;
    }

    const requestedStart = match[1] ? Number(match[1]) : 0;
    const requestedEnd = match[2] ? Number(match[2]) : size - 1;
    const start = Math.max(0, requestedStart);
    const end = Math.min(size - 1, requestedEnd);
    if (start > end || start >= size) {
      response.writeHead(416, { ...baseHeaders, "Content-Range": `bytes */${size}` });
      response.end();
      return;
    }

    response.writeHead(206, {
      ...baseHeaders,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${size}`
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, { ...baseHeaders, "Content-Length": size });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`RallyLens is available at http://127.0.0.1:${port}/`);
});

