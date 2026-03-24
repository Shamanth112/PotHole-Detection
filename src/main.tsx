import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import App from './App.tsx';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const rootElement = document.getElementById('root')!;

if (!convexUrl) {
  createRoot(rootElement).render(
    <div style={{ padding: '40px', fontFamily: 'sans-serif', color: 'red' }}>
      <h2>Deployment Error: Missing Environment Variable</h2>
      <p>The <code>VITE_CONVEX_URL</code> environment variable is missing.</p>
      <p>Please go to your Vercel project settings, add the environment variable, and redeploy.</p>
    </div>
  );
} else {
  const convex = new ConvexReactClient(convexUrl);
  
  createRoot(rootElement).render(
    <StrictMode>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexAuthProvider>
    </StrictMode>
  );
}
