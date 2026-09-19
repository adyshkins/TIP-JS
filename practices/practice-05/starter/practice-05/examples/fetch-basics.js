const baseUrl = process.env.API_URL ?? "http://127.0.0.1:5505/api";

try {
  const response = await fetch(`${baseUrl}/tasks?completed=false&priority=high`);

  console.log("status:", response.status);
  console.log("ok:", response.ok);
  console.log("content-type:", response.headers.get("content-type"));

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  console.log("ids:", payload.data.map((task) => task.id));
  console.log("meta:", payload.meta);
} catch (error) {
  console.error("Запрос не выполнен:", error.message);
  process.exitCode = 1;
}
