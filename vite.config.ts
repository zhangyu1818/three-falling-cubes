import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  base: '/three-falling-cubes/',
  plugins: [wasm()],
})
