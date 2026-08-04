var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
async function appendToSheet(env, row) {
  const now = Math.floor(Date.now() / 1e3);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const b64 = /* @__PURE__ */ __name((obj) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64");
  const unsigned = `${b64(header)}.${b64(claim)}`;
  const keyPem = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const keyData = keyPem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\n/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = unsigned + "." + btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  const tokenJson = await tokenRes.json();
  const access_token = tokenJson.access_token;
  if (!access_token) throw new Error("google token error: " + JSON.stringify(tokenJson).slice(0, 200));
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(env.GOOGLE_SHEET_NAME)}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [row] })
    }
  );
  if (!appendRes.ok) throw new Error("sheets append " + appendRes.status + ": " + (await appendRes.text()).slice(0, 200));
}
__name(appendToSheet, "appendToSheet");
var index_default = {
  async fetch(request, env) {
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


// Honeypot protection

if (form.get("_gotcha") || form.get("referral_code")) {

  return new Response("Spam blocked", { status: 400 });

}



// reCAPTCHA verification

const captcha = form.get("g-recaptcha-response");

if (!captcha) {

  return new Response("Captcha missing", { status: 400 });

}


const verify = await fetch(
  "https://www.google.com/recaptcha/api/siteverify",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      secret: env.RECAPTCHA_SECRET,
      response: captcha,
      remoteip: request.headers.get("cf-connecting-ip")
    })
  }
);


const captchaResult = await verify.json();


if (!captchaResult.success) {

  return new Response("Captcha failed", { status: 400 });

}
// Anti-spam: request should come from our site. We only BLOCK when a
// referer is present and clearly off-site — an empty/stripped referer is
// allowed (honeypot + reCAPTCHA already gate spam) so we never lose a real lead.
const referer = request.headers.get("referer") || "";
const ALLOWED = ["callprolific.com", "flmanplumbing.com", ".workers.dev", "localhost"];
if (referer && !ALLOWED.some((h) => referer.includes(h))) {
  return new Response("Blocked", { status: 403 });
}

    const name = form.get("fullName") || "";
    const phone = form.get("phone") || "";
    const email = form.get("email") || "";
    const message = form.get("message") || "";
    const smsBody = `New Prolific Plumbing Website Inquiry:
Name: ${name}
Phone: ${phone}
Email: ${email}
Message: ${message}`;

    // Run SMS + Sheet independently so one failing can't block the other.
    const errors = [];
    try {
      const auth = btoa(`${env.TWILIO_API_KEY_SID}:${env.TWILIO_API_KEY_SECRET}`);
      const tw = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            To: "+19414686310",
            MessagingServiceSid: "MG5a89f3068db9e5c114c72f1dfe78ce75",
            Body: smsBody
          })
        }
      );
      if (!tw.ok) errors.push("twilio " + tw.status + ": " + (await tw.text()).slice(0, 200));
    } catch (e) { errors.push("twilio_exc: " + e); }

    try {
      await appendToSheet(env, [
        new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
        name, phone, email, message,
        referer,
        request.headers.get("cf-connecting-ip") || ""
      ]);
    } catch (e) { errors.push("sheet_exc: " + e); }

    if (errors.length) console.log("lead-webhook errors:", JSON.stringify(errors));

    return new Response("OK", {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
