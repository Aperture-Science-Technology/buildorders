# BuildOrders — AoE4 Build Order Analyzer

Analyseur de build orders Age of Empires IV : ingestion par URL, normalisation
en modèle structuré, restitution en cheatsheet / timeline / scénarios branchés.

## Stack
- **Front** : Astro + shadcn/ui (composants stock CLI only, zéro custom CSS/style).
  Îlots React (`client:*`) uniquement pour le interactif (timeline, éditeur scénarios, export PDF).
  Le reste = HTML statique. Build statique servi par conteneur léger.
- **Backend parsing** : Supabase Edge Function (Deno) — fetch aoe4world/youtube/ageofempires,
  normalise vers `BuildOrder`. Parsing déterministe d'abord, LLM en fallback.
- **DB/Auth/Storage** : Supabase (Postgres + RLS + storage PDF).
- **Deploy** : conteneur sur VPS (Dockerfile), derrière Traefik →
  `buildorders.aperture-agency.org` (TLS Let's Encrypt auto).

## Modèle de données (BuildOrder)
```
BuildOrder {
  id: uuid
  civ: string
  type: enum(rush, boom, turtle, fast-castle, defensive, other)
  source_url: string
  source_type: enum(aoe4world, youtube, ageofempires, manual)
  phases: Phase[]
  notes?: string
  scenarios?: Scenario[]
}
Phase {
  age: enum(dark, feudal, castle, imperial)
  time_start: int (secondes depuis 0:00)
  actions: Action[]
  target_resources?: {food, wood, gold, stone}
  target_villagers?: int
}
Action {
  at: int (secondes)
  description: string
  kind?: enum(build, research, train, gather, tech, age-up)
}
Scenario {
  id: uuid
  label: string
  branch_at: int (secondes, point de décision)
  variant: BuildOrder (partiel / référence)
}
```

## État : STUB MODE (sans DB)
- Front affiche un BuildOrder mock (exemple HRE FC) pour valider UI/timeline/cheatsheet.
- Edge Function Deno stub : reçoit `{url}`, retourne mock normalisé (format BuildOrder).
- Supabase client initialisé mais pas connecté (clés via `.env` placeholders).
- Pas de migration SQL requise pour le stub.

## Pipelines d'ingest (cibles futures, pas en stub)
1. aoe4world.com → données déjà structurées (étapes, timings, ressources, vils)
2. youtube.com → description + commentaire épinglé (texte libre)
3. ageofempires.com → HTML guide semi-structuré

## Conventions
- GitFlow : main / develop / feature/BO-xxx. Pas de commit direct main/develop.
- FR pour les comms, EN pour le code.
- shadcn CLI only, vanilla.
