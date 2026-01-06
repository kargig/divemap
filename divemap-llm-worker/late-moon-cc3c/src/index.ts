export interface Env {
	LLM_CONTENT: R2Bucket;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const filename = url.pathname.slice(1); // e.g. "llms.txt"

		// 1. Only handle specific files, otherwise pass through to main site
		if (filename !== 'llms.txt' && !filename.endsWith('.md')) {
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

			return new Response(object.body, {
				headers,
			});
		} catch (e) {
			// On error, try to fall back to the origin site
			return fetch(request);
		}
	},
} satisfies ExportedHandler<Env>;