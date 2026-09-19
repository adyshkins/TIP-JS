// Готовый сервер статических файлов. Не использовать для публикации в интернете.
import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 5506;
const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
]);

function allowedFile(name) {
  return ["index.html", "checks.html", "styles.css"].includes(name)
    || name.startsWith("src/")
    || name === "checks/browser.checks.js";
}

function sendText(res, status, message, head = false) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(head ? undefined : message);
}

export function createStaticServer(port = DEFAULT_PORT) {
  return http.createServer(async (req, res) => {
    const head = req.method === "HEAD";
    if (req.method !== "GET" && !head) {
      res.setHeader("Allow", "GET, HEAD");
      sendText(res, 405, "Method not allowed", head);
      return;
    }

    try {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, `http://${HOST}:${port}`).pathname);
      } catch {
        sendText(res, 400, "Bad request", head);
        return;
      }
      if (pathname.includes("\\") || pathname.includes("\0")
          || pathname.split("/").some((part) => part.startsWith("."))) {
        sendText(res, 403, "Forbidden", head);
        return;
      }
      const name = pathname === "/" ? "index.html" : pathname.slice(1);
      const type = types.get(path.extname(name));
      if (!allowedFile(name) || !type) {
        sendText(res, 404, "Not found", head);
        return;
      }
      const filename = await realpath(path.join(root, name));
      const relative = path.relative(root, filename);
      if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
        sendText(res, 403, "Forbidden", head);
        return;
      }
      const content = await readFile(filename);
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": content.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(head ? undefined : content);
    } catch (error) {
      if (["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) sendText(res, 404, "Not found", head);
      else {
        console.error(error);
        sendText(res, 500, "Internal server error", head);
      }
    }
  });
}

export function readWebPort(raw, fallback = DEFAULT_PORT) {
  const port = Number(raw ?? fallback);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new TypeError("Порт должен быть целым числом от 1024 до 65535.");
  }
  return port;
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  let port;
  try {
    port = readWebPort(process.argv[2] ?? process.env.WEB_PORT);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const server = createStaticServer(port);
  server.on("error", (error) => {
    console.error(error.code === "EADDRINUSE" ? `Порт сайта ${port} занят.` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, HOST, () => {
    console.log(`Приложение: http://${HOST}:${port}/`);
    console.log(`Проверки: http://${HOST}:${port}/checks.html`);
  });
}
