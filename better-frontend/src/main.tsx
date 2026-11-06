import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import App from './App';
import './styles/tokens.css';
import './styles/glass.css';
import './styles/globals.css';
import './styles/hospital.css';
import './styles/qr-modals.css';
import './styles/dispensary.css';
import './styles/timeline.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

async function prepareApp() {
  // Unconditionally connect to real FastAPI backend database — no MSW mock interception
}

prepareApp().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
