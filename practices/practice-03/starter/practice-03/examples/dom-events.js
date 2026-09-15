const card = document.querySelector("#lab-card");
const button = document.querySelector("#lab-button");
const title = document.querySelector("#lab-title");
const list = document.querySelector("#lab-list");
const log = document.querySelector("#lab-log");
const initialItems = list.querySelectorAll("li");
let counter = 1;
let eventNumber = 0;

console.log("Отсутствующий элемент:", document.querySelector("#absent"));
console.log("Пустая коллекция:", document.querySelectorAll(".absent").length);
console.log("dataset.taskId:", button.dataset.taskId, typeof button.dataset.taskId);
console.log("Числовой id:", Number(button.dataset.taskId));
console.log("Исходная длина NodeList:", initialItems.length);

function record(event) {
  eventNumber += 1;
  const targetId = event.target instanceof Element ? event.target.id : "не Element";
  const entry = `${eventNumber}. phase=${event.eventPhase}; target=${targetId}; currentTarget=${event.currentTarget.id}`;
  console.log(entry);
  log.textContent += `\n${entry}`;
}
card.addEventListener("click", record, { capture: true });
button.addEventListener("click", (event) => {
  record(event);
  title.textContent = "<strong>Это текст, а не HTML</strong>";
});
card.addEventListener("click", record);

document.querySelector("#append-button").addEventListener("click", () => {
  counter += 1;
  const item = document.createElement("li");
  item.textContent = `Запись ${counter}`;
  list.append(item);
  console.log("Старый NodeList:", initialItems.length);
  console.log("Новый querySelectorAll:", list.querySelectorAll("li").length);
});
