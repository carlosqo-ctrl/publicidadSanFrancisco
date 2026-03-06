import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const API_KEY = Deno.env.get("CLOUDINARY_API_KEY")!;
const API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Responder al preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const { public_id } = await req.json();
  if (!public_id) {
    return new Response("Missing public_id", { status: 400, headers: corsHeaders });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const str = `public_id=${public_id}&timestamp=${timestamp}${API_SECRET}`;

  const encoded = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", encoded);
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const form = new FormData();
  form.append("public_id", public_id);
  form.append("signature", signature);
  form.append("api_key", API_KEY);
  form.append("timestamp", timestamp);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/destroy`,
    { method: "POST", body: form }
  );

  const result = await res.json();

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});