import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig } from "vitest/config";
import { VitePWA } from 'vite-plugin-pwa';

// determine if we are in production or development
const isProduction = process.env.NODE_ENV === 'production';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		TanStackRouterVite(), 
		react(), 
		viteStaticCopy({
			targets: [
				{
					src: normalizePath(path.resolve('./src/assets/locales')),
					dest: normalizePath(path.resolve('./dist'))
				},
				{
					src: normalizePath(path.resolve('./public/firebase-messaging-sw.js')),
					dest: normalizePath(path.resolve('./dist'))
				}
			]
		}),
		// VitePWA({
		// 	registerType: 'autoUpdate',
		// 	devOptions: {
		// 		enabled: !isProduction,
		// 		type: 'module',
		// 	},
		// 	manifest: {
		// 		name: 'Farkle Online',
		// 		display: 'standalone',
		// 		short_name: 'Farkle',
		// 		description: 'Farkle is a dice game where your decisions and luck determine your outcome.',
		// 		theme_color: '#4f46e5',
		// 		background_color: '#ffffff',
		// 		icons: [
		// 			{
		// 				src: 'icon-192.png',
		// 				sizes: '192x192',
		// 				type: 'image/png'
		// 			},
		// 			{
		// 				src: 'icon-512.png',
		// 				sizes: '512x512',
		// 				type: 'image/png'
		// 			},
		// 			{
		// 				src: 'icon-512.png',
		// 				sizes: '512x512',
		// 				type: 'image/png',
		// 				purpose: 'maskable'
		// 			}
		// 		]
		// 	},
		// 	// manifest: {
		// 	// 	name: 'Vite React Boilerplate',
		// 	// 	short_name: 'Vite React',
		// 	// 	description: 'A production ready, batteries included starter template for Vite + React projects',
		// 	// 	theme_color: '#ffffff',
		// 	// 	icons: [
		// 	// 		{
		// 	// 			src: '/icons/icon-192x192.svg',
		// 	// 			sizes: '192x192',
		// 	// 			type: 'image/svg+xml',
		// 	// 		},
		// 	// 		{
		// 	// 			src: '/icons/icon-512x512.svg',
		// 	// 			sizes: '512x512',
		// 	// 			type: 'image/svg+xml',
		// 	// 		},
		// 	// 		{
		// 	// 			src: '/icons/icon-512x512.svg',
		// 	// 			sizes: '512x512',
		// 	// 			type: 'image/svg+xml',
		// 	// 			purpose: 'any maskable',
		// 	// 		},
		// 	// 	],
		// 	// },
		// 	workbox: {
		// 		globPatterns: ['**/*.{js,css,html,ico,svg,png,json}'],
		// 		cleanupOutdatedCaches: true,
		// 		skipWaiting: true,
		// 		clientsClaim: true,
		// 		navigateFallback: '/index.html',
		// 		navigateFallbackAllowlist: [/^(?!\/__).*/],
		// 		runtimeCaching: [
		// 			{
		// 				urlPattern: /^https:\/\/www\.gstatic\.com\/.*/i,
		// 				handler: 'CacheFirst',
		// 				options: {
		// 					cacheName: 'gstatic-cache',
		// 					expiration: {
		// 						maxEntries: 10,
		// 						maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
		// 					},
		// 					cacheableResponse: {
		// 						statuses: [0, 200]
		// 					}
		// 				}
		// 			}
		// 		]
		// 	},
		// 	//includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
		// })
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
