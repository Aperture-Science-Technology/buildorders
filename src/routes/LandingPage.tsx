import { Link } from 'react-router-dom';
import { CIV_NAMES } from '@/lib/civs';
import { CivFlag } from '@/components/CivFlag';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LayersIcon } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Choisissez votre civilisation</h1>
          <p className="text-muted-foreground">
            Parcourez les build orders classés par civilisation.
          </p>
        </div>
        <Button variant="outline" render={<Link to="/builds" />}>
          <LayersIcon />
          Tous les builds
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {CIV_NAMES.map((civ) => (
          <Link key={civ} to={`/builds?civ=${encodeURIComponent(civ)}`}>
            <Card className="h-full items-center gap-3 py-6 text-center transition-colors hover:bg-muted/50">
              <CardContent className="flex flex-col items-center gap-3">
                <CivFlag civ={civ} size="lg" className="size-16" />
                <span className="text-sm font-medium">{civ}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
