// Перед запуском необходимо заполнить столбец «Прогноз» в отчёте.
// Блоки независимы: повторяющиеся имена не конфликтуют.

console.log("Эксперимент 1. Параметры и возвращаемое значение");
{
  function sum(a, b) {
    return a + b;
  }
  console.log(sum(2, 3));
  console.log(sum("2", 3));
}

console.log("Эксперимент 2. Тело стрелочной функции");
{
  // Здесь намеренно пропущен return. Исправление входит в задание 1.
  const square = (value) => {
    value * value;
  };
  console.log(square(4));
}

console.log("Эксперимент 3. Два имени одного объекта");
{
  const product = { name: "Папка", stock: 3 };
  const alias = product;
  alias.stock = 5;
  console.log(product.stock);
  console.log(product === alias);
}

console.log("Эксперимент 4. Копия массива с объектом");
{
  const products = [{ name: "Папка", stock: 3 }];
  const copy = [...products];
  copy[0].stock = 7;
  console.log(products[0].stock);
  console.log(products === copy);
  console.log(products[0] === copy[0]);
}

console.log("Эксперимент 5. Копия объекта и порядок свойств");
{
  const product = { name: "Папка", stock: 3 };
  const first = { ...product, stock: 8 };
  const second = { stock: 8, ...product };
  console.log(product.stock, first.stock, second.stock);
  console.log(product === first);
}

console.log("Эксперимент 6. Параметр по умолчанию");
{
  function makeCaption(text = "Без названия") {
    return text;
  }
  console.log(makeCaption());
  console.log(makeCaption(undefined));
  console.log(makeCaption(null));
  console.log(makeCaption(""));
}
