import { useState } from 'react';

// Отдельный пример, не решение задачника. Для просмотра временно импортировать в App.
export default function Counter({ step = 1 }) {
  const [count, setCount] = useState(0);
  return (
    <section>
      <p>Счётчик: {count}</p>
      <button type="button" onClick={() => setCount(previous => previous + step)}>
        Увеличить на {step}
      </button>
    </section>
  );
}
