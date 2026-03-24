import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import App from './App.tsx';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
console.log("DEBUG: VITE_CONVEX_URL is:", convexUrl);
const rootElement = document.getElementById('root')!;
console.log("DEBUG: rootElement found:", !!rootElement);

if (!convexUrl || convexUrl === 'undefined') {
  console.log("DEBUG: Rendering Missing Env fallback");
  createRoot(rootElement).render(
    <div style={{ padding: '40px', background: 'white', color: 'red', border: '10px solid red', zIndex: 9999 }}>
      <h2>Deployment Error: Missing Environment Variable</h2>
      <p>The <code>VITE_CONVEX_URL</code> environment variable is missing.</p>
      <p>Please go to your Vercel project settings, add the environment variable, and redeploy.</p>
    </div>
  );
} else {
  console.log("DEBUG: Attempting to initialize Convex with:", convexUrl);
  let convex: ConvexReactClient;
  try {
    convex = new ConvexReactClient(convexUrl);
    console.log("DEBUG: Convex client initialized");
  } catch (err: any) {
    console.log("DEBUG: Convex initialization failed:", err);
    createRoot(rootElement).render(
      <div style={{ padding: '40px', background: 'white', color: 'red', border: '10px solid red' }}>
        <h2>Deployment Error: Invalid VITE_CONVEX_URL</h2>
        <p>The URL provided (<code>{convexUrl}</code>) is not a valid URL.</p>
        <p>Error details: {err.message}</p>
      </div>
    );
    throw err;
  }
  
  console.log("DEBUG: Restoring Full App...");
  
  // A simple Error Boundary component
  class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any}> {
    constructor(props: {children: ReactNode}) { 
      super(props); 
      this.state = { hasError: false, error: null }; 
    }
    static getDerivedStateFromError(error: any) { 
      return { hasError: true, error }; 
    }
    componentDidCatch(error: any, errorInfo: any) { 
      console.error("REACT BOUNDARY CAUGHT:", error, errorInfo); 
    }
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ padding: '40px', background: 'white', color: 'red', border: '10px solid red', zIndex: 9999, position: 'relative' }}>
            <h1>Something went wrong in the App.</h1>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#fee', padding: '10px' }}>
              {this.state.error?.toString() || 'Unknown error'}
            </pre>
            <p>Check the browser console for more details.</p>
          </div>
        );
      }
      return this.props.children;
    }
  }

  try {
    createRoot(rootElement).render(
      <ErrorBoundary>
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ConvexAuthProvider>
      </ErrorBoundary>
    );
    console.log("DEBUG: Full app render call complete");
  } catch (renderErr: any) {
    console.log("DEBUG: Full app render call crashed:", renderErr);
    document.body.innerHTML = `<h1 style="color:red">REACT RENDER CRASH: ${renderErr.message}</h1>`;
  }
}
