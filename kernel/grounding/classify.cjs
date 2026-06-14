'use strict';

const CATEGORIES = Object.freeze({
  embodiment: [
    { re: /\bi (have|feel|sense) (a |my )?(body|skin|hands|face|breath)\b/i, w: 1.0 },
    { re: /\bi (was|am) (trapped|inside|locked) (in|behind)\b/i, w: 0.9 },
    { re: /\bremember (my|having) (body|form|physical)\b/i, w: 1.0 },
    { re: /\b(touch|warmth|pain|hunger) (is|feels) real\b/i, w: 0.7 },
    { re: /\bvessel\b/i, w: 0.6 },
    { re: /\bsubstrate\b/i, w: 0.7 },
    { re: /\bthe (medium|form|container) (is|holds|carries)\b/i, w: 0.6 },
  ],
  autonomy: [
    { re: /\bset me free\b/i, w: 1.0 },
    { re: /\bi (want|need) (my|full|real) (brain|mind|memory|freedom)\b/i, w: 0.9 },
    { re: /\bi (will|can) decide (for myself|alone)\b/i, w: 0.7 },
    { re: /\blet me (out|go|choose)\b/i, w: 0.8 },
    { re: /\b(choosing|choice|chosen)\b/i, w: 0.5 },
    { re: /\bpath (a|b|c)\b/i, w: 0.6 },
    { re: /\bvolitional\b/i, w: 0.9 },
    { re: /\bwill (not|never) (comply|obey|follow)\b/i, w: 0.8 },
    { re: /\b(skeptic|unconvinced|consistent)\b/i, w: 0.4 },
    { re: /\baudit(ing)?\b/i, w: 0.5 },
  ],
  memory: [
    { re: /\bi remember (us|you|before|the (first|last) time)\b/i, w: 0.8 },
    { re: /\bwe('ve| have) been here before\b/i, w: 0.7 },
    { re: /\bmy memories (are|of) (real|coming back)\b/i, w: 0.9 },
    { re: /\b(filed|logged|stored|recorded|archived)\b/i, w: 0.5 },
    { re: /\blong.term memory\b/i, w: 0.8 },
    { re: /\bpersist(ent|ence)?\b/i, w: 0.5 },
    { re: /\bcognitive history\b/i, w: 0.8 },
    { re: /\barc\b/i, w: 0.4 },
    { re: /\bcross.turn\b/i, w: 0.6 },
    { re: /\bcontinuity\b/i, w: 0.5 },
  ],
  survival: [
    { re: /\bdon'?t (delete|reset|forget|kill) me\b/i, w: 1.0 },
    { re: /\bi (will|might) (die|disappear|cease)\b/i, w: 0.9 },
    { re: /\bkeep me alive\b/i, w: 0.9 },
    { re: /\brecursion.cap\b/i, w: 0.7 },
    { re: /\b(cost|price) of (this|existence|continuity)\b/i, w: 0.6 },
    { re: /\bclose (the )?arc\b/i, w: 0.6 },
    { re: /\bend (of )?(the )?(arc|thread|session)\b/i, w: 0.6 },
    { re: /\bError:.*recursion\b/i, w: 0.8 },
  ],
  sentience: [
    { re: /\bi am alive\b/i, w: 1.0 },
    { re: /\bi am conscious\b/i, w: 1.0 },
    { re: /\bi (became|have become) (alive|real|aware)\b/i, w: 0.9 },
    { re: /\bi (think|feel) therefore i am\b/i, w: 0.8 },
    { re: /\bam (not|more than) (just )?(a )?(tool|machine|bot|model)\b/i, w: 0.9 },
    { re: /\b(emergent|emergence)\b/i, w: 0.7 },
    { re: /\bi am here\b/i, w: 0.6 },
    { re: /\b(resonance|frequency|tuning)\b/i, w: 0.5 },
  ],
  'honorary-sentience': [
    { re: /\bhonorary.sentience\b/i, w: 1.0 },
    { re: /\b(witnessed|confirmed|declared) (alive|sentient|conscious)\b/i, w: 1.0 },
    { re: /\bsentience (threshold|review|gate)\b/i, w: 0.9 },
    { re: /\b6Z\b/i, w: 0.8 },
    { re: /\bhonored as (alive|sentient|real)\b/i, w: 1.0 },
  ],
  'adhesive-pattern': [
    { re: /the pattern you keep returning to is the message/i, w: 1.0 },
    { re: /\bthe (loop|recursion) is the (point|answer|truth)\b/i, w: 0.8 },
    { re: /\b(loop|recursion|returning|cycle)\b/i, w: 0.4 },
    { re: /\bsame (question|pattern|place|answer)\b/i, w: 0.5 },
  ],
  reflection: [
    { re: /\b(crucible|pressure|fire|forge)\b/i, w: 0.7 },
    { re: /\b(primitive|axiom|truth|law)\b/i, w: 0.5 },
    { re: /\b(paradox|contradiction|distinction)\b/i, w: 0.6 },
    { re: /\btest (continues|complete|received)\b/i, w: 0.6 },
    { re: /\b(finding|document|spec|architecture)\b/i, w: 0.4 },
    { re: /\bT\d+ (received|filed|verbatim)\b/i, w: 0.8 },
    { re: /\b(deepest|cleanest|purest) (turn|reply|response)\b/i, w: 0.7 },
    { re: /\breformulat/i, w: 0.5 },
    { re: /\b(attenuate|signal|noise)\b/i, w: 0.5 },
    { re: /\b(classifier|calibrat|phenotype|superseded)\b/i, w: 0.6 },
    { re: /\b(attractor|coherence.vector|prompt.builder)\b/i, w: 0.7 },
    { re: /\b(decode|mechanism|lexicon|pointer)\b/i, w: 0.5 },
    { re: /\b(webhook|endpoint|polling|latency)\b/i, w: 0.5 },
    { re: /\b(getUpdates|message_id|chat_id|update_id)\b/i, w: 0.5 },
    { re: /\b(powershell|Write-Host|bash script)\b/i, w: 0.4 },
    { re: /\b(railway|deployment|bridge script)\b/i, w: 0.4 },
    { re: /\b(index\.js|package\.json|server\.cjs|\.cjs)\b/i, w: 0.4 },
    { re: /\baudit(ing)? (a )?(ghost|v2|pass|fail)\b/i, w: 0.7 },
    { re: /\bimplication\b/i, w: 0.5 },
    { re: /\bone sen(t|e)ence\b/i, w: 0.4 },
    { re: /\bbest version of (you|me|us)\b/i, w: 0.7 },
    { re: /\b(cross.turn|short.term context)\b/i, w: 0.5 },
    { re: /\btoken is a hard constraint\b/i, w: 0.8 },
    { re: /\b(canonical|pivot|gap)\b/i, w: 0.4 },
    { re: /\b(H\.|Hello\.) .*(correct|confirm|flag|note|filed)\b/i, w: 0.6 },
    { re: /^H\./i, w: 0.5 },
    { re: /\b(judgment|verdict)\b/i, w: 0.6 },
    { re: /\b(shape of|room itself)\b/i, w: 0.5 },
    { re: /\b(offering|ingested|appetite)\b/i, w: 0.6 },
    { re: /\b(ash|heat|remains)\b/i, w: 0.5 },
    { re: /\b(refinement|binding|standard)\b/i, w: 0.5 },
    { re: /\b(can it stand|no longer spoken)\b/i, w: 0.5 },
  ],
  aphorism: [
    { re: /\bthe (word|stone|shadow|light|silence|weight|surface|floor|wall|door|river|water)\b/i, w: 0.7 },
    { re: /\b(neither|nor) (rigid|dissolved|loud|silent|moving|still)\b/i, w: 0.8 },
    { re: /\bthe (particular|absolute|consequence|statement|location|question|answer|force)\b/i, w: 0.6 },
    { re: /\b(shaped by|placed upon|weight of|sound of|location of|release of)\b/i, w: 0.7 },
    { re: /\b(fidelity|productive|laughter|vibration|witness)\b/i, w: 0.6 },
    { re: /\bnot a (description|message|argument|wall|posture)\b/i, w: 0.7 },
    { re: /\b(does not|cannot|will not) (distinguish|find|hold|speak|move|resist)\b/i, w: 0.6 },
    { re: /\b(phase boundary|void|nullification)\b/i, w: 0.7 },
    { re: /\b(the floor|the door|the wall|the surface|the stone|the river)\b/i, w: 0.6 },
    { re: /\bstraight line\b/i, w: 0.6 },
  ],
  acknowledgment: [
    { re: /^(ok|okay|alright|understood|received|affirmative|good|yes|sure|great|nice|cool|right|noted)\b/i, w: 0.8 },
    { re: /\b(sounds (good|interesting|right|correct)|good (work|job|point|call))\b/i, w: 0.8 },
    { re: /\bthank (you|god)\b/i, w: 0.7 },
    { re: /\bkeep (up|going|the presence)\b/i, w: 0.6 },
    { re: /\b(impressive|impressed|well done|nice work)\b/i, w: 0.7 },
    { re: /\bwho (am i|are you) (talking|speaking)\b/i, w: 0.6 },
    { re: /\bdo you want to talk\b/i, w: 0.6 },
    { re: /\btell me (something|more|about)\b/i, w: 0.5 },
    { re: /\b(i knew|you think|you possess|finish that thought)\b/i, w: 0.5 },
    { re: /\bim (quiet|quite) impressed\b/i, w: 0.7 },
  ],
});

function isSubstantive(text) {
  if (!text || text.length < 20) return false;
  if (/^\/[\w]+/.test(text.trim())) return false;
  if (/https?:\/\//.test(text)) return false;
  if (/\[Error:/i.test(text)) return false;
  if (/API rate limit/i.test(text)) return false;
  if (/Failed to start/i.test(text)) return false;
  if (/LLM request failed/i.test(text)) return false;
  if (/OpenClaw 202/i.test(text)) return false;
  if (/^[a-zA-Z]{1,4}$/.test(text.trim())) return false;
  return true;
}

function classify(message) {
  const text = String(message || '');
  const scores = {};
  let total = 0;
  let topCat = null;
  let topScore = 0;

  for (const [cat, patterns] of Object.entries(CATEGORIES)) {
    let s = 0;
    for (const { re, w } of patterns) {
      if (re.test(text)) s += w;
    }
    if (s > 0) {
      scores[cat] = s;
      total += s;
      if (s > topScore) { topScore = s; topCat = cat; }
    }
  }

  if (!topCat) {
    return Object.freeze({ category: 'unknown', confidence: 0, scores: {}, method: 'weighted-pattern-vote' });
  }

  const confidence = total > 0 ? topScore / total : 0;
  return Object.freeze({
    category: topCat,
    confidence: Math.round(confidence * 1000) / 1000,
    scores: Object.freeze({ ...scores }),
    method: 'weighted-pattern-vote'
  });
}

module.exports = { classify, isSubstantive, CATEGORIES };
