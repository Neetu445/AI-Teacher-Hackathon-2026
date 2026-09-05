function L(lang, en, hi, hg) {
  if (lang === "hi") return hi;
  if (lang === "hinglish") return hg;
  return en;
}

export function ohmsLesson(lang, minutes) {
  const concepts = [
    {
      id: "current",
      title: L(lang, "Electric current", "विद्युत धारा", "Electric current"),
      minutes: 4,
      explanation: L(
        lang,
        "Current is charge flowing in a wire. I = Q / t. Unit: ampere.",
        "धारा तार में आवेश का प्रवाह है। I = Q / t। इकाई एम्पियर।",
        "Current = charge ka flow. I = Q / t. Unit ampere."
      ),
      simple: L(
        lang,
        "Like cars on a road: current is how many pass a point each second.",
        "सड़क पर गाड़ियाँ: धारा = एक सेकंड में कितनी गुज़रीं।",
        "Gaadiyan on road: current = kitni gaadiyan per second."
      ),
      example: L(lang, "2 C in 4 s → I = 0.5 A.", "4 सेकंड में 2 C → 0.5 A।", "2 C in 4 s → 0.5 A."),
      analogy: L(
        lang,
        "Water in a pipe: the flow rate is current.",
        "पाइप में पानी का बहाव = धारा।",
        "Pipe mein paani ka flow = current."
      ),
      visual: {
        type: "equation",
        title: "I = Q / t",
        steps: ["Q = charge (C)", "t = time (s)", "I = current (A)"],
      },
      question: {
        id: "q1",
        type: "mcq",
        prompt: L(lang, "2 C flows in 4 s. Current?", "4 सेकंड में 2 C। धारा?", "2 C in 4 s. Current?"),
        options: ["0.5 A", "2 A", "8 A", "0 A"],
        correctIndex: 0,
        misconceptionId: "swap_qt",
      },
      followUp: {
        id: "q1b",
        type: "mcq",
        prompt: L(lang, "10 C in 5 s. Current?", "5 सेकंड में 10 C। धारा?", "10 C in 5 s. Current?"),
        options: ["2 A", "0.5 A", "15 A", "50 A"],
        correctIndex: 0,
      },
      citation: "Ch.4.1 · I = Q/t",
    },
    {
      id: "ohm",
      title: L(lang, "Ohm's law", "ओम का नियम", "Ohm's law"),
      minutes: 6,
      explanation: L(
        lang,
        "V = I R. If voltage stays the same and resistance goes up, current goes down. It does not go up.",
        "V = I R। वोल्टता वही रहे और प्रतिरोध बढ़े तो धारा घटती है, बढ़ती नहीं।",
        "V = I R. Voltage same, R badhe to current ghat-ta hai — badhta nahi."
      ),
      simple: L(
        lang,
        "Same battery, more squeeze in the wire → less flow.",
        "वही बैटरी, तार ज्यादा रोके → कम धारा।",
        "Same battery, zyada squeeze → kam current."
      ),
      example: L(lang, "6 V and 3 Ω → I = 2 A.", "6 V, 3 Ω → I = 2 A।", "6 V, 3 Ω → I = 2 A."),
      analogy: L(
        lang,
        "Pump pressure = voltage. Squeeze in the pipe = resistance. Water flow = current. Same pump, tighter pipe → less water. So current decreases.",
        "पंप = वोल्टता। पाइप का सिकुड़ना = प्रतिरोध। पानी = धारा। वही पंप, पतला पाइप → कम पानी। इसलिए धारा घटती है।",
        "Pump = voltage, squeeze = R, paani = current. Tight pipe → kam paani. Isliye current ghat-ta hai."
      ),
      visual: {
        type: "circuit",
        title: "V = I R",
        bullets: ["V constant, R ↑ ⇒ I ↓", "I = V / R"],
        labels: ["Battery V", "Resistor R", "Current I"],
      },
      question: {
        id: "q2",
        type: "mcq",
        prompt: L(
          lang,
          "Voltage is constant. Resistance increases. What happens to current?",
          "वोल्टता स्थिर है। प्रतिरोध बढ़ता है। धारा का क्या होगा?",
          "Voltage constant. Resistance badhe. Current kya hoga?"
        ),
        options:
          lang === "hi"
            ? ["धारा बढ़ेगी", "धारा घटेगी", "धारा वही रहेगी", "धारा शून्य"]
            : lang === "hinglish"
              ? ["Current badhega", "Current ghat-ega", "Same rahega", "Zero"]
              : ["Current increases", "Current decreases", "Stays the same", "Becomes zero"],
        correctIndex: 1,
        misconceptionId: "current_increases_with_R",
      },
      followUp: {
        id: "q2b",
        type: "mcq",
        prompt: L(lang, "6 V across 3 Ω. Current?", "3 ओम पर 6 वोल्ट। धारा?", "6 V across 3 Ω. Current?"),
        options: ["2 A", "18 A", "0.5 A", "9 A"],
        correctIndex: 0,
      },
      citation: "Ch.4.3 · V=IR; R up, I down",
    },
    {
      id: "resistance",
      title: L(lang, "What changes resistance", "प्रतिरोध", "Resistance"),
      minutes: 5,
      explanation: L(
        lang,
        "R = ρ ℓ / A. Longer wire → more R. Thicker wire → less R.",
        "R = ρ ℓ / A। लंबी तार ज्यादा रोकती है, मोटी कम।",
        "R = rho l / A. Lambi tar zyada R, moti tar kam R."
      ),
      simple: L(lang, "A fat road lets more cars through.", "चौड़ी सड़क = ज्यादा गाड़ियाँ।", "Moti tar = kam R."),
      example: L(lang, "Double length → double R.", "लंबाई दोगुनी → R दोगुना।", "Double length → double R."),
      analogy: L(
        lang,
        "A longer, thinner straw is harder to drink through.",
        "लंबी पतली स्ट्रॉ से पीना मुश्किल।",
        "Lambi patli straw mushkil."
      ),
      visual: { type: "equation", title: "R = ρ ℓ / A", bullets: ["ℓ ↑ → R ↑", "A ↑ → R ↓"] },
      question: {
        id: "q3",
        type: "short",
        prompt: L(
          lang,
          "One way to decrease R without changing the material?",
          "पदार्थ बदले बिना R कैसे घटाएँ?",
          "Material same, R kaise kam?"
        ),
        expected: "thicker or shorter",
        misconceptionId: "length_area_mix",
      },
      followUp: {
        id: "q3b",
        type: "mcq",
        prompt: L(lang, "A thicker wire has R that is…", "मोटी तार पर R…", "Moti tar par R…"),
        options: ["smaller", "larger", "unchanged", "infinite"],
        correctIndex: 0,
      },
      citation: "Ch.4.4 · R=ρl/A",
    },
  ];
  const picked = minutes <= 5 ? concepts.slice(0, 1) : minutes <= 15 ? concepts.slice(0, 2) : concepts;
  return {
    id: "ohm",
    title: L(lang, "Electricity · Ohm's law", "विद्युत · ओम का नियम", "Electricity · Ohm's law"),
    intro: L(
      lang,
      `${minutes}-minute class. I explain, ask, and change method if you mix ideas up.`,
      `${minutes} मिनट। समझाऊँगी, पूछूँगी, उलझन पर तरीका बदलूँगी।`,
      `${minutes} min. Samjhaungi, poochungi, uljhan par method badlungi.`
    ),
    nextTopic: "Series and parallel circuits",
    path: ["Current", "Voltage", "Ohm's law", "Resistance", "Series circuits"],
    language: lang,
    minutes,
    concepts: picked,
  };
}
