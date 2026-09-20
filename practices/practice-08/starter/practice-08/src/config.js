import { createApiClient } from './api-client.js';
import { createTaskApi } from './task-api.js';
// Создаётся один раз, вне компонента: ссылка api стабильна между рендерами.
export const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5505/api';
export const api = createTaskApi(createApiClient({ baseUrl: apiBaseUrl }));
