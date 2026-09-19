import { createApiServer, readPort } from "../api/server.mjs";
import { createStaticServer, readWebPort } from "./static-server.mjs";

const HOST = "127.0.0.1";
let apiPort;
let webPort;
try {
  apiPort = readPort(process.argv[2] ?? process.env.API_PORT);
  webPort = readWebPort(process.argv[3] ?? process.env.WEB_PORT);
  if (apiPort === webPort) throw new TypeError("Порты API и сайта должны различаться.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const apiServer = createApiServer();
const webServer = createStaticServer(webPort);
let closing = false;

function closeAll(exitCode = 0) {
  if (closing) return;
  closing = true;
  let pending = 2;
  const done = () => {
    pending -= 1;
    if (pending === 0) process.exit(exitCode);
  };
  apiServer.close(done);
  webServer.close(done);
}

function onError(label, port, error) {
  console.error(error.code === "EADDRINUSE" ? `${label}: порт ${port} занят.` : `${label}: ${error.message}`);
  if (apiServer.listening || webServer.listening) closeAll(1);
  else process.exitCode = 1;
}

apiServer.once("error", (error) => onError("API", apiPort, error));
webServer.once("error", (error) => onError("Сайт", webPort, error));

apiServer.listen(apiPort, HOST, () => {
  webServer.listen(webPort, HOST, () => {
    console.log(`Учебный API: http://${HOST}:${apiPort}/api`);
    console.log(`Приложение: http://${HOST}:${webPort}/`);
    console.log(`Проверки: http://${HOST}:${webPort}/checks.html`);
    if (apiPort !== 5505) {
      console.log(`Для другого порта API откройте: http://${HOST}:${webPort}/?api=http://${HOST}:${apiPort}/api`);
    }
    console.log("Остановка обоих серверов: Ctrl+C.");
  });
});

process.on("SIGINT", () => closeAll(0));
process.on("SIGTERM", () => closeAll(0));
