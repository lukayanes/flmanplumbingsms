export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    console.log("VERSION TEST 2026-02-04-204");

    const form = await request.formData();

    // honeypot (silently succeed)
    if (form.get("_gotcha")) {
      return new Response(null, { status: 204 });
    }

    const name = form.get("fullName") || "";
    const phone = form.get("phone") || "";
    const email = form.get("email") || "";
    const message = form.get("message") || "";

    const smsBody =
`New website lead:
Name: ${name}
Phone: ${phone}
Email: ${email}
Message: ${message}`;

    const auth = btoa(
      `${env.TWILIO_API_KEY_SID}:${env.TWILIO_API_KEY_SECRET}`
    );

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          To: "+19139577764",
          MessagingServiceSid: "MG5a89f3068db9e5c114c72f1dfe78ce75",
          Body: smsBody
        })
      }
    );

    // surface Twilio errors if they happen
    if (!res.ok) {
      const err = await res.text();
      console.error("Twilio error:", err);
      return new Response(null, { status: 500 });
    }

    // SUCCESS — JS-friendly, no parsing, no network error
    return new Response(null, { status: 204 });
  }
};
