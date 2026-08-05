import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoonIcon, PlusIcon, SunIcon, SwordsIcon, UserIcon, UsersIcon } from 'lucide-react';

function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Changer de thème" />}
      >
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>Clair</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>Sombre</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>Système</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <SwordsIcon className="size-5 text-primary" />
          BuildOrders
        </Link>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" render={<Link to="/guilds" />}>
            <UsersIcon />
            Guildes
          </Button>

          <Button variant="ghost" size="sm" render={<Link to="/profile" />}>
            <UserIcon />
            Profil
          </Button>

          <Button variant="outline" size="sm" render={<Link to="/new" />}>
            <PlusIcon />
            Créer un build
          </Button>

          <ThemeToggle />

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
