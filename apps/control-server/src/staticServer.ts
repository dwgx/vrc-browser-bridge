import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const contentTypes = new Map<string, string>([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

export function createStaticHandler(root: string) {
  const resolvedRoot = resolve(root);

  return async function handleStaticRequest(request: IncomingMessage, response: ServerResponse) {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
      const filePath = normalize(join(resolvedRoot, decodeURIComponent(pathname)));

      if (!filePath.startsWith(resolvedRoot)) {
        sendText(response, 403, "Forbidden");
        return;
      }

      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        sendText(response, 404, "Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
        "Content-Length": fileStat.size
      });
      createReadStream(filePath).pipe(response);
    } catch {
      sendText(response, 404, "Not found");
    }
  };
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function sendText(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}
