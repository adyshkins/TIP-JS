import { useState } from 'react';

// Основное задание ПР8. Реализовать эффекты и операции по контракту методички.
// api передаётся зависимостью, поэтому хук проверяется без настоящей сети.
export function useTaskData({ api, filters }) {
  const [snapshot, setSnapshot] = useState({ tasks: [], categories: [], meta: { total: 0 } });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const [pending, setPending] = useState(false);
  // TODO: useEffect с cleanup для загрузки при смене filters и refresh.
  // TODO: игнорировать запоздавшие успехи И ошибки; отменять старый GET.
  // TODO: useRef для немедленной блокировки повторной мутации и её отмены при unmount.
  // TODO: успешная мутация возвращает true и инициирует новый GET;
  //       ошибка мутации возвращает false и сохраняется отдельно от ошибки GET.
  const notImplemented = async () => { throw new Error('Не реализовано: useTaskData'); };
  return {
    snapshot, status, error, mutationError, pending,
    refresh() { throw new Error('Не реализовано: refresh'); },
    saveTask: notImplemented, toggleTask: notImplemented,
    deleteTask: notImplemented, resetData: notImplemented,
  };
}
