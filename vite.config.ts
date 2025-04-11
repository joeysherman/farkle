import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig } from "vitest/config";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(), 
		TanStackRouterVite(), 
		viteStaticCopy({
			targets: [
				{
					src: normalizePath(path.resolve('./src/assets/locales')),
					dest: normalizePath(path.resolve('./dist'))
				}
			]
		}),
		VitePWA({
			registerType: 'autoUpdate',
			devOptions: {
				enabled: true,
				type: 'module',
			},
			manifest: {
				name: 'Vite React Boilerplate',
				short_name: 'Vite React',
				description: 'A production ready, batteries included starter template for Vite + React projects',
				theme_color: '#ffffff',
				icons: [
					{
						src: 'icons/icon-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: 'icons/icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
					},
					{
						src: 'icons/icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}'],
				cleanupOutdatedCaches: true,
				skipWaiting: true,
				clientsClaim: true,
			},
			includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
		})
	],
	server: {
		host: true,
		strictPort: true,
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		css: true,
	},
	assetsInclude: ['**/*.glb'],
	build: {
		rollupOptions: {
			output: {
				assetFileNames: 'assets/[name]-[hash][extname]'
			}
		}
	}
});
