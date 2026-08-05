import { ClerkProvider } from '@clerk/clerk-react';
import { ThemeProvider } from 'next-themes';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Toaster } from '@/components/ui/sonner';
import { LandingPage } from '@/routes/LandingPage';
import { ListPage } from '@/routes/ListPage';
import { DetailPage } from '@/routes/DetailPage';
import { NewPage } from '@/routes/NewPage';
import { EditPage } from '@/routes/EditPage';
import { PlayPage } from '@/routes/PlayPage';
import { GuildsPage } from '@/routes/GuildsPage';
import { ProfilePage } from '@/routes/ProfilePage';
import { UserProfilePage } from '@/routes/UserProfilePage';

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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Header />
            <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/builds" element={<ListPage />} />
                <Route path="/build/:id" element={<DetailPage />} />
                <Route path="/new" element={<NewPage />} />
                <Route path="/edit/:id" element={<EditPage />} />
                <Route path="/play/:id" element={<PlayPage />} />
                <Route path="/guilds" element={<GuildsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/u/:id" element={<UserProfilePage />} />
              </Routes>
            </main>
          </div>
          <Toaster />
        </BrowserRouter>
      </ClerkProvider>
    </ThemeProvider>
  );
}
