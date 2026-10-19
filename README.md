# Mechanical Drawing Visualizer

Interactive Chinese-language teaching app for point, line, plane, and solid orthographic projections, built with Three.js and Vite.

## Local development

Requires Node.js 22 and npm.

```sh
npm ci
npm run dev
```

## Production build

```sh
npm run build
npm run preview
```

## GitHub Pages

In repository Settings > Pages, set the build source to GitHub Actions.
The deployment workflow builds and publishes the app whenever main is updated.
Only the contents of dist are published; students need only the website link.
