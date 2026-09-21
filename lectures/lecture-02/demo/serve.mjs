import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 5502;
const root = dirname(fileURLToPath(import.meta.url));

const routes = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
]);

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);
  const route = routes.get(requestUrl.pathname);

  if (!route) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Страница не найдена");
    return;
  }

  try {
    const content = await readFile(join(root, route.file));
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": route.type,
    });
    response.end(content);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Не удалось прочитать файл");
  }
});

server.listen(port, host, () => {
  console.log(`Демонстрация: http://${host}:${port}/`);
  console.log("Для завершения нажмите Ctrl+C");
});
