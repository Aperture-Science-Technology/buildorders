import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Toaster } from '@/components/ui/sonner';
import { ListPage } from '@/routes/ListPage';
import { DetailPage } from '@/routes/DetailPage';
import { NewPage } from '@/routes/NewPage';
import { EditPage } from '@/routes/EditPage';
import { PlayPage } from '@/routes/PlayPage';

const CLERK_PUBLISHABLE_KEY = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

export function App() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-destructive">
          Missing PUBLIC_CLERK_PUBLISHABLE_KEY — authentication is unavailable.
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
            <Routes>
              <Route path="/" element={<ListPage />} />
              <Route path="/build/:id" element={<DetailPage />} />
              <Route path="/new" element={<NewPage />} />
              <Route path="/edit/:id" element={<EditPage />} />
              <Route path="/play/:id" element={<PlayPage />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </BrowserRouter>
    </ClerkProvider>
  );
}
