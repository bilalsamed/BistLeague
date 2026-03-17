const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/yahoo-proxy', '');
  const search = url.search;

  const yahooUrl = `https://query2.finance.yahoo.com${path}${search}`;

  const response = await fetch(yahooUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const data = await response.text();

  return new Response(data, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
});
