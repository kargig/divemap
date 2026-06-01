export interface Env {
	LLM_CONTENT: R2Bucket;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const filename = url.pathname.slice(1); // e.g. "llms.txt"

		// 1. Only handle specific files, otherwise pass through to main site
		if (filename !== 'llms.txt' && filename !== 'sitemap.xml' && filename !== 'robots.txt' && !filename.endsWith('.md')) {
			return fetch(request);
		}

		// 2. Map to the path where your Python script saves them in R2
		const key = `llm_content/${filename}`;
		
		try {
			const object = await env.LLM_CONTENT.get(key);

			if (!object) {
				// If not in R2, try fetching from the origin server as a backup
				return fetch(request);
			}

			// 3. Set up the response with correct headers
			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('etag', object.httpEtag);
			
			// 4. Apply your requested 24h caching with stale-while-revalidate
			headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=86400, stale-if-error=86400');

			// 5. Add Agent Discoverability Headers
			headers.set('Link', '</openapi.json>; rel="api-catalog", </docs>; rel="service-doc", </llms.txt>; rel="service-desc"');

			// 6. Dynamic Hostname Replacement for text-based files
			const isTextFile = filename === 'sitemap.xml' || filename === 'llms.txt' || filename === 'robots.txt' || filename.endsWith('.md');
			if (isTextFile) {
				const origin = url.origin; // e.g. "https://divemap.blue"
				const hardcodedOrigin = "https://divemap.gr";
				
				let content = await object.text();
				
				// Replace hardcoded domain with the requested one if they differ
				if (origin !== hardcodedOrigin) {
					// We use split/join for a simple global replacement
					content = content.split(hardcodedOrigin).join(origin);
				}

				return new Response(content, {
					headers,
				});
			}

			return new Response(object.body, {
				headers,
			});
		} catch (e) {
			// On error, try to fall back to the origin site
			return fetch(request);
		}
	},
} satisfies ExportedHandler<Env>;