async function appendToSheet(env, row) {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const b64 = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsigned = `${b64(header)}.${b64(claim)}`;

  const keyPem = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const keyData = keyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(keyData), c => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  const jwt =
    unsigned +
    "." +
    btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const { access_token } = await tokenRes.json();

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${env.GOOGLE_SHEET_NAME}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [row] })
    }
  );
}


export default {
  async fetch(request, env) {

    // ✅ Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const form = await request.formData();

    if (form.get("_gotcha")) {
      return new Response("OK", { status: 200 });
    }

    const name = form.get("fullName") || "";
    const phone = form.get("phone") || "";
    const email = form.get("email") || "";
    const message = form.get("message") || "";

    const smsBody =
`New Fl Man Plumbing Website Inquiry:
Name: ${name}
Phone: ${phone}
Email: ${email}
Message: ${message}`;

    const auth = btoa(
      `${env.TWILIO_API_KEY_SID}:${env.TWILIO_API_KEY_SECRET}`
    );

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          To: "+19414686310",
          MessagingServiceSid: "MG5a89f3068db9e5c114c72f1dfe78ce75",
          Body: smsBody
        })
      }
    );

    await appendToSheet(env, [
  new Date().toISOString(),
  name,
  phone,
  email,
  message,
  request.headers.get("referer") || "",
  request.headers.get("cf-connecting-ip") || ""
]);


    // ✅ CORS-enabled success response
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
