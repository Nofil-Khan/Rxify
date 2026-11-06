import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_API_BASE_URL) {
    return Promise.resolve();
  }

  await worker.start({
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });
}
