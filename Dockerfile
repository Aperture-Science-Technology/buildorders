FROM node:22-alpine AS build
WORKDIR /app

# Pin pnpm to v9 (matches local, avoids pnpm 11 onlyBuiltDependencies workspace-yaml changes)
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --config.minimumReleaseAge=0 --config.onlyBuiltDependencies.esbuild=true

COPY . .
RUN pnpm build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
