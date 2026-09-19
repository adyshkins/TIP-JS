const STORAGE_KEY = "tip-js-practice-04:lab";
const form = document.querySelector("#lab-form");
const titleInput = document.querySelector("#lab-title");
const errorElement = document.querySelector("#lab-title-error");
const logElement = document.querySelector("#lab-log");

function log(...values) {
  logElement.textContent = values.map((value) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  }).join("\n");
}

titleInput.addEventListener("input", () => {
  titleInput.setCustomValidity("");
  errorElement.textContent = "";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const rawTitle = formData.get("title");
  const priority = formData.get("priority");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";

  if (title.length === 0) {
    const message = "Название не должно состоять только из пробелов.";
    titleInput.setCustomValidity(message);
    errorElement.textContent = message;
    titleInput.reportValidity();
    log("submit получен, но прикладная проверка отклонила значение.");
    return;
  }

  const value = { title, priority };
  const serialized = JSON.stringify(value);
  localStorage.setItem(STORAGE_KEY, serialized);

  log(
    `submit.defaultPrevented: ${event.defaultPrevented}`,
    `typeof FormData title: ${typeof rawTitle}`,
    `typeof localStorage value: ${typeof localStorage.getItem(STORAGE_KEY)}`,
    { value, serialized },
  );
});

document.querySelector("#load-value").addEventListener("click", () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    log("getItem вернул null: записи нет.");
    return;
  }

  try {
    log("JSON прочитан успешно:", { raw, parsed: JSON.parse(raw) });
  } catch (error) {
    log("JSON.parse завершился ошибкой:", error.message, { raw });
  }
});

document.querySelector("#write-broken").addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEY, "{broken-json");
  log("В учебный ключ записана строка с повреждённым JSON.");
});

document.querySelector("#remove-value").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  log("Учебный ключ удалён.", `getItem: ${localStorage.getItem(STORAGE_KEY)}`);
});
