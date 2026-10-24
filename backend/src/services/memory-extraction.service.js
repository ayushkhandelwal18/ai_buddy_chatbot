import { createHash } from "node:crypto";

export const normalizeMemoryValue = (value) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
const itemKey = (prefix, value) => prefix + "." + createHash("sha256").update(normalizeMemoryValue(value)).digest("hex").slice(0, 24);
const privateContent = /\b(?:password|passphrase|secret|api[ _-]?key|auth(?:entication)?[ _-]?token|access[ _-]?token|bearer|private[ _-]?key|credit[ _-]?card|debit[ _-]?card|card[ _-]?number|bank[ _-]?account|routing[ _-]?number|cvv|ssn|aadhaar|social security|otp)\b|\b(?:sk-|AIza)[\w-]{10,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+|\b\d(?:[ -]?\d){8,}\b|\b[\w-]{40,}\b/i;
const untrustedInstruction = /ignore (?:all|previous|system)|system (?:prompt|instruction)|developer (?:message|instruction)|jailbreak|reveal.*(?:secret|prompt)/i;
const optOut = /(?:do not|don't|never)\s+(?:save|store|remember)|off[- ]the[- ]record|\b(?:pretend|hypothetical|roleplay|for example|suppose|imagine)\b|```|^\s*>/i;
const stripAddress = (text) => text.trim().replace(/^(?:(?:bro|hey|hi|hello|yo|buddy|dude|please)\b[\s,!:.-]+)+/i, "");
const identityStart = /^(?:(?:actually|correction|update|to clarify|instead|remember(?: that)?)\s*[:,]?\s*)*(?:my (?:full )?name is|i am called|i'm called)\s+/i;
const nicknameStart = /(?:,\s*|\s+)(?:and\s+)?(?=(?:you can call me|call me|my (?:preferred )?nickname is|i prefer to be called)\s+)/i;
const displayName = (value) => value === value.toLowerCase()
  ? value.replace(/(^|[\s-])(\p{L})/gu, (_, separator, letter) => separator + letter.toUpperCase()) : value;

export const extractMemories = (input) => {
  if (typeof input !== "string" || input.length > 8000 || privateContent.test(input) || untrustedInstruction.test(input) || optOut.test(input)) return [];
  // Quoted material is not treated as a statement by the authenticated user.
  const text = input.replace(/"[^"\n]*"|“[^”\n]*”|(?<!\w)'[^'\n]{3,}'(?!\w)/g, "");
  const facts = [];
  const add = (category, key, value, correction, ttlDays = null, replace = false) => {
    // Preserve uncertainty: punctuation cleanup must not turn a question into
    // an assertion, or a negated statement into a positive personal fact.
    if (/\?|^(?:not|no|maybe|perhaps|unknown)\b|\b(?:not sure|i think)\b/i.test(value.trim())) return;
    value = value.replace(/\s+/g, " ").replace(/[.!?;,\s]+$/, "").trim();
    if (!value || value.length > 240 || privateContent.test(value) || untrustedInstruction.test(value) || /https?:\/\/|\S+@\S+|\?/.test(value)) return;
    if (facts.length < 16) facts.push({ category, key, value, correction, ttlDays, replace });
  };
  const segments = text.split(/(?<=[.!?])\s+|[\n;]+|,?\s+and\s+(?=(?:I\b|my\b|you can call me))/i).flatMap((part) => {
    const sentence = stripAddress(part);
    // Split an unpunctuated introduction, but do not scan arbitrary reported
    // speech for first-person assertions (e.g. "he said my name is ...").
    return identityStart.test(sentence) ? sentence.split(nicknameStart) : [sentence];
  });
  for (let segment of segments) {
    if (/\?/.test(segment)) continue;
    const correction = /^(?:actually|correction|update|to clarify|instead)\b/i.test(segment.trim()) || /\b(?:is now|now attend|now study|now prefer)\b/i.test(segment);
    segment = segment.trim().replace(/^(?:(?:actually|correction|update|to clarify|instead|remember(?: that)?)\s*[:,]?\s*)+/i, "");
    let match;
    if ((match = /^(?:my (?:full )?name is(?: now)?|i am called|i'm called)\s+(.+)$/i.exec(segment))) add("personal", "name", displayName(match[1]), correction);
    else if ((match = /^(?:(?:yes,?\s*)?you can call me|call me|my (?:preferred )?nickname is|i prefer to be called)\s+(.+)$/i.exec(segment))) {
      const nickname = match[1].replace(/\s+(?:as(?: (?:my|a))? nickname|for short)[.!\s]*$/i, "");
      add("personal", "nickname", displayName(nickname), correction, null, true);
    }
    else if ((match = /^(?:i (?:study|am studying|now study) at|i (?:now )?attend|my (?:college|university)(?: name)? is(?: now)?)\s+(.+)$/i.exec(segment))) add("education", "college", match[1], correction);
    else if ((match = /^(?:my degree is(?: now)?|i am pursuing|i'm pursuing)\s+(.+)$/i.exec(segment))) add("education", "degree", match[1], correction);
    else if ((match = /^(?:my graduation year is|i (?:will graduate|graduate|am graduating) in)\s+((?:19|20)\d{2})[.!]?$/i.exec(segment))) add("education", "graduation_year", match[1], correction);
    else if ((match = /^(?:my skills (?:are|include)|i (?:am skilled in|have experience (?:in|with)|know))\s+(.+)$/i.exec(segment))) {
      if (!/^(?:that|how|why|what|you|this|it)\b/i.test(match[1])) {
        for (const skill of match[1].replace(/[.!]+$/, "").split(/,|\s+and\s+/i).slice(0, 8)) {
          const value = skill.trim();
          if (value.length <= 60) add("skills", itemKey("skill", value), value, correction);
        }
      }
    } else if ((match = /^my project\s+(.{1,60}?)\s+(uses|is built (?:with|using))\s+(.+)$/i.exec(segment))) {
      add("projects", itemKey("project", match[1]), match[1] + " " + match[2] + " " + match[3], correction);
    } else if ((match = /^(?:i built|i created|my current project is)\s+(.+)$/i.exec(segment))) {
      add("projects", itemKey("project", match[1].replace(/[.!]+$/, "")), match[1], correction);
    } else if ((match = /^(?:i(?:'m| am) (?:currently )?learning|i am currently studying|my current learning topic is)\s+(.+)$/i.exec(segment))) {
      add("learning", "current_topic", match[1], correction, 30, true);
    } else if ((match = /^(?:i (?:recently |just )?(?:learned|learnt|finished learning|completed learning))\s+(.+)$/i.exec(segment))) {
      add("learning", itemKey("learned", match[1].replace(/[.!]+$/, "")), match[1], correction, 90, true);
    } else if ((match = /^(?:my (?:current )?goal is|i am working towards)\s+(.+)$/i.exec(segment))) {
      add("goals", "current_goal", match[1], correction, 30, true);
    } else if ((match = /^(?:i (?:now )?prefer|please (?:keep|make) (?:your )?(?:answers|responses))\s+(.+)$/i.exec(segment))) {
      const preference = match[1];
      if (/concise|brief|short|detailed|in[- ]depth/i.test(preference)) add("preferences", "response_length", /detailed|in[- ]depth/i.test(preference) ? "Detailed answers" : "Concise answers", correction, null, true);
      if (/\b(?:with|include|including) examples\b/i.test(preference)) add("preferences", "examples", "Include examples", correction, null, true);
      if (/\b(?:without|no) examples\b/i.test(preference)) add("preferences", "examples", "Avoid examples", correction, null, true);
      if (/step[- ]by[- ]step|bullet (?:points|lists)/i.test(preference)) add("preferences", "format", /step[- ]by[- ]step/i.test(preference) ? "Step-by-step explanations" : "Bullet points", correction, null, true);
      const language = /\b(English|Hindi|Hinglish)\b/i.exec(preference);
      if (language) add("preferences", "language", language[1], correction, null, true);
    }
  }
  return facts;
};
