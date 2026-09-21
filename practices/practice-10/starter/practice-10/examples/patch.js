// Пример частичного обновления, не полное решение серверного задания.
const book = { id: 7, title: 'Алгоритмы', available: true };
const changes = { title: 'Алгоритмы и структуры данных' };
const updated = { ...book, ...changes, id: book.id };
console.log({ book, changes, updated });
console.log('Непереданное поле available сохранено:', updated.available);
// Перед spread входные поля уже должны пройти валидацию и allowlist.
