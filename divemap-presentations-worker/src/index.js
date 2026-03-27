export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // We only want to handle GET and HEAD requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Strip the '/presentations/' prefix from the URL path to get the exact R2 key.
    // Example: /presentations/20260326-Athens_Python_Meetup.pdf -> 20260326-Athens_Python_Meetup.pdf
    const objectKey = url.pathname.replace('/presentations/', '');

    if (!objectKey) {
      return new Response('File Not Found', { status: 404 });
    }

    // Try to fetch the object from the bound R2 bucket
    const object = await env.PRESENTATIONS_BUCKET.get(objectKey);

    if (object === null) {
      return new Response('404 Not Found', { status: 404 });
    }

    const headers = new Headers();
    
    // Add standard HTTP metadata from the R2 object
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    // Force Cloudflare's Edge to cache the PDF aggressively (1 year)
    // since presentations rarely change once published.
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    // Return the stream
    return new Response(object.body, {
      headers,
    });
  }
};
