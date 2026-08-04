import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { PlusIcon, SwordsIcon } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <SwordsIcon className="size-5 text-primary" />
          BuildOrders
        </Link>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" render={<Link to="/new" />}>
            <PlusIcon />
            Créer un build
          </Button>

          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton>
              <Button size="sm">Se connecter</Button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
