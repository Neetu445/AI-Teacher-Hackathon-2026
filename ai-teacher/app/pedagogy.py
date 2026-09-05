"""Pedagogy content layer.

1. Teacher talk templates (greetings, praise, misconception handling, quiz
   framing, conclusions) in English, Hindi and Hinglish, with two personas.
2. Built-in curriculum packs so the product demonstrates full human-like
   teaching even with no LLM key configured. The flagship pack reproduces the
   problem statement's own example: the 'current increases when resistance
   increases' misconception and its remediation.

When an LLM is configured the planner generates this same structure
dynamically for any topic/material, in any language.
"""

LANG_INFO = {
    "en": {"name": "English", "speech": "en-IN", "offline": True},
    "hi": {"name": "हिन्दी (Hindi)", "speech": "hi-IN", "offline": True},
    "hinglish": {"name": "Hinglish", "speech": "hi-IN", "offline": True},
    "mr": {"name": "मराठी (Marathi)", "speech": "mr-IN", "offline": False},
    "ta": {"name": "தமிழ் (Tamil)", "speech": "ta-IN", "offline": False},
    "te": {"name": "తెలుగు (Telugu)", "speech": "te-IN", "offline": False},
    "bn": {"name": "বাংলা (Bengali)", "speech": "bn-IN", "offline": False},
    "gu": {"name": "ગુજરાતી (Gujarati)", "speech": "gu-IN", "offline": False},
    "kn": {"name": "ಕನ್ನಡ (Kannada)", "speech": "kn-IN", "offline": False},
    "pa": {"name": "ਪੰਜਾਬੀ (Punjabi)", "speech": "pa-IN", "offline": False},
    "es": {"name": "Español", "speech": "es-ES", "offline": False},
    "fr": {"name": "Français", "speech": "fr-FR", "offline": False},
    "de": {"name": "Deutsch", "speech": "de-DE", "offline": False},
}

# ---------------------------------------------------------------- templates

T = {
    "en": {
        "what_topic": "the topic \"{title}\"",
        "what_doc": "your material on \"{title}\"",
        "greet": "Hello{name}! I am your AI teacher. I've gone through {what}, and I'm ready to teach you today.",
        "greet_persona_prof": "Good day{name}. I shall be your instructor today. I have studied {what} and prepared a lesson for you.",
        "agenda": "Here's my plan: we'll cover {n} key ideas in about {minutes} minutes. I'll explain each one with examples, I'll ask you questions as we go, and there will be a short test at the end. If anything is unclear, you can ask me a doubt at any time. Ready? Let's begin.",
        "study_plan_intro": "You have {days} days — excellent. Instead of one rushed lesson, I've designed a complete study plan for you. Let me walk you through it, day by day.",
        "next_segment": "Great, let's move on to our next idea: {concept}.",
        "praise": ["Exactly right!", "Very good — that's correct!", "Perfect answer!", "Yes! You've got it.", "Brilliant, well done!"],
        "partial": "You're on the right track — part of that is correct. Let me complete the picture.",
        "wrong": "Not quite — and that's okay, this is where the real learning happens. Let's slow down.",
        "first_time_mis": "Ah — this is the most common mistake students make here, so let's fix it properly.",
        "retry_after_reteach": "Now let's check again with a fresh question.",
        "move_on": "No worries at all. The correct idea is: {answer}. We'll revise this at the end — for now, let's keep moving forward.",
        "quiz_intro": "Time for our quick test! Don't be nervous — this is just to see what stayed with you. {n} questions. Do your best!",
        "extension": "Since that was easy for you, here's a bonus thought: {fact}",
        "doubt_back": "Good question! Let's pause on that. {answer} Does that clear it up? Now, back to where we were.",
        "doubt_unknown": "That's a thoughtful question. It goes a bit beyond today's material, so note it down and we'll pick it up in a later session. Let's continue for now.",
        "conclusion": "And that completes today's lesson! You did the work — let me put together your learning report.",
        "report_line": "Here's your report. You scored {score}%. Strong areas: {strong}. Areas to revise: {weak}.",
        "next_topics_line": "Recommended next: {topics}.",
        "grounded_note": "This answer comes straight from your uploaded material: {heading}",
    },
    "hi": {
        "what_topic": "\"{title}\" विषय",
        "what_doc": "\"{title}\" पर आपकी सामग्री",
        "greet": "नमस्ते{name}! मैं आपकी AI टीचर हूँ। मैंने {what} अच्छी तरह पढ़ लिया है, और आज मैं आपको पढ़ाने के लिए तैयार हूँ।",
        "greet_persona_prof": "नमस्कार{name}। मैं आज आपकी अध्यापिका हूँ। मैंने {what} का अध्ययन करके आपके लिए पाठ तैयार किया है।",
        "agenda": "यह रही हमारी योजना: हम लगभग {minutes} मिनट में {n} मुख्य बातें समझेंगे। मैं हर बात को उदाहरण के साथ समझाऊँगी, बीच-बीच में सवाल पूछूँगी, और अंत में एक छोटी-सी परीक्षा भी लूँगी। कोई भी शंका हो, तो बीच में ही पूछ लेना। तैयार? चलिए शुरू करते हैं।",
        "study_plan_intro": "आपके पास {days} दिन हैं — बहुत बढ़िया! एक जल्दबाज़ पाठ के बजाय, मैंने आपके लिए पूरा अध्ययन-क्रम बनाया है। दिन-प्रतिदिन समझाती हूँ।",
        "next_segment": "बहुत अच्छा, अब चलिए अगली बात की ओर बढ़ते हैं: {concept}।",
        "praise": ["बिल्कुल सही!", "बहुत बढ़िया — सही जवाब!", "परफ़ेक्ट!", "हाँ! आपने समझ लिया।", "शाबाश!"],
        "partial": "आप सही राह पर हैं — इसका एक हिस्सा सही है। आइए पूरी तस्वीर समझते हैं।",
        "wrong": "बिल्कुल सही नहीं — कोई बात नहीं, असली सीख यहीं से शुरू होती है। धीरे-धीरे समझते हैं।",
        "first_time_mis": "अच्छा — यहाँ स्टूडेंट्स सबसे ज़्यादा ग़लती करते हैं, तो चलिए इसे ठीक से सुधारते हैं।",
        "retry_after_reteach": "अब एक नए सवाल के साथ दोबारा जाँच करते हैं।",
        "move_on": "कोई चिंता नहीं। सही उत्तर यह है: {answer}। हम इसे अंत में दोहराएँगे — अभी आगे बढ़ते हैं।",
        "quiz_intro": "अब हमारी छोटी-सी परीक्षा का समय! घबराइए मत — यह बस यह देखने के लिए है कि कितना समझ आया। {n} सवाल। शुभकामनाएँ!",
        "extension": "आपके लिए यह आसान था, तो एक बोनस बात: {fact}",
        "doubt_back": "अच्छा सवाल! रुक कर इसे समझते हैं। {answer} क्या अब साफ़ हुआ? चलिए, वापस अपने पाठ पर आते हैं।",
        "doubt_unknown": "बहुत सोचने वाला सवाल है। यह आज के पाठ से थोड़ा आगे की बात है, तो इसे नोट कर लीजिए — अगले सत्र में लेंगे। अभी आगे बढ़ते हैं।",
        "conclusion": "और इसी के साथ आज का पाठ पूरा हुआ! मेहनत आपने की — अब मैं आपकी लर्निंग रिपोर्ट बनाती हूँ।",
        "report_line": "यह रही आपकी रिपोर्ट। स्कोर {score}%। मज़बूत भाग: {strong}। दोहराने के लिए: {weak}।",
        "next_topics_line": "आगे क्या पढ़ें: {topics}।",
        "grounded_note": "यह उत्तर आपकी अपलोड की गई सामग्री से सीधे लिया गया है: {heading}",
    },
    "hinglish": {
        "what_topic": "\"{title}\" topic",
        "what_doc": "\"{title}\" par aapka material",
        "greet": "Namaste{name}! Main aapki AI teacher hoon. Maine {what} achhe se padh liya hai, aur main aaj aapko padhane ke liye bilkul ready hoon.",
        "greet_persona_prof": "Namaskar{name}. Main aaj aapki instructor hoon. Maine {what} ko study karke aapke liye lesson tayyar kiya hai.",
        "agenda": "Ye raha hamara plan: hum lagbhag {minutes} minute mein {n} main concepts cover karenge. Main har concept ko examples ke saath samjhaungi, beech-beech mein questions puchhungi, aur end mein ek chhota test bhi hoga. Koi doubt ho toh beech mein hi poochh lena. Ready? Chalo shuru karte hain.",
        "study_plan_intro": "Aapke paas {days} din hain — perfect! Ek jaldi wale lesson ki jagah, maine aapke liye poora study plan banaya hai. Day by day samjhati hoon.",
        "next_segment": "Bahut badhiya, ab chaliye agle concept par chalte hain: {concept}.",
        "praise": ["Bilkul sahi!", "Bahut badhiya — correct!", "Perfect answer!", "Haan! Samajh gaye aap.", "Shabaash!"],
        "partial": "Aap sahi direction mein soch rahe ho — ek hissa sahi hai. Chalo poori picture complete karte hain.",
        "wrong": "Ye bilkul sahi nahi hai — koi baat nahi, asli learning yahin se hoti hai. Dheere se samajhte hain.",
        "first_time_mis": "Achha — yahin par students sabse zyada galti karte hain, toh ise theek se clear karte hain.",
        "retry_after_reteach": "Ab ek naye question ke saath dobara check karte hain.",
        "move_on": "Koi tension nahi. Sahi answer ye hai: {answer}. Hum ise end mein revise karenge — abhi aage badhte hain.",
        "quiz_intro": "Ab hamari chhoti si test ka time! Nervous mat ho — ye sirf ye dekhne ke liye hai ki kitna samajh aaya. {n} questions. Best of luck!",
        "extension": "Aapke liye ye easy tha, toh ek bonus fact: {fact}",
        "doubt_back": "Accha sawaal! Ruk kar ise samajhte hain. {answer} Ab clear hua? Chalo wapas apne lesson par aate hain.",
        "doubt_unknown": "Sochne wala sawaal hai. Ye aaj ke lesson se thoda aage ki baat hai, note kar lo — next session mein lenge. Abhi aage badhte hain.",
        "conclusion": "Aur isi ke saath aaj ka lesson complete! Ab main aapki learning report banati hoon.",
        "report_line": "Ye rahi aapki report. Score {score}%. Strong areas: {strong}. Revision ke liye: {weak}.",
        "next_topics_line": "Aage kya padhein: {topics}.",
        "grounded_note": "Ye answer aapki uploaded material se seedha liya gaya hai: {heading}",
    },
}

PERSONA_NAME = {"priya": "Priya", "prof": "Prof. Sharma"}


def tmpl(lang, key):
    lang = lang if lang in T else (lang if lang in T else "en")
    table = T.get(lang) or T["en"]
    return table.get(key, T["en"][key])


# ---------------------------------------------------------------- helpers

def _q_open(question, answer, keywords, concept, misconceptions=None, lang_pairs=None):
    q = {"kind": "open", "question": question, "answer": answer,
         "keywords": keywords, "concept": concept, "misconceptions": misconceptions or []}
    if lang_pairs:
        q["langs"] = lang_pairs
    return q


# ---------------------------------------------------------------- OHM PACK

_OHM_EN = [
    {
        "concept": "Voltage — the electrical push",
        "script": [
            "Let's start with the most basic idea: voltage. Voltage is the push that makes electric charges move. Think of it like water pressure in a pipe — the greater the pressure, the harder the water pushes through.",
            "Voltage is measured in volts, named after Alessandro Volta. A battery is a source of voltage: your phone battery gives about 3.7 volts, while a wall socket in India supplies 230 volts.",
            "One important detail: voltage always exists between two points. It is a difference in electrical pressure — just like water flows only when there is a height difference.",
        ],
        "visual": {"kind": "circuit", "title": "A simple circuit", "battery": "12 V battery", "resistor": "Resistor R", "note": "Voltage = the electrical push"},
        "check": _q_open(
            "In your own words — what is voltage?", "the electrical push (pressure difference) that drives charge",
            ["push", "pressure", "drive", "difference", "volt", "energy"], "Voltage",
            misconceptions=[{
                "patterns": ["flow of", "flow of electron", "moving electron", "electrons move", "flowing"],
                "label": "confused voltage with current",
                "feedback": "Careful — you described current, which is the flow itself. Voltage is not the flow; it's the push that causes the flow.",
                "analogy": "Think of a water tank on a rooftop. The height of the tank creates pressure — that pressure is like voltage. The water actually moving inside the pipe is the current. So which one is the 'push'? The pressure — the voltage.",
                "followup": _q_open("So, in one line: voltage is the ___ that pushes the charges. What word fits?", "push / pressure", ["push", "pressure", "दबाव", "धक्का"], "Voltage"),
            }]),
    },
    {
        "concept": "Current — the flow of charge",
        "script": [
            "Now, when there is a push, what actually moves? Electric current is the flow of electric charge through a conductor — usually electrons drifting through a wire.",
            "Current is measured in amperes, or 'amps'. One ampere means about 6.24 × 10^18 electrons passing a point every second. We measure it with an ammeter, connected in series.",
            "Keep this picture in mind: if voltage is the pressure, then current is the amount of water flowing per second. Push versus flow — two different things.",
        ],
        "visual": {"kind": "flow", "title": "Current = flow of charge", "steps": ["Battery provides the push (V)", "Electrons drift through the wire", "Current flows — I = Q / t", "Measured in amperes (A)"]},
        "check": _q_open(
            "Explain in your own words: what is electric current?", "the flow of electric charge (electrons) through a conductor",
            ["flow", "charge", "electron"], "Current",
            misconceptions=[{
                "patterns": ["pressure", "push", "volt"],
                "label": "confused current with voltage",
                "feedback": "Hold on — that's voltage you described, the push. Current is what actually moves because of that push.",
                "analogy": "On a highway, the pressure that makes traffic move is like voltage; the cars actually passing by you every second — that is the current. Current is the flow of the charges themselves.",
                "followup": _q_open("Then tell me again in one line — what is current?", "flow of charge (electrons)", ["flow", "charge", "electron", "बहाव"], "Current"),
            }]),
    },
    {
        "concept": "Resistance — the opposition to flow",
        "script": [
            "Every conductor opposes the flow of charge at least a little. This opposition is called resistance, measured in ohms — the symbol is Ω.",
            "Think of the width of a water pipe. A narrow pipe opposes the flow, so less water passes even at the same pressure. A thin wire does the same thing to electrons.",
            "Resistance depends on the material, the length, and the thickness: longer and thinner wires have higher resistance. That is exactly why a heater coil glows hot — it is made of high-resistance nichrome wire.",
        ],
        "visual": {"kind": "bullets", "title": "Resistance — opposition to flow", "items": ["Measured in ohms (Ω)", "Longer wire → higher resistance", "Thinner wire → higher resistance", "Material matters: nichrome ≫ copper"], "note": "Like pinching a water pipe"},
        "check": _q_open(
            "Now a thinking question. If the voltage stays the same and we increase the resistance of a circuit, what happens to the current?",
            "the current decreases — I = V/R is an inverse relation",
            ["decrease", "less", "reduce", "drop", "fall", "kam", "घट", "कम"],
            "Resistance",
            misconceptions=[{
                "patterns": ["increase", "goes up", "more current", "badh", "बढ़", "ज्यादा", "zyada", "rises", "higher current"],
                "label": "believes more resistance produces more current",
                "feedback": "That's the single most common misconception in electricity, so let's fix it carefully. Resistance opposes the flow. If the opposition increases while the push stays the same, less current can get through — the current decreases. It cannot increase.",
                "analogy": "Picture water pushed through a pipe by a pump. Now pinch the pipe to make it narrower — you increased the resistance. Does more water come out, or less? Less! The pump's pressure (voltage) didn't change, but the narrowed pipe (resistance) reduced the flow (current). A thinner wire chokes the electron flow in exactly the same way.",
                "followup": _q_open(
                    "Let's apply it: a circuit has a fixed battery. We replace a thick wire with a much thinner one. Does the current increase or decrease — and why?",
                    "decreases, because the thinner wire has more resistance",
                    ["decrease", "less", "reduce", "कम", "घट"], "Resistance"),
            }]),
    },
    {
        "concept": "Ohm's Law — V = I × R",
        "script": [
            "Now we combine all three ideas into one famous rule: Ohm's Law. It states that voltage equals current multiplied by resistance: V = I × R.",
            "Rearranged, current equals voltage divided by resistance: I = V / R. And notice — this formula says exactly what you told me a moment ago: with the same voltage, more resistance means less current.",
            "Let's solve one together. A 12-volt battery is connected across a 4-ohm resistor. I = V / R = 12 / 4 = 3 amperes. Three amps flow through the circuit.",
        ],
        "visual": {"kind": "triangle", "title": "The Ohm's Law triangle", "top": "V", "left": "I", "right": "R", "note": "Cover the one you want: I = V ÷ R", "steps": ["V = I × R", "I = V ÷ R", "R = V ÷ I"]},
        "check": {
            "kind": "mcq", "concept": "Ohm's Law",
            "question": "Your turn to compute: if V = 12 volts and R = 4 ohms, what is the current I?",
            "options": ["48 A", "3 A", "0.33 A", "8 A"], "answer": 1,
            "misconceptions": [{
                "option": 0,
                "label": "multiplied instead of dividing",
                "feedback": "48 would be 12 × 4 — but we divide, not multiply. Current equals voltage over resistance: I = V / R = 12 / 4.",
                "analogy": "Look at the triangle on the board. Cover I with your finger: what remains is V sitting on top of R — V over R. Twelve divided by four gives 3 amperes.",
                "followup": {"kind": "mcq", "concept": "Ohm's Law", "question": "Try once more: V = 6 V, R = 2 Ω. What is I?", "options": ["3 A", "12 A", "4 A", "0.5 A"], "answer": 0, "misconceptions": []},
            }],
        },
    },
    {
        "concept": "Reading Ohm's Law as a graph",
        "script": [
            "Finally, let's see Ohm's Law as a picture. If we plot current against voltage for a fixed resistor, we get a straight line passing through the origin.",
            "The slope of this line is 1 over R. A steep line means low resistance — lots of current for a small voltage. Materials that follow this straight-line behaviour are called ohmic conductors.",
            "This one law quietly runs the modern world: choosing the right resistor for an LED, designing your phone charger, and explaining why short circuits are dangerous — nearly zero resistance means an enormous current.",
        ],
        "visual": {"kind": "graph", "title": "I–V graph for a fixed resistor", "xlabel": "Voltage V →", "ylabel": "Current I →", "note": "Straight line through origin ⇒ ohmic device", "slope": "slope = 1 / R"},
        "check": _q_open(
            "Last one for this idea: why is a short circuit dangerous? Hint — what happens to the current when resistance becomes almost zero?",
            "resistance ≈ 0 makes current enormous (I = V/R), causing overheating or fire",
            ["current", "large", "huge", "high", "overheat", "heat", "fire", "infinite", "very"], "Ohm's Law"),
    },
]

_OHM_HI = [
    {
        "concept": "वोल्टेज — विद्युत धक्का",
        "script": [
            "चलिए सबसे बुनियादी बात से शुरू करते हैं — वोल्टेज। वोल्टेज वह धक्का है जो इलेक्ट्रिक चार्ज को आगे बढ़ाता है। इसे पाइप में पानी के दबाव जैसा समझिए — दबाव जितना ज़्यादा, पानी उतनी ज़ोर से बहता है।",
            "वोल्टेज को वोल्ट में मापते हैं। बैटरी वोल्टेज का स्रोत है — आपके फ़ोन की बैटरी लगभग 3.7 वोल्ट देती है, जबकि भारत में घर का सॉकेट 230 वोल्ट देता है।",
            "एक ज़रूरी बात: वोल्टेज हमेशा दो बिंदुओं के बीच का अंतर होता है — ठीक वैसे जैसे पानी तभी बहता है जब ऊँचाई का अंतर हो।",
        ],
        "visual": {"kind": "circuit", "title": "एक साधारण परिपथ", "battery": "12 V बैटरी", "resistor": "प्रतिरोध R", "note": "वोल्टेज = विद्युत धक्का"},
        "check": _q_open(
            "अपने शब्दों में बताइए — वोल्टेज क्या है?", "वह विद्युत धक्का (दबाव का अंतर) जो चार्ज को चलाता है",
            ["धक्का", "दबाव", "अंतर", "वोल्ट", "ऊर्जा", "push", "pressure"], "वोल्टेज",
            misconceptions=[{
                "patterns": ["बहाव", "इलेक्ट्रॉन बह", "बहते"],
                "label": "वोल्टेज और धारा में भ्रम",
                "feedback": "रुकिए — आपने धारा (करंट) बता दी, जो बहाव है। वोल्टेज बहाव नहीं, बल्कि वह धक्का है जो बहाव पैदा करता है।",
                "analogy": "छत पर रखी पानी की टंकी सोचिए। टंकी की ऊँचाई दबाव बनाती है — वही दबाव वोल्टेज जैसा है। पाइप में बहता पानी धारा है। तो 'धक्का' कौन है? दबाव — यानी वोल्टेज।",
                "followup": _q_open("तो एक लाइन में: वोल्टेज वह ___ है जो चार्ज को धकेलता है। कौन-सा शब्द आएगा?", "धक्का / दबाव", ["धक्का", "दबाव", "push"], "वोल्टेज"),
            }]),
    },
    {
        "concept": "धारा (करंट) — चार्ज का बहाव",
        "script": [
            "अब, जब धक्का है, तो चलता क्या है? विद्युत धारा किसी चालक में इलेक्ट्रिक चार्ज का बहाव है — आमतौर पर तार में इलेक्ट्रॉनों का बहना।",
            "धारा को एम्पियर (A) में मापते हैं। एक एम्पियर का मतलब है हर सेकंड लगभग 6.24 × 10^18 इलेक्ट्रॉन गुज़रना। इसे एमीटर से मापते हैं, जो श्रेणीक्रम में जुड़ता है।",
            "यह तस्वीर याद रखिए: वोल्टेज दबाव है, तो धारा प्रति सेकंड बहता पानी है। धक्का और बहाव — दो अलग चीज़ें।",
        ],
        "visual": {"kind": "flow", "title": "धारा = चार्ज का बहाव", "steps": ["बैटरी धक्का देती है (V)", "इलेक्ट्रॉन तार से गुज़रते हैं", "धारा बहती है — I = Q / t", "एम्पियर (A) में माप"]},
        "check": _q_open(
            "अपने शब्दों में समझाइए: विद्युत धारा क्या है?", "चालक में विद्युत चार्ज (इलेक्ट्रॉन) का बहाव",
            ["बहाव", "चार्ज", "इलेक्ट्रॉन", "बहना", "flow"], "धारा",
            misconceptions=[{
                "patterns": ["दबाव", "धक्का", "वोल्ट"],
                "label": "धारा और वोल्टेज में भ्रम",
                "feedback": "ठहरिए — आपने वोल्टेज बता दिया, यानी धक्का। धारा वह है जो उस धक्के से चलती है।",
                "analogy": "हाईवे पर ट्रैफ़िक को चलाने वाला दबाव वोल्टेज जैसा है; हर सेकंड आपके सामने से गुज़रती गाड़ियाँ — वही धारा है। धारा चार्ज का बहाव है।",
                "followup": _q_open("तो फिर एक लाइन में बताइए — धारा क्या है?", "चार्ज (इलेक्ट्रॉन) का बहाव", ["बहाव", "चार्ज", "इलेक्ट्रॉन", "flow"], "धारा"),
            }]),
    },
    {
        "concept": "प्रतिरोध — बहाव का विरोध",
        "script": [
            "हर चालक चार्ज के बहाव का कुछ-न-कुछ विरोध करता है। इसी विरोध को प्रतिरोध कहते हैं, जिसे ओम (Ω) में मापते हैं।",
            "इसे पानी के पाइप की चौड़ाई जैसा सोचिए। पतला पाइप बहाव रोकता है, तो उतने ही दबाव पर भी कम पानी निकलता है। पतला तार इलेक्ट्रॉनों के साथ बिल्कुल यही करता है।",
            "प्रतिरोध पदार्थ, लंबाई और मोटाई पर निर्भर करता है: लंबा और पतला तार ज़्यादा प्रतिरोध रखता है। इसीलिए हीटर की कॉइल गर्म होकर चमकती है — वह उच्च-प्रतिरोध वाले नाइक्रोम की बनी होती है।",
        ],
        "visual": {"kind": "bullets", "title": "प्रतिरोध — बहाव का विरोध", "items": ["ओम (Ω) में मापा जाता है", "लंबा तार → ज़्यादा प्रतिरोध", "पतला तार → ज़्यादा प्रतिरोध", "पदार्थ मायने रखता है: नाइक्रोम ≫ ताँबा"], "note": "पाइप निचोड़ने जैसा"},
        "check": _q_open(
            "अब एक सोचने वाला सवाल। यदि वोल्टेज वही रहे और हम परिपथ का प्रतिरोध बढ़ा दें, तो धारा का क्या होगा?",
            "धारा घट जाएगी — I = V/R व्युत्क्रम संबंध है",
            ["घट", "कम", "घटे", "decrease", "less", "reduce", "fall"],
            "प्रतिरोध",
            misconceptions=[{
                "patterns": ["बढ़", "ज़्यादा", "ज्यादा", "increase", "more", "badh"],
                "label": "मानना कि प्रतिरोध बढ़ने से धारा बढ़ती है",
                "feedback": "विद्युत में यही सबसे आम ग़लतफ़हमी है, तो चलिए इसे ध्यान से दूर करते हैं। प्रतिरोध बहाव का विरोध करता है। यदि विरोध बढ़े और धक्का वही रहे, तो कम धारा गुज़र पाएगी — धारा घटती है, बढ़ती नहीं।",
                "analogy": "सोचिए: पंप पाइप में पानी धकेल रहा है। अब पाइप को निचोड़ कर पतला कर दीजिए — यानी प्रतिरोध बढ़ा दिया। ज़्यादा पानी निकलेगा या कम? कम! पंप का दबाव (वोल्टेज) वही था, पर पतले पाइप (प्रतिरोध) ने बहाव (धारा) घटा दिया। पतला तार भी इलेक्ट्रॉनों के बहाव को ठीक ऐसे ही रोकता है।",
                "followup": _q_open(
                    "अब लागू करके दिखाइए: परिपथ में बैटरी स्थिर है। हम मोटे तार की जगह बहुत पतला तार लगा दें। धारा बढ़ेगी या घटेगी — और क्यों?",
                    "घटेगी, क्योंकि पतले तार का प्रतिरोध ज़्यादा होता है",
                    ["घट", "कम", "प्रतिरोध", "decrease", "less"], "प्रतिरोध"),
            }]),
    },
    {
        "concept": "ओम का नियम — V = I × R",
        "script": [
            "अब तीनों बातों को एक प्रसिद्ध नियम में जोड़ते हैं — ओम का नियम। इसके अनुसार वोल्टेज बराबर धारा गुणा प्रतिरोध: V = I × R।",
            "इसे पलटें तो धारा बराबर वोल्टेज भागा प्रतिरोध: I = V / R। ध्यान दीजिए — सूत्र कह रहा है वही जो आपने अभी बताया: वोल्टेज समान हो तो प्रतिरोध ज़्यादा का मतलब धारा कम।",
            "चलिए एक हल करते हैं। 12 वोल्ट की बैटरी 4 ओम के प्रतिरोध से जुड़ी है। I = V / R = 12 / 4 = 3 एम्पियर। परिपथ में तीन एम्पियर धारा बहेगी।",
        ],
        "visual": {"kind": "triangle", "title": "ओम नियम त्रिभुज", "top": "V", "left": "I", "right": "R", "note": "जो चाहिए उसे ढकिए: I = V ÷ R", "steps": ["V = I × R", "I = V ÷ R", "R = V ÷ I"]},
        "check": {
            "kind": "mcq", "concept": "ओम का नियम",
            "question": "अब आप गिनिए: यदि V = 12 वोल्ट और R = 4 ओम, तो धारा I कितनी?",
            "options": ["48 A", "3 A", "0.33 A", "8 A"], "answer": 1,
            "misconceptions": [{
                "option": 0,
                "label": "भाग की जगह गुणा कर दिया",
                "feedback": "48 तो 12 × 4 होगा — पर हमें गुणा नहीं, भाग करना है। धारा = वोल्टेज बटा प्रतिरोध: I = V / R = 12 / 4।",
                "analogy": "बोर्ड पर त्रिभुज देखिए। I को उँगली से ढकिए: बचता है V, और उसके नीचे R — यानी V बटा R। बारह भागा चार = 3 एम्पियर।",
                "followup": {"kind": "mcq", "concept": "ओम का नियम", "question": "फिर कोशिश कीजिए: V = 6 V, R = 2 Ω। I कितना?", "options": ["3 A", "12 A", "4 A", "0.5 A"], "answer": 0, "misconceptions": []},
            }],
        },
    },
    {
        "concept": "ओम नियम का ग्राफ़",
        "script": [
            "अंत में, ओम के नियम को चित्र में देखते हैं। यदि किसी स्थिर प्रतिरोध के लिए धारा और वोल्टेज का ग्राफ़ बनाएँ, तो मूल बिंदु से गुज़रती सीधी रेखा मिलती है।",
            "इस रेखा की ढलान 1 बटा R है। तेज़ ढलान का मतलब कम प्रतिरोध — कम वोल्टेज पर भी ज़्यादा धारा। जो पदार्थ इस सीधी-रेखा व्यवहार का पालन करते हैं, उन्हें ओमी चालक कहते हैं।",
            "यह एक नियम पूरी आधुनिक दुनिया चला रहा है: LED के लिए सही प्रतिरोध चुनना, फ़ोन चार्जर की डिज़ाइनिंग, और यह समझना कि शॉर्ट सर्किट ख़तरनाक क्यों है — प्रतिरोध लगभग शून्य, तो धारा अत्यधिक।",
        ],
        "visual": {"kind": "graph", "title": "स्थिर प्रतिरोध का I–V ग्राफ़", "xlabel": "वोल्टेज V →", "ylabel": "धारा I →", "note": "मूल बिंदु से सीधी रेखा ⇒ ओमी चालक", "slope": "ढलान = 1 / R"},
        "check": _q_open(
            "इस विचार का आख़िरी सवाल: शॉर्ट सर्किट ख़तरनाक क्यों है? संकेत — जब प्रतिरोध लगभग शून्य हो जाए तो धारा का क्या होगा?",
            "प्रतिरोध ≈ 0 होने से धारा अत्यधिक बढ़ जाती है (I = V/R), जिससे गर्मी या आग लग सकती है",
            ["धारा", "बढ़", "ज़्यादा", "गर्म", "आग", "current", "large", "huge", "heat", "fire"], "ओम का नियम"),
    },
]

OHM_PACK = {
    "id": "ohm",
    "match": ["ohm", "electricity", "electric", "current", "voltage", "resistance", "circuit",
              "बिजली", "विद्युत", "धारा", "प्रतिरोध", "ओम"],
    "titles": {"en": "Electricity — Current, Voltage and Ohm's Law",
               "hi": "विद्युत — धारा, वोल्टेज और ओम का नियम"},
    "segments": {"en": _OHM_EN, "hi": _OHM_HI},
    "quiz": {
        "en": [
            {"kind": "mcq", "concept": "Resistance", "question": "The SI unit of resistance is…",
             "options": ["Ampere", "Volt", "Ohm", "Watt"], "answer": 2, "misconceptions": []},
            _q_open("A 9 V battery is connected across a 3 Ω resistor. How much current flows?",
                    "3 A (I = V/R = 9/3)", ["3"], "Ohm's Law",
                    misconceptions=[{"patterns": ["27"], "label": "multiplied instead of dividing",
                                     "feedback": "You multiplied 9 × 3. Remember I = V / R — we divide: 9 ÷ 3 = 3 amperes."}]),
            _q_open("Explain in one sentence: why does increasing resistance reduce the current when the voltage is fixed?",
                    "resistance opposes the flow, so more opposition with the same push lets less current through",
                    ["resistance", "oppos"], "Resistance"),
        ],
        "hi": [
            {"kind": "mcq", "concept": "प्रतिरोध", "question": "प्रतिरोध की SI इकाई है…",
             "options": ["एम्पियर", "वोल्ट", "ओम", "वाट"], "answer": 2, "misconceptions": []},
            _q_open("9 V की बैटरी 3 Ω के प्रतिरोध से जुड़ी है। कितनी धारा बहेगी?",
                    "3 A (I = V/R = 9/3)", ["3"], "ओम का नियम",
                    misconceptions=[{"patterns": ["27"], "label": "भाग की जगह गुणा",
                                     "feedback": "आपने 9 × 3 गुणा कर दिया। याद रखिए I = V / R — भाग करते हैं: 9 ÷ 3 = 3 एम्पियर।"}]),
            _q_open("एक वाक्य में समझाइए: वोल्टेज स्थिर हो तो प्रतिरोध बढ़ाने से धारा कम क्यों हो जाती है?",
                    "प्रतिरोध बहाव का विरोध करता है, तो समान धक्के पर ज़्यादा विरोध में कम धारा गुज़रती है",
                    ["प्रतिरोध", "विरोध"], "प्रतिरोध"),
        ],
    },
    "next_topics": {"en": ["Series and parallel circuits", "Electric power (P = V × I)", "Kirchhoff's laws"],
                    "hi": ["श्रेणी और समांतर परिपथ", "विद्युत शक्ति (P = V × I)", "किरचॉफ़ के नियम"]},
}

# ------------------------------------------------------- PHOTOSYNTHESIS PACK

_PHOTO_EN = [
    {
        "concept": "What photosynthesis is",
        "script": [
            "Photosynthesis is the process by which green plants make their own food. They take carbon dioxide from the air and water from the soil, and using sunlight, they convert them into glucose — a sugar full of stored energy.",
            "Oxygen is released as a by-product. Almost every breath you take contains oxygen made by photosynthesis, which is why this process keeps nearly all life on Earth alive.",
        ],
        "visual": {"kind": "flow", "title": "Photosynthesis at a glance", "steps": ["Sunlight hits the leaf", "CO₂ enters, water rises from roots", "Chlorophyll traps light energy", "Glucose is made + O₂ released"]},
        "check": _q_open("In one line: what do plants produce during photosynthesis, and what do they take in?",
                         "they take in CO₂ and water and produce glucose and oxygen",
                         ["glucose", "oxygen", "carbon"], "Photosynthesis basics"),
    },
    {
        "concept": "Where it happens — chloroplasts",
        "script": [
            "Photosynthesis happens inside tiny structures in leaf cells called chloroplasts. These contain a green pigment, chlorophyll, which is what makes leaves look green.",
            "Chlorophyll's job is to capture light energy — mostly from the blue and red parts of sunlight. It reflects green light, which is why plants appear green to our eyes.",
        ],
        "visual": {"kind": "bullets", "title": "The photosynthesis factory", "items": ["Location: chloroplasts in leaf cells", "Pigment: chlorophyll (green)", "Absorbs: blue + red light", "Reflects: green light → leaves look green"]},
        "check": {"kind": "mcq", "concept": "Chloroplasts",
                  "question": "Why do most leaves look green to us?",
                  "options": ["Because chlorophyll absorbs green light", "Because chlorophyll reflects green light", "Because leaves have no pigment", "Because sunlight is green"],
                  "answer": 1, "misconceptions": [{
                      "option": 0, "label": "thinks chlorophyll absorbs green light",
                      "feedback": "Careful — if chlorophyll absorbed green light, that light would never reach our eyes and leaves would not look green. It absorbs red and blue, and reflects green.",
                      "analogy": "A red apple looks red because it absorbs other colours and bounces red light into your eye. Chlorophyll bounces green light the same way.",
                      "followup": {"kind": "mcq", "concept": "Chloroplasts", "question": "So which colours of light does chlorophyll mainly absorb?", "options": ["Red and blue", "Green only", "Yellow only", "None"], "answer": 0, "misconceptions": []},
                  }]},
    },
    {
        "concept": "The equation and why it matters",
        "script": [
            "Here is the whole process in one chemical line: six carbon dioxide molecules plus six water molecules, using light energy, give one glucose molecule plus six oxygen molecules.",
            "Notice the direction of energy: light energy becomes chemical energy stored in glucose. When we eat plants — or animals that ate plants — we are spending that stored sunlight.",
        ],
        "visual": {"kind": "equation_steps", "title": "The photosynthesis equation", "steps": [
            "6CO₂ + 6H₂O  ──light──▶  C₆H₁₂O₆ + 6O₂",
            "carbon dioxide + water  →  glucose + oxygen",
            "light energy → stored chemical energy"]},
        "check": _q_open("What are the two products of photosynthesis?", "glucose and oxygen", ["glucose", "oxygen"], "Photosynthesis equation"),
    },
]

PHOTO_PACK = {
    "id": "photo",
    "match": ["photosynthesis", "plants", "chlorophyll", "प्रकाश संश्लेषण"],
    "titles": {"en": "Photosynthesis"},
    "segments": {"en": _PHOTO_EN},
    "quiz": {"en": [
        _q_open("Write the word equation for photosynthesis.", "carbon dioxide + water → glucose + oxygen (using light)",
                ["carbon", "water", "glucose", "oxygen"], "Photosynthesis equation"),
        {"kind": "mcq", "concept": "Chloroplasts", "question": "Photosynthesis takes place in the…",
         "options": ["Mitochondria", "Nucleus", "Chloroplast", "Ribosome"], "answer": 2, "misconceptions": []},
    ]},
    "next_topics": {"en": ["Cellular respiration", "Light and dark reactions", "Factors affecting photosynthesis"]},
}

# ------------------------------------------------------- NEWTON PACK

_NEWTON_EN = [
    {
        "concept": "First law — inertia",
        "script": [
            "Newton's first law says an object keeps doing what it is doing unless a force makes it change. A ball at rest stays at rest; a moving ball would roll forever if nothing slowed it down.",
            "This resistance to change is called inertia. That is why you lurch forward when a bus brakes suddenly — your body was in motion and wants to stay in motion.",
        ],
        "visual": {"kind": "bullets", "title": "Law 1: Inertia", "items": ["No force → no change in motion", "Inertia = resistance to change", "Seatbelts exist because of inertia!"]},
        "check": _q_open("Why do passengers jerk forward when a moving bus stops suddenly?",
                         "inertia: their bodies keep moving forward though the bus stopped",
                         ["inertia", "motion", "keep", "moving"], "Inertia"),
    },
    {
        "concept": "Second law — F = m × a",
        "script": [
            "The second law puts a number on force: force equals mass times acceleration, F = m × a. A heavier object needs more force for the same acceleration.",
            "Example: pushing an empty shopping cart is easy; the same push on a fully loaded cart produces much less acceleration — same force, more mass, less acceleration.",
        ],
        "visual": {"kind": "equation_steps", "title": "Law 2: F = m × a", "steps": ["F = m × a", "Twice the mass → half the acceleration (same F)", "Example: 2 kg cart, 10 N push → a = 5 m/s²"]},
        "check": _q_open("A force of 10 N acts on a 2 kg trolley. What is its acceleration?",
                         "a = F/m = 10/2 = 5 m/s²", ["5"], "F=ma"),
    },
    {
        "concept": "Third law — action and reaction",
        "script": [
            "The third law: every action has an equal and opposite reaction. When you push a wall, the wall pushes you back with equal force.",
            "Rockets are the grand example — they throw exhaust gas downwards (action), and the gas pushes the rocket upwards (reaction).",
        ],
        "visual": {"kind": "flow", "title": "Law 3: Action ↔ Reaction", "steps": ["Rocket pushes gas down (action)", "Gas pushes rocket up (reaction)", "Forces are equal in size, opposite in direction"]},
        "check": _q_open("How does a rocket move upward? Which law explains it?",
                         "expelled gas pushes back on the rocket — Newton's third law",
                         ["gas", "reaction", "third", "opposite", "push"], "Action-reaction"),
    },
]

NEWTON_PACK = {
    "id": "newton",
    "match": ["newton", "laws of motion", "force", "inertia", "गति के नियम"],
    "titles": {"en": "Newton's Laws of Motion"},
    "segments": {"en": _NEWTON_EN},
    "quiz": {"en": [
        {"kind": "mcq", "concept": "F=ma", "question": "The unit of force is the…",
         "options": ["Joule", "Newton", "Pascal", "Watt"], "answer": 1, "misconceptions": []},
        _q_open("Name the law and the effect: a book resting on a table stays at rest until pushed.",
                "first law — inertia; objects resist changes to their state of motion",
                ["first", "inertia", "rest"], "Inertia"),
    ]},
    "next_topics": {"en": ["Friction", "Momentum", "Gravitation"]},
}

PACKS = [OHM_PACK, PHOTO_PACK, NEWTON_PACK]

# ------------------------------------------------------- LEARNING PATHS

PATHS = {
    "machine learning": ["Python fundamentals", "Mathematics for ML (linear algebra, statistics)",
                         "Data processing and visualisation", "Supervised learning",
                         "Unsupervised learning", "Model evaluation and validation",
                         "Neural networks", "Advanced machine learning"],
    "python": ["Variables and data types", "Control flow", "Functions", "Data structures",
               "File handling and errors", "OOP basics", "Libraries and projects"],
}

KEYWORD_PATHS = {"machine learning": "machine learning", "ml": "machine learning", "ai": "machine learning",
                 "python": "python"}


def find_pack(topic):
    t = (topic or "").lower()
    for pack in PACKS:
        for kw in pack["match"]:
            if kw in t:
                return pack
    return None


def find_path(topic):
    t = (topic or "").lower()
    for kw, key in KEYWORD_PATHS.items():
        if kw in t:
            return list(PATHS[key])
    return None
