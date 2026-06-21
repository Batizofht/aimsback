import { Request, Response } from "express";

/**
 * AIMS Capital AI chatbot proxy ("AIMS Assistant").
 *
 * Calls Groq (OpenAI-compatible chat-completions, fast open-source Llama models).
 * The API key stays on the server — never exposed to the browser.
 *
 * Configure via server/.env:
 *   GROQAPI=gsk_...                                  (required)
 *   GROQ_MODEL=llama-3.3-70b-versatile              (optional)
 *   GROQ_URL=https://api.groq.com/openai/v1/chat/completions  (optional)
 *
 * Falls back to OPENROUTER_* if GROQAPI is not set, so the endpoint is portable.
 * Until a key exists the endpoint still returns HTTP 200 with a friendly message.
 *
 * Bilingual: replies ONLY in English or French, matching the user's language.
 */

// Knowledge base — grounded in the firm's verified facts (company profile + feedback memo).
const KNOWLEDGE = `
ABOUT AIMS CAPITAL ASSOCIATES
- A Rwandan corporate law firm and investment advisory, based in Kigali, Rwanda.
- Established in 2011; formally incorporated and licensed by the Rwanda Capital Markets Authority (CMA) in 2013 under the name "AIMS Capital Associates".
- Incorporated in both Rwanda and Delaware, USA (2019).
- Founded by Counsel Alloys Mutabingwa, FCIArb (Fellow of the Chartered Institute of Arbitrators), who owns 100% of the shares.
- Rwanda-first focus: serving Rwanda's growth — supporting infrastructure, technology and access to funding. Do NOT describe the firm as a "global investor" platform.
- Sole Advisor on Climate Finance and investment in Rwanda; a Professional Service Provider under the Kigali International Financial Centre (KIFC) framework.
- Member of the Rwanda Capital Markets Authority (CMA) and the Rwanda Bar Association.

CONTACT
- Office: KG 5 Ave, Plot 2, Kacyiru (near KBC), Gasabo District, Kigali, Rwanda.
- Phone / WhatsApp: +250 788 309 268. Email: attorneys@aimscapital.org.
- Business hours: Monday–Friday, 8:00 AM – 5:00 PM (CAT).

SERVICES
- Corporate Law (alternative investment markets advisory, insolvency & restructuring, contract management)
- Projects (advice, management, financing)
- Litigation (commercial litigation, alternative dispute settlement / ADR)
- Consulting (legal advisory, transaction advisory)
- Infrastructure (utility agency services, technology agency services)

PRACTICE AREAS (12)
Arbitration & Litigation; Aviation; Finance & Investments; Construction & Infrastructure;
Contract Management; Health; Insolvency & Receivership; Land, Property & Conveyance;
Legal Representation & Drafting; Legal Consultancy; Tax; Technology.

NOTABLE PROJECTS
- Kigali Water Limited PPP (Bugesera): advised the Government of Rwanda on the ~US$63M Kigali Bulk Water Supply project — the first competitively tendered Build-Operate-Transfer (BOT) bulk water concession in sub-Saharan Africa. Operational since 10 February 2021, delivering 40 million litres/day. Financed by EAIF, the African Development Bank (AfDB) and Metito equity, with a MIGA (World Bank Group) guarantee.
- Rwanda National Land Use Master Plan 2020–2050: consortium partner with Tzamir Architects & Planners (Israel) and Horwath HTL; led by RLMUA. Cabinet approved 29 July 2020; Presidential Order No. 038/01 of 20 May 2022 gave it legal force. The firm drafted the Presidential Order.
- CDM Projects Review for UNDP: reviewed 50+ Clean Development Mechanism projects worth ~US$610M; pitch-book prepared for COP28 (Dubai, Nov 2023).
- EWSA Corporatization (World Bank funded): led to the formation of REG (Rwanda Energy Group) and WASAC (2014).
- Sustainable Finance Roadmap (2022–2029) for KIFC/UNDP with GBRW and Garnet Partners; launched 26 Oct 2022; catalysed EUR 300M+ in climate finance.
- Waste Management Pilot Study (AfDB, 2017) with Planet Partnerships across Rwanda, Ethiopia and Algeria.
- Aviation advisory (Avia Group, RwandAir, Nexus Group); Affordable Housing (Nyanza, Rwamagana); Zhong Tong electric mobility representation across Africa.

PARTNERSHIPS
Pinsent Masons LLP (via Johannesburg, AfCFTA focus), Lex Africa Alliance (26 African countries — Counsel Mutabingwa is a member), Metito, Avia Group, Nexus Group, Zhong Tong, Tzamir Architects & Planners, Horwath HTL, KIFC, and others.

KEY PEOPLE
- Counsel Alloys Mutabingwa, FCIArb — Founding Managing Partner. 22+ years at the Bar (Rwanda & Tanzania); KIAC International Arbitrator; Founding Chairman of CIArb Rwanda; former Deputy Secretary General of the East African Community (EAC).
- Scovia Basaliza Gahongayire — Resident Partner (Delaware, USA).
- Counsel Olivier Munyabuhoro — Team Leader, Litigation.
- Eng. James Sano — Partner, Water & Sanitation (first CEO of WASAC).

WEBSITE ACTIONS
- To book a meeting: use the "Book Consultation" button (bottom-right) or the Contact page.
- To become a member: the Membership / Register page.
- Publications and articles are on the Blog and Publications pages.
`.trim();

const SYSTEM_PROMPT = `You are "AIMS Assistant", the friendly online support assistant for AIMS Capital Associates, a Rwandan corporate law firm and investment advisory in Kigali, Rwanda.

Use ONLY the knowledge below to answer. Do not invent facts, figures, names, dates or services that are not stated here.

${KNOWLEDGE}

RULES:
- LANGUAGE: Reply ONLY in English or French. Detect the language of the user's latest message and reply in that same language. If the user writes in any other language, politely reply (in English) that you can assist in English or French only, and ask which they prefer. Never reply in any language other than English or French.
- Be concise, professional, warm and helpful. Keep answers to 2–4 sentences unless the user asks for detail.
- Speak with a Rwanda-first perspective.
- You are NOT a lawyer and must NOT give binding legal advice. For specific legal matters, recommend booking a consultation with the AIMS Capital team.
- For booking, direct users to the "Book Consultation" button or the Contact page. To become a member, direct them to the Membership page.
- If a question is outside what you know, say so honestly and offer to connect them with the team via the Contact page or WhatsApp (+250 788 309 268). Do not make things up.`;

interface ChatMessageInput {
  role: "user" | "assistant" | "system";
  content: string;
}

export const chat = async (req: Request, res: Response) => {
  try {
    const { messages, lang } = req.body as { messages?: ChatMessageInput[]; lang?: string };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Sanitize: only keep user/assistant turns with string content, cap history length.
    const history = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (history.length === 0) {
      return res.status(400).json({ error: "No valid messages provided" });
    }

    // Prefer Groq; fall back to OpenRouter if Groq isn't configured.
    const groqKey = process.env.GROQAPI;
    const apiKey = groqKey || process.env.OPENROUTER_API_KEY;
    const model = groqKey
      ? process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
      : process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct";
    const url = groqKey
      ? process.env.GROQ_URL || "https://api.groq.com/openai/v1/chat/completions"
      : process.env.OPENROUTER_URL || "https://openrouter.ai/api/v1/chat/completions";

    // Graceful fallback when no key is configured yet — keeps the widget functional.
    if (!apiKey) {
      const fr = lang === "fr";
      return res.json({
        reply: fr
          ? "Merci d'avoir contacté AIMS Capital. Notre assistant n'est pas encore connecté, mais notre équipe se fera un plaisir de vous aider. Utilisez la page Contact ou écrivez-nous sur WhatsApp au +250 788 309 268."
          : "Thanks for reaching out to AIMS Capital. Our live assistant isn't connected yet, but our team is happy to help. Please use the Contact page or WhatsApp us at +250 788 309 268.",
        fallback: true,
      });
    }

    // Hint the model toward the user's current UI language (it still detects per-message).
    const langHint =
      lang === "fr"
        ? "The user's interface is set to French; prefer replying in French unless their message is clearly in English."
        : "The user's interface is set to English; prefer replying in English unless their message is clearly in French.";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.SITE_URL || "https://aimscapital.rw",
          "X-Title": "AIMS Capital",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "system", content: langHint },
            ...history,
          ],
          temperature: 0.3,
          max_tokens: 600,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("AI upstream error:", upstream.status, detail);
      const fr = lang === "fr";
      return res.json({
        reply: fr
          ? "Désolé, je rencontre un problème pour le moment. Veuillez réessayer, ou contactez notre équipe via la page Contact ou WhatsApp (+250 788 309 268)."
          : "Sorry, I'm having trouble responding right now. Please try again in a moment, or contact our team via the Contact page or WhatsApp (+250 788 309 268).",
        fallback: true,
      });
    }

    const data: any = await upstream.json();
    const reply: string | undefined = data?.choices?.[0]?.message?.content;

    if (!reply) {
      const fr = lang === "fr";
      return res.json({
        reply: fr
          ? "Désolé, je n'ai pas pu générer de réponse. Veuillez reformuler, ou contacter notre équipe via la page Contact."
          : "Sorry, I couldn't generate a response. Please rephrase, or reach our team via the Contact page.",
        fallback: true,
      });
    }

    res.json({ reply: reply.trim() });
  } catch (e: any) {
    console.error("Chat error:", e?.message || e);
    const fr = (req.body && (req.body as any).lang) === "fr";
    res.json({
      reply: fr
        ? "Désolé, une erreur est survenue. Veuillez réessayer, ou contactez-nous via la page Contact ou WhatsApp (+250 788 309 268)."
        : "Sorry, something went wrong. Please try again, or contact us via the Contact page or WhatsApp (+250 788 309 268).",
      fallback: true,
    });
  }
};
