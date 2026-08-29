import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so one build works from any prefix: a GitHub Pages
  // project site (served from /<repo>/), a Codespaces forwarded port, or a
  // plain local server. An absolute base breaks the Pages case.
  //
  // Note this still needs a server — opening dist/index.html straight off
  // disk fails because browsers block ES modules over file://. `npx serve dist`
  // is enough.
  base: './',
  server: { host: true, port: 5173 },
});
