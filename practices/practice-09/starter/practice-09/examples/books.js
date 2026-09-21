// Отдельный учебный пример, не решение задания с задачами.
import express from 'express';
const app = express();
const books = [{ id: 3, title: 'Алгоритмы' }];
app.get('/books/:id', (req, res) => {
  const book = books.find(item => String(item.id) === req.params.id);
  if (!book) return res.status(404).json({ error: { message: 'Книга не найдена.' } });
  res.json({ data: book });
});
const server = app.listen(5510, '127.0.0.1', () => {
  console.log('Пример: http://127.0.0.1:5510/books/3 — остановка Ctrl+C');
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
