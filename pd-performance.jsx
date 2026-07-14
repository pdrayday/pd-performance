import React, { useState, useEffect, useRef } from "react";
import {
  User, Dumbbell, Utensils, CheckSquare, MessageCircle, Lock, Unlock,
  Play, Plus, Trash2, ChevronRight, Flame, Sparkles, CreditCard, Users,
  RefreshCw, Check, X, Video, Settings, Camera, Heart, ImagePlus, Scale, Bell, CalendarDays,
  Sun, Moon
} from "lucide-react";

/* ---------- design tokens (CSS variables — themed dark/light) ---------- */
const INK = "var(--ink)";
const SURFACE = "var(--surface)";
const SURFACE2 = "var(--surface2)";
const LINE = "var(--line)";
const PAPER = "var(--paper)";
const RED = "var(--red)";
const MUTED = "var(--muted)";

const fontDisplay = { fontFamily: "'Oswald', sans-serif" };
const fontBody = { fontFamily: "'Inter', sans-serif" };
const fontMono = { fontFamily: "'IBM Plex Mono', monospace" };

/* ---------- storage helpers (host storage when available, localStorage on the web) ---------- */
const sget = async (k, shared = false) => {
  try {
    if (typeof window !== "undefined" && window.storage?.get) {
      const r = await window.storage.get(k, shared);
      return r ? JSON.parse(r.value) : null;
    }
    const v = localStorage.getItem(`pt-web:${k}`);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};
const sset = async (k, v, shared = false) => {
  try {
    if (typeof window !== "undefined" && window.storage?.set) {
      await window.storage.set(k, JSON.stringify(v), shared);
    } else {
      localStorage.setItem(`pt-web:${k}`, JSON.stringify(v));
    }
  } catch (e) {
    console.error("storage error", e);
  }
};

/* ---------- image compression (keeps storage under limits) ---------- */
const compressImage = (file, maxW = 600, quality = 0.65) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* ---------- Claude API helpers (used when the host provides API access; otherwise the built-in engine below takes over) ---------- */
async function askClaude(messages, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const data = await res.json();
  const txt = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
  if (!txt) throw new Error("empty response");
  return txt;
}

const dataUrlToImageBlock = (dataUrl) => ({
  type: "image",
  source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] },
});

/* ====================================================================== */
/* BUILT-IN COACHING ENGINE — runs fully inside the app, no external AI.  */
/* Used automatically whenever the Claude API isn't available (e.g. the   */
/* public web version).                                                   */
/* ====================================================================== */
const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TRAIN_DAY_IDX = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };

function localSplit(daysStr, minsStr, focus, goal) {
  const d = Math.min(Math.max(parseInt(daysStr, 10) || 6, 3), 6);
  const short = (parseInt(minsStr, 10) || 60) <= 45;
  const hyrox = /hyrox|endurance/i.test(focus);
  const fatLoss = /fat/i.test(focus);
  const sessions = {
    3: [
      ["Full Body A", "Squat focus plus push and pull compounds"],
      ["Full Body B", "Hinge focus plus presses and rows"],
      ["Full Body C", hyrox ? "Engine day: intervals, sled work, burpee circuit" : "Volume day: weak points and arms"],
    ],
    4: [
      ["Upper A", "Heavy presses and rows"],
      ["Lower A", "Squat focus, quads and calves"],
      ["Upper B", "Pull focus, shoulders and arms"],
      ["Lower B", hyrox ? "Hyrox engine: runs, sled push/pull, walking lunges" : "Hinge focus, hamstrings and glutes"],
    ],
    5: [
      ["Legs", hyrox ? "Half Hyrox circuit plus heavy lower work" : "Quad-dominant lower session"],
      ["Chest & Biceps", "Presses first, curls after"],
      ["Back & Triceps", "Rows and pulldowns, then pushdowns and dips"],
      ["Shoulders & Arms", "Overhead press, lateral raises, arm supersets"],
      [fatLoss ? "Conditioning" : "Upper Pump", fatLoss ? "Intervals, sled and core circuit" : "Higher-rep pressing and pulling volume"],
    ],
    6: [
      ["Legs", hyrox ? "Hyrox/CrossFit-style circuit: 4 rounds of 0.7 mi run plus a station" : "Heavy lower: squat, press, extend"],
      ["Chest & Biceps", "Push plus arms"],
      ["Back & Triceps", "Pull plus arms"],
      ["Light Legs & Shoulders", "Lighter loads, strict form, extra volume"],
      ["Chest & Biceps", "Push plus arms, higher reps"],
      ["Back & Triceps", "Pull plus arms, higher reps"],
    ],
  }[d];
  const idx = TRAIN_DAY_IDX[d];
  const days = WEEK.map((day, i) => {
    const s = idx.indexOf(i);
    return s >= 0
      ? { day, focus: sessions[s][0], notes: sessions[s][1] + (short ? " — superset accessories to stay inside your time cap" : "") }
      : { day, focus: "Rest", notes: "Walk, stretch, hydrate — recovery is where the growth happens" };
  });
  return {
    days,
    summary: `A ${d}-day week built for ${focus.toLowerCase()} at roughly ${minsStr} minutes per session. Add a little weight or a rep most weeks — progressive overload on this structure is what moves you toward ${goal || "your goal"}.`,
  };
}

const MEAL_LIB = {
  breakfast: ["eggs with oatmeal and berries", "greek yogurt with granola and honey", "protein shake with banana and peanut butter", "egg-white omelet with toast and fruit"],
  lunch: ["grilled chicken with rice and vegetables", "lean ground beef bowl with potatoes", "turkey wrap with a side salad", "salmon with quinoa and greens"],
  dinner: ["steak with sweet potato and asparagus", "chicken thighs with pasta and broccoli", "shrimp stir-fry over rice", "pork tenderloin with roasted vegetables"],
  snack: ["cottage cheese with pineapple", "a protein bar and an apple", "beef jerky and almonds", "rice cakes with peanut butter"],
};
const MEAL_SLOTS = { 1: ["dinner"], 2: ["lunch", "dinner"], 3: ["breakfast", "lunch", "dinner"], 4: ["breakfast", "lunch", "snack", "dinner"], 5: ["breakfast", "snack", "lunch", "snack", "dinner"], 6: ["breakfast", "snack", "lunch", "snack", "dinner", "snack"] };
const GOAL_CAL_PER_LB = { "Fat loss (cut)": 11.5, Maintain: 14, "Muscle gain (bulk)": 16, Recomposition: 13 };

function localDiet(profile, prefs) {
  const w = parseFloat(profile.weightLb) || 180;
  const goal = prefs.dietGoal || "Maintain";
  const cal = Math.round(((GOAL_CAL_PER_LB[goal] || 14) * w) / 50) * 50;
  const protein = Math.round(w);
  const banned = [
    ...(prefs.allergies || []).map((a) => a.toLowerCase().trim()),
    ...(prefs.dislikes || "").toLowerCase().split(",").map((s) => s.trim()),
  ].filter(Boolean);
  const ok = (food) => !banned.some((b) => food.toLowerCase().includes(b));
  const pick = (slot, n = 2) => {
    const opts = MEAL_LIB[slot].filter(ok);
    return (opts.length ? opts : ["a lean protein with a carb and vegetables you tolerate"]).slice(0, n);
  };
  const n = parseInt(prefs.mealsPerDay, 10);
  if (n === 0) {
    return `Overview: you're running a fasting protocol at about ${cal} calories and ${protein}g protein on eating days. Hold the fast with water, black coffee, and electrolytes (sodium, potassium, magnesium), and break it gently.

FASTING DAYS
Keep electrolytes up and stay busy through hunger waves — they pass. Light walking is fine; save hard sessions for eating days when possible.

REFEED / EATING DAYS
Break the fast with protein first — for example ${pick("lunch", 1)[0]}. Then eat normal whole-food meals to your ${cal}-calorie target, protein at every meal, and stop a couple hours before bed. If training fasted, put most carbs in the meal after your session.

${(prefs.allergies || []).length ? `Strictly excluded (allergies): ${prefs.allergies.join(", ")}. ` : ""}General guidance — adjust portions weekly based on the scale trend.`;
  }
  const slots = MEAL_SLOTS[Math.min(Math.max(n || 3, 1), 6)];
  const mealLines = (restDay) => slots.map((slot, i) => {
    const opts = pick(slot);
    return `Meal ${i + 1} (${slot}): ${opts[0]}${opts[1] ? `, or ${opts[1]}` : ""}${restDay && slot === "snack" ? " (halve this on rest days)" : ""}`;
  }).join("\n");
  return `Overview: aim for about ${cal} calories and ${protein}g protein daily for ${goal.toLowerCase()} at ${w} lb, spread over ${slots.length} meals. ${prefs.likes ? `Your staples — ${prefs.likes} — fit anywhere below; swap them in freely.` : "Swap in equivalent foods you enjoy — adherence beats perfection."}

TRAINING DAYS
${mealLines(false)}
Put your biggest carb meal after training. On your hardest conditioning day, add an extra carb portion at dinner.

REST DAY
${mealLines(true)}
Drop roughly 200 calories, mostly from carbs — keep protein identical.

${(prefs.allergies || []).length ? `Strictly excluded (allergies): ${prefs.allergies.join(", ")}. ` : ""}${prefs.schedule ? `Schedule note: ${prefs.schedule} — prep meals the night before where that bites. ` : ""}Weigh in weekly and adjust portions by the trend, not by a single day.`;
}

function localBmiInsight(bmi, cat, goal, picCount, h, w) {
  const parts = [`Your BMI comes out to ${bmi.toFixed(1)} at ${h}" and ${w} lb — the ${cat.toLowerCase()}.`];
  parts.push(
    cat === "Overweight" || cat === "Obese range"
      ? "Keep in mind BMI can't tell muscle from fat — people who train hard routinely read one category high, so treat it as a single data point rather than a verdict."
      : "BMI is a blunt tool — it says nothing about how much of that weight is muscle, so pair it with photos and how your training is progressing."
  );
  if (picCount > 0) parts.push(`You've attached ${picCount} photo${picCount > 1 ? "s" : ""} — the built-in engine can't read them visually, but keep taking them weekly in the same spot and lighting; the mirror trend beats the scale.`);
  const rec = {
    "Lose fat": "For fat loss, hold a modest calorie deficit and protect your protein — the 6-day split gives you plenty of output, so let the diet do the cutting.",
    "Build muscle": "For building muscle, eat at a small surplus and chase progressive overload — add a rep or a little weight most weeks.",
    "Recomposition (lose fat + build muscle)": "For recomposition, keep calories near maintenance, protein high (about 1g per lb), and let training quality drive the change.",
    "Hyrox/CrossFit & endurance performance": "For Hyrox/CrossFit performance, prioritize your engine work and fuel it — carbs around sessions, and don't skimp on sleep.",
    "General health & strength": "For general health and strength, consistency is the whole game — hit your sessions, walk daily, and sleep 7+ hours.",
  }[goal] || "Pick a specific goal in your profile and the recommendations here get sharper.";
  parts.push(rec);
  parts.push("This is an estimate from your numbers, not a medical measurement.");
  return parts.join(" ");
}

function localCoach(q, profile, dietPrefs) {
  const s = q.toLowerCase();
  const goal = profile.goal || "your goal";
  if (/(pace|pacing|run|running|mile)/.test(s))
    return "For Hyrox/CrossFit-style circuits, go out at a pace you could hold for twice the distance — the stations punish anyone who redlines the first run. Aim for controlled runs where you can still push the sled hard, and treat the last run as the one you empty the tank on. Practice running on tired legs; that's the whole sport.";
  if (/(before|pre[- ]?workout|after|post[- ]?workout)/.test(s) && /(eat|food|meal|fuel)/.test(s))
    return `Eat a carb + protein meal 90 minutes to 2 hours before training — something like rice and chicken or oatmeal and eggs. After, get protein and carbs within a couple of hours. On Monday legs especially, don't train under-fueled — that session is your hardest of the week. Keep it consistent with your ${dietPrefs?.dietGoal?.toLowerCase() || "diet"} targets.`;
  if (/(eat|food|meal|protein|carb|diet|nutrition|calorie)/.test(s))
    return `Anchor every meal on protein — about 1g per pound of bodyweight daily — then fill in carbs around training and keep fats moderate. Your Fuel tab can build the full plan around foods you actually like. For ${goal.toLowerCase()}, adherence beats any perfect macro split, so build meals you'll repeat without willpower.`;
  if (/(sore|pain|hurt|injur|tweak)/.test(s))
    return "Normal soreness fades in 48–72 hours and eases once you warm up — sharp, joint-specific, or one-sided pain does not. Train around it, not through it: swap the aggravating movement, drop the load, and if it persists more than a week or affects daily life, see a physio or doctor. Protecting a lift for a week beats losing a limb of training for months.";
  if (/(miss|skip|busy|only.*days|fewer|can'?t train)/.test(s))
    return "If the week shrinks, protect Monday legs first — it drives the most adaptation — then keep one push and one pull day. Cut the lighter volume days (Thursday first). Three hard, focused sessions beat six rushed ones; pick up the split where you left off rather than doubling up.";
  if (/(sleep|recover|rest|tired|fatigue)/.test(s))
    return "Recovery is where the growth happens: 7–9 hours of sleep, protein at every meal, and easy walking on rest days. If you're dragging for multiple sessions in a row, take an extra rest day — one deload day costs nothing; weeks of half-effort sessions cost a lot.";
  if (/(plateau|stuck|stall|not (losing|gaining|growing))/.test(s))
    return `Plateaus break with one variable at a time. Check the boring stuff first: are you actually adding weight or reps weekly, and is your food tracked honestly? For ${goal.toLowerCase()}, adjust calories by ~150–200 in the right direction, hold it two weeks, and judge by the trend — not a single weigh-in.`;
  if (/(lose|cut|fat|weight loss)/.test(s))
    return "Fat loss is a diet problem with a training safeguard: modest deficit, protein around 1g per pound, and keep lifting heavy so the weight you lose is fat, not muscle. The 6-day split already gives you output — resist the urge to add cardio before the diet is dialed.";
  return `Good question. With your goal set to ${goal.toLowerCase()}, the fundamentals are: hit the split consistently, progress something every week, protein at about 1g per pound, and sleep 7+. Ask me about pacing, food timing, soreness, plateaus, or what to cut on a short week — or use the AI button up top for a deeper dive with your preferred AI platform.`;
}

/* ---------- static program data ---------- */
const HYROX = [
  { run: "0.7 mi", station: "Sled push", detail: "2 lengths · eight 45 lb plates" },
  { run: "0.7 mi", station: "Sled pull", detail: "2 lengths · take off three 45s (five plates)" },
  { run: "0.7 mi", station: "Burpees", detail: "3.5 distances" },
  { run: "0.7 mi", station: "Lunges", detail: "70 lb EZ bar or two 35 lb dumbbells · 4 distances" },
];

const SPLIT = [
  { day: "Monday", focus: "Legs", tag: "HYROX / CROSSFIT", hyrox: true, exercises: [] },
  {
    day: "Tuesday", focus: "Chest & Biceps", tag: "PUSH + ARMS",
    exercises: [
      { name: "Incline dumbbell press", sets: 4, reps: "8–12", note: "no superset" },
      { name: "Flat barbell bench press", sets: 4, reps: "6–10", note: "no superset" },
      { name: "Cable fly", sets: 3, reps: "12–15", note: "slow negatives" },
      { name: "Barbell curl", sets: 4, reps: "8–12", note: "no superset" },
      { name: "Incline dumbbell curl", sets: 3, reps: "10–12", note: "full stretch at bottom" },
      { name: "Hammer curl", sets: 3, reps: "10–12", note: "superset with incline curl optional" },
    ],
  },
  {
    day: "Wednesday", focus: "Back & Triceps", tag: "PULL + ARMS",
    exercises: [
      { name: "Lat pulldown", sets: 4, reps: "8–12", note: "no superset" },
      { name: "Barbell row", sets: 4, reps: "6–10", note: "flat back, drive elbows" },
      { name: "Seated cable row", sets: 3, reps: "10–12", note: "squeeze 1 sec at chest" },
      { name: "Rope pushdown", sets: 4, reps: "10–15", note: "no superset" },
      { name: "Overhead dumbbell extension", sets: 3, reps: "10–12", note: "elbows tight" },
      { name: "Dips", sets: 3, reps: "8–12", note: "bodyweight or assisted" },
    ],
  },
  {
    day: "Thursday", focus: "Light Legs & Shoulders", tag: "VOLUME",
    exercises: [
      { name: "Leg press (light)", sets: 3, reps: "12–15", note: "controlled tempo" },
      { name: "Leg extension", sets: 3, reps: "15", note: "pause at top" },
      { name: "Seated leg curl", sets: 3, reps: "12–15", note: "no superset" },
      { name: "Seated dumbbell shoulder press", sets: 4, reps: "8–12", note: "no superset" },
      { name: "Lateral raise", sets: 3, reps: "12–15", note: "light weight, strict form" },
      { name: "Rear delt fly", sets: 3, reps: "12–15", note: "superset with laterals optional" },
    ],
  },
  {
    day: "Friday", focus: "Chest & Biceps", tag: "PUSH + ARMS",
    exercises: [
      { name: "Flat dumbbell press", sets: 4, reps: "8–12", note: "no superset" },
      { name: "Incline barbell press", sets: 4, reps: "6–10", note: "no superset" },
      { name: "Pec deck or dumbbell fly", sets: 3, reps: "12–15", note: "stretch focus" },
      { name: "EZ bar curl", sets: 4, reps: "8–12", note: "no superset" },
      { name: "Cable curl", sets: 3, reps: "12–15", note: "constant tension" },
      { name: "Concentration curl", sets: 3, reps: "10–12", note: "each arm" },
    ],
  },
  {
    day: "Saturday", focus: "Back & Triceps", tag: "PULL + ARMS",
    exercises: [
      { name: "Pull-ups", sets: 4, reps: "6–10", note: "weighted or assisted" },
      { name: "T-bar or chest-supported row", sets: 4, reps: "8–12", note: "no superset" },
      { name: "Straight-arm pulldown", sets: 3, reps: "12–15", note: "lats only" },
      { name: "Close-grip bench press", sets: 4, reps: "8–10", note: "no superset" },
      { name: "Skull crushers", sets: 3, reps: "10–12", note: "elbows in" },
      { name: "Single-arm pushdown", sets: 3, reps: "12–15", note: "each arm" },
    ],
  },
  { day: "Sunday", focus: "Rest & Recovery", tag: "RECOVER", exercises: [] },
];

const PLANS = [
  {
    id: "onetime",
    name: "One-Time",
    sub: "1 month of training & dieting",
    price: 300,
    per: "flat · one month",
    monthly: 300,
    flat: true,
    features: ["Full workout split & videos", "Custom diet plan", "Accountability tracker", "AI coach access"],
  },
  {
    id: "basic",
    name: "Basic",
    sub: "Month-to-month",
    price: 285,
    per: "per month · cancel anytime",
    monthly: 285,
    features: ["Everything in One-Time", "Monthly program refresh", "Group community access", "No commitment"],
  },
  {
    id: "gold",
    name: "Gold",
    sub: "3-Month Builder",
    price: 275,
    per: "per month · 3 months",
    monthly: 275,
    features: ["Everything in Basic", "Form check video reviews", "Priority messaging", "Lower monthly rate"],
  },
  {
    id: "platinum",
    name: "Platinum",
    sub: "6-Month Transform",
    price: 250,
    per: "per month · 6 months",
    monthly: 250,
    features: ["Everything in Gold", "Full recomposition roadmap", "Quarterly progress audits", "Best monthly rate"],
  },
];
const ADDON = { name: "In-person training session", price: 50, note: "Available on every plan · one-on-one with your trainer each week" };

/* ---------- AI platform logos (tiny inline SVGs) ---------- */
const GoogleLogo = ({ s = 14 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
  </svg>
);
const ChatGPTLogo = ({ s = 14 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">
    <path fill="#10A37F" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.073zM13.2599 22.4301a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6455zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);
const GeminiLogo = ({ s = 14 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">
    <defs>
      <linearGradient id="pdGemGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4E8DF5" />
        <stop offset="55%" stopColor="#9168C0" />
        <stop offset="100%" stopColor="#F49C46" />
      </linearGradient>
    </defs>
    <path fill="url(#pdGemGrad)" d="M12 24A14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 12 0a14.3 14.3 0 0 0 12 12 14.3 14.3 0 0 0-12 12z" />
  </svg>
);
const ClaudeLogo = ({ s = 14 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">
    <path fill="#D97757" d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.583.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.352-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
  </svg>
);
const PerplexityLogo = ({ s = 14 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">
    <path fill="#20808D" d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z" />
  </svg>
);
const GrokLogo = ({ s = 14 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true" fill="none" stroke={PAPER} strokeWidth="2.1" strokeLinecap="round">
    <circle cx="12" cy="12" r="7.4" />
    <line x1="18.6" y1="3.2" x2="5.4" y2="20.8" />
  </svg>
);

/* ---------- AI platform config (default: ChatGPT) ---------- */
const AI_CONTEXT = "You are my PD Performance training assistant. I follow a push/pull muscle-building split with an optional Hyrox/CrossFit-style conditioning day. Help me with training, nutrition, and recovery.";
const AI_PLATFORMS = [
  { id: "google", name: "Google", Logo: GoogleLogo, url: `https://www.google.com/search?udm=50&q=${encodeURIComponent(AI_CONTEXT)}` },
  { id: "chatgpt", name: "ChatGPT", Logo: ChatGPTLogo, url: `https://chatgpt.com/?q=${encodeURIComponent(`File this chat in my "pd performance" project folder. ${AI_CONTEXT}`)}` },
  { id: "gemini", name: "Gemini", Logo: GeminiLogo, url: "https://gemini.google.com/app" },
  { id: "claude", name: "Claude", Logo: ClaudeLogo, url: `https://claude.ai/new?q=${encodeURIComponent(AI_CONTEXT)}` },
  { id: "perplexity", name: "Perplexity", Logo: PerplexityLogo, url: `https://www.perplexity.ai/search?q=${encodeURIComponent(AI_CONTEXT)}` },
  { id: "grok", name: "Grok", Logo: GrokLogo, url: `https://grok.com/?q=${encodeURIComponent(AI_CONTEXT)}` },
];
const getPlatform = (id) => AI_PLATFORMS.find((p) => p.id === id) || AI_PLATFORMS.find((p) => p.id === "chatgpt");

/* ---------- SEO / GEO content (rendered in footer + JSON-LD) ---------- */
const SEO_DESC = "PD Performance is an online personal training program: a customizable muscle-building split, an optional Hyrox/CrossFit-style conditioning day, AI-built custom workout splits and diet plans, accountability tracking, and optional in-person coaching. Plans from $250/month.";
const FAQS = [
  {
    q: "What is PD Performance?",
    a: "PD Performance is an online personal training program built around a customizable training split — push/pull muscle-building sessions with an optional Hyrox/CrossFit-style conditioning day — plus AI-generated custom workout splits, personalized diet plans, daily accountability tracking, and a group community.",
  },
  {
    q: "How much does online personal training with PD Performance cost?",
    a: "Plans range from $250 to $300 per month depending on commitment: a one-time month at $300, month-to-month Basic at $285, the 3-month Gold plan at $275/month, and the 6-month Platinum plan at $250/month. Weekly one-on-one in-person training can be added to any plan for $50/month.",
  },
  {
    q: "Do I get a custom workout and diet plan?",
    a: "Yes. The app builds a custom weekly training split around your schedule, session length, and goal, and a personalized diet plan that accounts for foods you like, foods you avoid, and allergies — for fat loss, muscle gain, recomposition, or Hyrox/CrossFit and endurance performance.",
  },
];

/* the most-asked training & health questions in the industry — shown on the FAQ page */
const INDUSTRY_FAQS = [
  { q: "How many days a week should I work out?", a: "3 to 6, depending on your recovery and schedule. Beginners do great on 3 full-body days; more experienced lifters can split across 4–6. More days aren't automatically better — consistency and recovery are what drive progress." },
  { q: "How much protein do I need?", a: "A practical target is 0.7–1 gram per pound of bodyweight per day (about 1.6–2.2 g/kg), spread across your meals. It supports muscle growth, keeps you full, and protects muscle while dieting." },
  { q: "Cardio or weights for fat loss?", a: "A calorie deficit drives fat loss — training decides what you keep. Lifting preserves muscle so the weight you lose is fat; cardio adds calorie burn and heart health. The best results come from both, with the diet doing the heavy lifting." },
  { q: "How long until I see results?", a: "Strength climbs within 2–4 weeks, visible muscle changes usually take 8–12 weeks of consistent training and eating, and sustainable fat loss runs about 0.5–2 lb per week. Photos and measurements show progress before the mirror does." },
  { q: "Can I lose fat and build muscle at the same time?", a: "Yes — especially if you're newer to lifting, returning after a break, or carrying extra body fat. Keep protein high, train hard with progressive overload, and hold a small calorie deficit or maintenance intake." },
  { q: "Should I take creatine?", a: "Creatine monohydrate is the most-researched supplement in sports nutrition — 3–5 g daily supports strength, power, and muscle. It's considered safe for healthy adults; check with your doctor if you have kidney conditions." },
  { q: "Do I need to be sore for a workout to count?", a: "No. Soreness mostly reflects novelty, not effectiveness. Progress comes from progressive overload — gradually adding weight, reps, or quality sets — not from chasing pain." },
  { q: "How much sleep do I need?", a: "7–9 hours. Sleep is when you actually recover and grow — it improves strength, hormone balance, appetite control, and injury resistance. It's the cheapest performance enhancer there is." },
  { q: "What's the best diet?", a: "The one you can stick to. Anchor every meal on protein, build around mostly whole foods, and set calories to match your goal. Keto, fasting, and macro tracking all work when they create the right calorie balance for you." },
  { q: "How much water should I drink?", a: "A good starting point is about half your bodyweight in ounces per day (a 180 lb person: ~90 oz), adding more around training and sweat-heavy sessions. Pale-yellow urine is the simple check." },
];

/* ---------- small UI atoms ---------- */
const Eyebrow = ({ children }) => (
  <h2 style={{ ...fontDisplay, color: RED, letterSpacing: "0.22em", fontSize: 11, fontWeight: 600, margin: 0 }} className="uppercase">
    {children}
  </h2>
);

const Card = ({ children, style, className }) => (
  <div className={className} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, ...style }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = "red", disabled, style }) => {
  const base = {
    ...fontDisplay, letterSpacing: "0.08em", fontWeight: 600, fontSize: 13,
    padding: "10px 16px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", opacity: disabled ? 0.5 : 1,
    display: "inline-flex", alignItems: "center", gap: 8, transition: "transform .08s ease",
  };
  const variants = {
    red: { background: RED, color: PAPER },
    ghost: { background: "transparent", color: PAPER, border: `1px solid ${LINE}` },
    white: { background: PAPER, color: INK },
  };
  return (
    <button onClick={onClick} disabled={disabled} className="uppercase active:scale-95" style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <div style={{ ...fontBody, color: MUTED, fontSize: 12, marginBottom: 6 }}>{label}</div>
    {children}
  </label>
);

const inputStyle = {
  ...fontBody, width: "100%", background: SURFACE2, border: `1px solid ${LINE}`,
  borderRadius: 10, color: PAPER, padding: "10px 12px", fontSize: 14, outline: "none",
};

/* photo picker button */
function PhotoPick({ onPick, label = "Add photo", icon: Icon = Camera }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            try { onPick(await compressImage(f)); } catch { alert("Couldn't read that photo."); }
          }
          e.target.value = "";
        }} />
      <Btn variant="ghost" onClick={() => ref.current?.click()}><Icon size={14} /> {label}</Btn>
    </>
  );
}

/* labeled photo upload slot (tap to add, shows thumbnail when filled) */
function PhotoSlot({ label, photo, onPick, onClear }) {
  const ref = useRef(null);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            try { onPick(await compressImage(f)); } catch { alert("Couldn't read that photo."); }
          }
          e.target.value = "";
        }} />
      {photo ? (
        <div className="relative">
          <img src={photo} alt={`${label} physique photo`} style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 12, border: `1px solid ${RED}`, display: "block" }} />
          <button onClick={onClear}
            style={{ position: "absolute", top: 6, right: 6, background: RED, border: "none", borderRadius: 99, width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={11} color={PAPER} />
          </button>
          <div style={{ ...fontDisplay, color: RED, fontSize: 9.5, letterSpacing: "0.16em", marginTop: 6, textAlign: "center" }} className="uppercase">
            {label} ✓
          </div>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          style={{
            width: "100%", height: 130, borderRadius: 12, cursor: "pointer", padding: "0 4px",
            background: SURFACE2, border: `2px dashed ${LINE}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
          <Camera size={18} color={RED} />
          <span style={{ ...fontDisplay, color: PAPER, fontSize: 10.5, letterSpacing: "0.12em", textAlign: "center" }} className="uppercase">Add {label}</span>
          <span style={{ ...fontBody, color: MUTED, fontSize: 10 }}>Tap to upload</span>
        </button>
      )}
    </div>
  );
}

/* ====================================================================== */
/* TAB 1 — PROFILE                                                        */
/* ====================================================================== */
function ProfileTab({ profile, setProfile, plan, setPlan, trainerCfg, progress, setProgress, addBooking }) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [bmiNote, setBmiNote] = useState("");
  const [bmiLoading, setBmiLoading] = useState(false);
  const [bmiPhotos, setBmiPhotos] = useState({ front: null, back: null, side: null });
  const [newWeight, setNewWeight] = useState("");
  const [newPhoto, setNewPhoto] = useState(null);

  useEffect(() => setDraft(profile), [profile]);

  const save = () => {
    setProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const h = parseFloat(draft.heightIn) || 0;
  const w = parseFloat(draft.weightLb) || 0;
  const bmi = h > 0 && w > 0 ? (703 * w) / (h * h) : null;
  const bmiCat = !bmi ? "" : bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy range" : bmi < 30 ? "Overweight" : "Obese range";
  const picCount = [bmiPhotos.front, bmiPhotos.back, bmiPhotos.side].filter(Boolean).length;
  const PlatformLogo = getPlatform(draft.aiPlatform).Logo;

  const aiBmi = async () => {
    setBmiLoading(true);
    setBmiNote("");
    const pics = [bmiPhotos.front, bmiPhotos.back, bmiPhotos.side].filter(Boolean);
    try {
      const prompt = `You are an encouraging but honest personal-training assistant doing a body-composition check-in.
Client stats: height ${h} in, weight ${w} lb, BMI ${bmi.toFixed(1)} (${bmiCat}). Goal: ${draft.goal || "general fitness"}. Trains 6 days/week (push/pull split with an optional Hyrox/CrossFit-style conditioning day).
${pics.length > 0 ? `${pics.length} physique photo${pics.length > 1 ? "s are" : " is"} attached (from the front/back/side set). Use them to give a visual estimate of body-fat percentage range and where they carry muscle vs fat, and explain how that changes the BMI interpretation (muscular people often read 'overweight' on BMI).` : "No photos attached — interpret the BMI number alone and note its limits."}
In 4-5 short sentences: give your assessment, then one concrete recommendation toward their goal. Plain language, no headers or bullet points. Note this is a visual estimate, not a medical measurement.`;
      const content = [...pics.map(dataUrlToImageBlock), { type: "text", text: prompt }];
      const txt = await askClaude([{ role: "user", content }], 1000);
      setBmiNote(txt);
    } catch {
      /* built-in engine takes over when external AI is unavailable */
      setBmiNote(localBmiInsight(bmi, bmiCat, draft.goal, pics.length, h, w));
    }
    setBmiLoading(false);
  };

  const total = (p) => p.monthly + (draft.addon ? ADDON.price : 0);
  const payVenmo = (p) => {
    const handle = trainerCfg.venmo || "your-trainer";
    const note = encodeURIComponent(`${p.name} plan${draft.addon ? " + trainer access" : ""}`);
    window.open(`https://venmo.com/u/${handle}?txn=pay&amount=${total(p)}&note=${note}`, "_blank");
  };
  const payStripe = (p) => {
    if (trainerCfg.stripe) window.open(trainerCfg.stripe, "_blank");
    else alert("Your trainer hasn't connected a Stripe payment link yet. Use Venmo for now.");
  };

  const addWeighIn = () => {
    const wt = parseFloat(newWeight);
    if (!wt) { alert("Enter a weight first."); return; }
    const entry = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), weight: wt, photo: newPhoto };
    setProgress([entry, ...progress].slice(0, 30)); // keep last 30 to stay under storage limits
    setNewWeight("");
    setNewPhoto(null);
    const nd = { ...draft, weightLb: String(wt) };
    setDraft(nd);
    setProfile(nd);
  };

  const delta = progress.length >= 2 ? (progress[0].weight - progress[progress.length - 1].weight) : null;

  return (
    <div className="space-y-5">
      {/* identity / stats */}
      <Card>
        <Eyebrow>Athlete profile</Eyebrow>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Name">
            <input style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Your name" />
          </Field>
          <Field label="Age">
            <input style={inputStyle} value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} placeholder="28" inputMode="numeric" />
          </Field>
          <Field label="Height (inches)">
            <input style={inputStyle} value={draft.heightIn} onChange={(e) => setDraft({ ...draft, heightIn: e.target.value })} placeholder="70" inputMode="decimal" />
          </Field>
          <Field label="Weight (lb)">
            <input style={inputStyle} value={draft.weightLb} onChange={(e) => setDraft({ ...draft, weightLb: e.target.value })} placeholder="185" inputMode="decimal" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Primary goal">
            <select style={inputStyle} value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })}>
              <option value="">Choose a goal</option>
              <option>Lose fat</option>
              <option>Build muscle</option>
              <option>Recomposition (lose fat + build muscle)</option>
              <option>Hyrox/CrossFit & endurance performance</option>
              <option>General health & strength</option>
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <div style={{ ...fontBody, color: MUTED, fontSize: 12, marginBottom: 6 }}>
            Your photos — the AI uses these with your height and weight for the body comp check below
          </div>
          <div className="flex gap-2">
            <PhotoSlot label="Front" photo={bmiPhotos.front}
              onPick={(p) => setBmiPhotos({ ...bmiPhotos, front: p })}
              onClear={() => setBmiPhotos({ ...bmiPhotos, front: null })} />
            <PhotoSlot label="Back" photo={bmiPhotos.back}
              onPick={(p) => setBmiPhotos({ ...bmiPhotos, back: p })}
              onClear={() => setBmiPhotos({ ...bmiPhotos, back: null })} />
            <PhotoSlot label="Side" photo={bmiPhotos.side}
              onPick={(p) => setBmiPhotos({ ...bmiPhotos, side: p })}
              onClear={() => setBmiPhotos({ ...bmiPhotos, side: null })} />
          </div>
        </div>
        <div className="mt-4">
          <Btn onClick={save}>{saved ? <Check size={14} /> : null}{saved ? "Saved" : "Save profile"}</Btn>
        </div>
      </Card>

      {/* preferred AI platform */}
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>Your AI platform</Eyebrow>
          <Sparkles size={14} color={RED} />
        </div>
        <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
          Pick the AI you use — its icon becomes the AI button in the top bar for everything AI in the app. ChatGPT is the default and opens your account with your "pd performance" folder.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          {AI_PLATFORMS.map((p) => {
            const active = (draft.aiPlatform || "chatgpt") === p.id;
            const L = p.Logo;
            return (
              <button key={p.id} title={p.name}
                onClick={() => { const nd = { ...draft, aiPlatform: p.id }; setDraft(nd); setProfile(nd); }}
                style={{
                  width: 30, height: 30, borderRadius: 8, cursor: "pointer",
                  background: active ? SURFACE2 : "transparent",
                  border: `1px solid ${active ? RED : LINE}`,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                }}>
                <L s={14} />
              </button>
            );
          })}
          <span style={{ ...fontDisplay, color: RED, fontSize: 10, letterSpacing: "0.15em", marginLeft: 4 }} className="uppercase">
            {getPlatform(draft.aiPlatform).name}
          </span>
        </div>
      </Card>

      {/* AI BMI + photo scan */}
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>AI body comp check</Eyebrow>
          <Sparkles size={16} color={RED} />
        </div>
        {bmi ? (
          <div className="mt-4 flex items-end gap-4">
            <div style={{ ...fontMono, fontSize: 44, lineHeight: 1, color: PAPER }}>{bmi.toFixed(1)}</div>
            <div>
              <div style={{ ...fontDisplay, color: RED, fontSize: 14, letterSpacing: "0.1em" }} className="uppercase">BMI · {bmiCat}</div>
              <div style={{ ...fontBody, color: MUTED, fontSize: 12 }}>{h}" · {w} lb{picCount > 0 ? ` · ${picCount} photo${picCount > 1 ? "s" : ""} attached` : ""}</div>
            </div>
          </div>
        ) : (
          <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 12 }}>Enter your height, weight, and pictures above to calculate BMI.</p>
        )}

        {bmi && (
          <div className="mt-4 space-y-3">
            <p style={{ ...fontBody, color: MUTED, fontSize: 12, lineHeight: 1.5 }}>
              {picCount > 0
                ? "Your photos are loaded — the AI will read body composition from them, not just the numbers."
                : "Add your front, back, and side photos in the profile section above so the AI can analyze your actual physique, not just the numbers."}
            </p>
            <Btn onClick={aiBmi} disabled={bmiLoading} style={{ width: "100%", justifyContent: "center" }}>
              {bmiLoading ? <RefreshCw size={14} className="animate-spin" /> : <PlatformLogo s={14} />}
              {bmiLoading ? "Analyzing your photos…" : picCount > 0 ? "Analyze my photos with AI" : "Get AI insight (numbers only)"}
            </Btn>
            {bmiNote && (
              <p style={{ ...fontBody, color: PAPER, fontSize: 13, lineHeight: 1.6, borderLeft: `2px solid ${RED}`, paddingLeft: 12 }}>
                {bmiNote}
              </p>
            )}
            <p style={{ ...fontBody, color: MUTED, fontSize: 11 }}>
              Visual estimate only — not a medical measurement. Photos here aren't saved; use the weigh-in section below to keep progress photos.
            </p>
          </div>
        )}
      </Card>

      {/* progress photos & weigh-ins */}
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>Progress · weigh-ins</Eyebrow>
          <Scale size={16} color={RED} />
        </div>
        <div className="flex gap-2 mt-4">
          <input style={inputStyle} placeholder="Today's weight (lb)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} inputMode="decimal" />
          <PhotoPick label={newPhoto ? "Photo ✓" : "Photo"} onPick={setNewPhoto} />
          <Btn onClick={addWeighIn}><Plus size={14} /></Btn>
        </div>
        {newPhoto && (
          <div className="mt-2 flex items-center gap-2">
            <img src={newPhoto} alt="Check-in preview" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />
            <button onClick={() => setNewPhoto(null)} style={{ ...fontBody, background: "none", border: "none", color: MUTED, fontSize: 12, cursor: "pointer" }}>remove</button>
          </div>
        )}

        {progress.length > 0 && (
          <>
            {delta !== null && (
              <div className="flex items-center gap-2 mt-4" style={{ ...fontMono, fontSize: 13, color: delta <= 0 ? RED : PAPER }}>
                <Flame size={14} color={RED} />
                {delta === 0 ? "Holding steady" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} lb since first check-in`}
              </div>
            )}
            <div className="mt-3 space-y-2">
              {progress.map((p) => (
                <div key={p.id} className="flex items-center justify-between" style={{ background: SURFACE2, borderRadius: 10, padding: "8px 12px", border: `1px solid ${LINE}` }}>
                  <div className="flex items-center gap-3">
                    {p.photo ? (
                      <img src={p.photo} alt={`Check-in ${p.date}`} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: SURFACE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Scale size={16} color={MUTED} />
                      </div>
                    )}
                    <div>
                      <div style={{ ...fontMono, color: PAPER, fontSize: 15 }}>{p.weight} lb</div>
                      <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{p.date}</div>
                    </div>
                  </div>
                  <button onClick={() => setProgress(progress.filter((x) => x.id !== p.id))} style={{ background: "none", border: "none", cursor: "pointer" }}>
                    <Trash2 size={14} color={MUTED} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {progress.length === 0 && (
          <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 12 }}>
            Log your first weigh-in. Same day each week, same lighting for photos — that's how you actually see change.
          </p>
        )}
      </Card>

      {/* membership */}
      <Card>
        <Eyebrow>Membership</Eyebrow>
        <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          Commit longer, pay less per month. Switch plans anytime as your goals change.
        </p>
        <div className="space-y-3 mt-4">
          {PLANS.map((p) => {
            const active = plan?.id === p.id;
            return (
              <div key={p.id} onClick={() => setPlan({ id: p.id, addon: draft.addon })}
                style={{ background: active ? SURFACE2 : "transparent", border: `1px solid ${active ? RED : LINE}`, borderRadius: 12, padding: 14, cursor: "pointer" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div style={{ ...fontDisplay, color: PAPER, fontSize: 18, letterSpacing: "0.05em" }} className="uppercase">{p.name}</div>
                    <div style={{ ...fontBody, color: MUTED, fontSize: 12 }}>{p.sub}</div>
                  </div>
                  <div className="text-right">
                    <div style={{ ...fontMono, color: active ? RED : PAPER, fontSize: 22 }}>${p.price}</div>
                    <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{p.per}</div>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2" style={{ ...fontBody, color: MUTED, fontSize: 12 }}>
                      <Check size={12} color={RED} /> {f}
                    </li>
                  ))}
                </ul>
                {active && (
                  <div style={{ ...fontDisplay, color: RED, fontSize: 11, letterSpacing: "0.15em", marginTop: 8 }} className="uppercase">Current plan</div>
                )}
              </div>
            );
          })}
        </div>

        {/* payment */}
        {plan && (
          <div className="mt-5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
            <div className="flex items-baseline justify-between">
              <Eyebrow>Due now</Eyebrow>
              <div style={{ ...fontMono, color: PAPER, fontSize: 28 }}>
                ${total(PLANS.find((p) => p.id === plan.id))}
                <span style={{ fontSize: 12, color: MUTED }}> {PLANS.find((p) => p.id === plan.id).flat ? "flat" : "/mo"}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-3">
              <Btn onClick={() => payVenmo(PLANS.find((p) => p.id === plan.id))} style={{ flex: 1, justifyContent: "center" }}>
                Pay with Venmo
              </Btn>
              <Btn variant="ghost" onClick={() => payStripe(PLANS.find((p) => p.id === plan.id))} style={{ flex: 1, justifyContent: "center" }}>
                <CreditCard size={14} /> Card (Stripe)
              </Btn>
            </div>
          </div>
        )}

        {/* in-person session add-on — bottom of card, every plan */}
        <div className="mt-5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
          <div
            onClick={() => {
              const nd = { ...draft, addon: !draft.addon };
              setDraft(nd);
              setProfile(nd);
              if (plan) setPlan({ ...plan, addon: nd.addon });
            }}
            className="flex items-center justify-between"
            style={{ border: `1px dashed ${draft.addon ? RED : LINE}`, borderRadius: 12, padding: 14, cursor: "pointer" }}
          >
            <div>
              <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{ADDON.name}</div>
              <div style={{ ...fontBody, color: MUTED, fontSize: 12 }}>{ADDON.note}</div>
            </div>
            <div style={{ ...fontMono, color: draft.addon ? RED : PAPER, fontSize: 16 }}>+${ADDON.price}/mo</div>
          </div>
          {draft.addon && (
            <div className="mt-3">
              <Btn
                onClick={() => {
                  addBooking({
                    id: Date.now().toString(),
                    name: draft.name?.trim() || "Client",
                    date: new Date().toISOString(),
                  });
                  if (trainerCfg.calendar) window.open(trainerCfg.calendar, "_blank");
                  alert("You're on the schedule — your trainer has been notified for this week.");
                }}
                style={{ width: "100%", justifyContent: "center" }}
              >
                <CalendarDays size={14} /> Book this week's session
              </Btn>
              <p style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 8 }}>
                Booking puts you on your trainer's weekly schedule and opens the calendar to pick your time slot.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ====================================================================== */
/* TAB 2 — WORKOUTS                                                       */
/* ====================================================================== */
function HyroxCircuit() {
  return (
    <div className="relative mt-4" style={{ paddingLeft: 26 }}>
      <div style={{ position: "absolute", left: 9, top: 8, bottom: 8, width: 2, background: `linear-gradient(${RED}, ${LINE})` }} />
      {HYROX.map((seg, i) => (
        <div key={i} className="relative mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div style={{ position: "absolute", left: -26, width: 20, height: 20, borderRadius: 99, background: INK, border: `2px solid ${RED}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: 99, background: RED }} />
            </div>
            <span style={{ ...fontDisplay, color: RED, fontSize: 12, letterSpacing: "0.2em" }} className="uppercase">Run</span>
            <span style={{ ...fontMono, color: PAPER, fontSize: 13 }}>{seg.run}</span>
          </div>
          <div style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px" }}>
            <div className="flex items-center justify-between">
              <span style={{ ...fontDisplay, color: PAPER, fontSize: 16, letterSpacing: "0.04em" }} className="uppercase">{seg.station}</span>
              <span style={{ ...fontMono, color: MUTED, fontSize: 11 }}>STATION {i + 1}/4</span>
            </div>
            <div style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 4 }}>{seg.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExerciseList({ exercises }) {
  return (
    <div className="mt-3 space-y-2">
      {exercises.map((ex, i) => (
        <div key={i} className="flex items-center justify-between" style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
          <div>
            <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{ex.name}</div>
            <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{ex.note}</div>
          </div>
          <div style={{ ...fontMono, color: RED, fontSize: 12, whiteSpace: "nowrap", marginLeft: 10 }}>
            {ex.sets} × {ex.reps}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkoutsTab({ trainerMode, videos, addVideo, removeVideo, customSplit, setCustomSplit, profile }) {
  const [openDay, setOpenDay] = useState("Monday");
  const [vTitle, setVTitle] = useState("");
  const [vUrl, setVUrl] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [bDays, setBDays] = useState("6");
  const [bMins, setBMins] = useState("60");
  const [bFocus, setBFocus] = useState("Build muscle");
  const [building, setBuilding] = useState(false);

  const ytId = (url) => {
    const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
    return m ? m[1] : null;
  };

  const buildSplit = async () => {
    setBuilding(true);
    try {
      const txt = await askClaude([
        {
          role: "user",
          content: `Create a weekly training split. Constraints: ${bDays} days per week, about ${bMins} minutes per session, main focus: ${bFocus}. Client goal: ${profile.goal || "general fitness"}. Respond ONLY with valid JSON, no markdown fences, in this shape: {"days":[{"day":"Monday","focus":"...","notes":"one short sentence"}], "summary":"2 sentence plain-language explanation of why this split fits"}. Include all 7 days of the week, marking non-training days as "Rest".`,
        },
      ], 1200);
      const clean = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setCustomSplit(parsed);
    } catch {
      /* built-in engine takes over when external AI is unavailable */
      setCustomSplit(localSplit(bDays, bMins, bFocus, profile.goal));
    }
    setBuilding(false);
  };

  const activeSplit = customSplit
    ? customSplit.days.map((d) => ({ day: d.day, focus: d.focus, tag: d.notes, hyrox: false, exercises: [] }))
    : SPLIT;

  const PlatformLogo = getPlatform(profile.aiPlatform).Logo;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>{customSplit ? "Your custom split" : "Weekly split"}</Eyebrow>
          <button onClick={() => setShowBuilder(!showBuilder)}
            style={{ ...fontDisplay, color: RED, fontSize: 11, letterSpacing: "0.15em", background: "none", border: "none", cursor: "pointer" }}
            className="uppercase">
            {showBuilder ? "Close builder" : "Customize split"}
          </button>
        </div>

        {showBuilder && (
          <div className="mt-4 space-y-3" style={{ background: SURFACE2, borderRadius: 12, padding: 14, border: `1px solid ${LINE}` }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Days per week">
                <select style={inputStyle} value={bDays} onChange={(e) => setBDays(e.target.value)}>
                  {["3", "4", "5", "6"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Minutes per session">
                <select style={inputStyle} value={bMins} onChange={(e) => setBMins(e.target.value)}>
                  {["30", "45", "60", "75", "90"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Main focus">
              <select style={inputStyle} value={bFocus} onChange={(e) => setBFocus(e.target.value)}>
                <option>Build muscle</option>
                <option>Lose fat</option>
                <option>Strength</option>
                <option>Hyrox/CrossFit / endurance</option>
                <option>Athletic performance</option>
              </select>
            </Field>
            <div className="flex gap-3 flex-wrap">
              <Btn onClick={buildSplit} disabled={building}>
                {building ? <RefreshCw size={14} className="animate-spin" /> : <PlatformLogo s={14} />}
                {building ? "Building…" : "Build my split with AI"}
              </Btn>
              {customSplit && <Btn variant="ghost" onClick={() => setCustomSplit(null)}>Reset to coach's split</Btn>}
            </div>
            {customSplit?.summary && <p style={{ ...fontBody, color: MUTED, fontSize: 12, lineHeight: 1.5 }}>{customSplit.summary}</p>}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {activeSplit.map((d) => {
            const open = openDay === d.day;
            const dayVideos = videos.filter((v) => v.day === d.day);
            return (
              <div key={d.day} style={{ border: `1px solid ${open ? RED : LINE}`, borderRadius: 12, overflow: "hidden" }}>
                <div onClick={() => setOpenDay(open ? null : d.day)} className="flex items-center justify-between"
                  style={{ padding: "12px 14px", cursor: "pointer", background: open ? SURFACE2 : "transparent" }}>
                  <div className="flex items-center gap-3">
                    <span style={{ ...fontMono, color: MUTED, fontSize: 11, width: 32 }}>{d.day.slice(0, 3).toUpperCase()}</span>
                    <span style={{ ...fontDisplay, color: PAPER, fontSize: 15, letterSpacing: "0.04em" }} className="uppercase">{d.focus}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.hyrox && (
                      <span style={{ ...fontDisplay, color: RED, fontSize: 10, letterSpacing: "0.15em" }} className="uppercase">{d.tag}</span>
                    )}
                    <ChevronRight size={16} color={MUTED} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                  </div>
                </div>

                {open && (
                  <div style={{ padding: "0 14px 14px", background: SURFACE2 }}>
                    {d.hyrox && !customSplit ? (
                      <HyroxCircuit />
                    ) : d.exercises && d.exercises.length > 0 ? (
                      <ExerciseList exercises={d.exercises} />
                    ) : (
                      <p style={{ ...fontBody, color: MUTED, fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
                        {customSplit ? d.tag : d.day === "Sunday" ? "Full rest. Walk, stretch, sleep, hydrate — recovery is where the growth happens." : `${d.focus} session.`}
                      </p>
                    )}

                    {dayVideos.length > 0 && (
                      <div className="mt-3 space-y-3">
                        <Eyebrow>Coach's videos</Eyebrow>
                        {dayVideos.map((v) => {
                          const id = ytId(v.url);
                          return (
                            <div key={v.id} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${LINE}` }}>
                              {id ? (
                                <iframe title={v.title} src={`https://www.youtube.com/embed/${id}`}
                                  style={{ width: "100%", aspectRatio: "16/9", border: "none", display: "block" }} allowFullScreen />
                              ) : (
                                <a href={v.url} target="_blank" rel="noreferrer" className="flex items-center gap-2"
                                  style={{ ...fontBody, color: PAPER, fontSize: 13, padding: 12, textDecoration: "none" }}>
                                  <Play size={14} color={RED} /> {v.title || v.url}
                                </a>
                              )}
                              <div className="flex items-center justify-between" style={{ padding: "8px 12px" }}>
                                <span style={{ ...fontBody, color: MUTED, fontSize: 12 }}>{v.title}</span>
                                {trainerMode && (
                                  <button onClick={() => removeVideo(v.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                                    <Trash2 size={14} color={MUTED} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {trainerMode && (
                      <div className="mt-3 space-y-2" style={{ borderTop: `1px dashed ${LINE}`, paddingTop: 12 }}>
                        <div className="flex items-center gap-2">
                          <Video size={14} color={RED} />
                          <span style={{ ...fontDisplay, color: RED, fontSize: 11, letterSpacing: "0.15em" }} className="uppercase">Trainer: add video</span>
                        </div>
                        <input style={inputStyle} placeholder="Video title (e.g. Sled push form)" value={vTitle} onChange={(e) => setVTitle(e.target.value)} />
                        <input style={inputStyle} placeholder="Video URL (YouTube or any link)" value={vUrl} onChange={(e) => setVUrl(e.target.value)} />
                        <Btn variant="ghost" onClick={() => {
                          if (!vUrl.trim()) return;
                          addVideo({ id: Date.now().toString(), day: d.day, title: vTitle.trim() || "Demo", url: vUrl.trim() });
                          setVTitle(""); setVUrl("");
                        }}>
                          <Plus size={14} /> Add to {d.day}
                        </Btn>
                      </div>
                    )}
                    {!trainerMode && dayVideos.length === 0 && d.day !== "Sunday" && (
                      <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 10 }}>
                        No videos yet — your trainer will post demos here.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ====================================================================== */
/* TAB 3 — DIET                                                           */
/* ====================================================================== */
function DietTab({ profile, dietPrefs, setDietPrefs, dietPlan, setDietPlan }) {
  const [prefs, setPrefs] = useState(dietPrefs);
  const [loading, setLoading] = useState(false);
  const [allergyInput, setAllergyInput] = useState("");

  useEffect(() => setPrefs(dietPrefs), [dietPrefs]);

  const update = (patch) => {
    const n = { ...prefs, ...patch };
    setPrefs(n);
    setDietPrefs(n);
  };

  const addAllergy = () => {
    const a = allergyInput.trim();
    if (!a) return;
    update({ allergies: [...(prefs.allergies || []), a] });
    setAllergyInput("");
  };

  const fasting = prefs.mealsPerDay === "0";
  const PlatformLogo = getPlatform(profile.aiPlatform).Logo;

  const generate = async () => {
    setLoading(true);
    try {
      const mealLine = fasting
        ? "Meals per day: 0 — the client is doing a fasting protocol. Build the plan around fasting windows, hydration, electrolytes, and how to structure eating on refeed/non-fasting days."
        : `Meals per day: ${prefs.mealsPerDay}.`;
      const txt = await askClaude([
        {
          role: "user",
          content: `You are a nutrition coach. Build a simple weekly diet plan in plain language.
Client: goal ${profile.goal || "general fitness"}, weight ${profile.weightLb || "?"} lb, trains 6 days/week (push/pull split, optional Hyrox/CrossFit-style conditioning day).
Diet goal: ${prefs.dietGoal}. ${mealLine}
Foods they like: ${prefs.likes || "no preference"}.
Foods to avoid (dislikes): ${prefs.dislikes || "none"}.
Allergies — NEVER include these: ${(prefs.allergies || []).join(", ") || "none"}.
Weekly structure notes: ${prefs.schedule || "standard week"}.
Format: start with a 2-sentence overview including a daily calorie and protein target. Then "TRAINING DAYS" and "REST DAY" sections${fasting ? "" : `, each listing the ${prefs.mealsPerDay} meals with 2 simple food options per meal`}. Plain language, no markdown symbols like # or *, under 350 words.`,
        },
      ], 1500);
      setDietPlan(txt);
    } catch {
      /* built-in engine takes over when external AI is unavailable */
      setDietPlan(localDiet(profile, prefs));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <Card>
        <Eyebrow>Fuel preferences</Eyebrow>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Diet goal">
            <select style={inputStyle} value={prefs.dietGoal} onChange={(e) => update({ dietGoal: e.target.value })}>
              <option>Fat loss (cut)</option>
              <option>Maintain</option>
              <option>Muscle gain (bulk)</option>
              <option>Recomposition</option>
            </select>
          </Field>
          <Field label="Meals per day">
            <select style={inputStyle} value={prefs.mealsPerDay} onChange={(e) => update({ mealsPerDay: e.target.value })}>
              {["0", "1", "2", "3", "4", "5", "6"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        {fasting && (
          <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 8, lineHeight: 1.5, borderLeft: `2px solid ${RED}`, paddingLeft: 10 }}>
            0 meals = fasting protocol. The plan will cover fasting windows, electrolytes, and how to structure your refeed days.
          </p>
        )}
        <div className="mt-3 space-y-3">
          <Field label="Foods you like">
            <input style={inputStyle} placeholder="e.g. chicken, rice, steak, greek yogurt" value={prefs.likes} onChange={(e) => update({ likes: e.target.value })} />
          </Field>
          <Field label="Foods you don't like (we'll filter these out)">
            <input style={inputStyle} placeholder="e.g. fish, mushrooms, cottage cheese" value={prefs.dislikes} onChange={(e) => update({ dislikes: e.target.value })} />
          </Field>
          <Field label="Allergies (strictly excluded)">
            <div className="flex gap-2">
              <input style={inputStyle} placeholder="e.g. peanuts" value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAllergy()} />
              <Btn variant="ghost" onClick={addAllergy}><Plus size={14} /></Btn>
            </div>
            {(prefs.allergies || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {prefs.allergies.map((a, i) => (
                  <span key={i} className="flex items-center gap-1" style={{ ...fontBody, fontSize: 12, color: PAPER, background: SURFACE2, border: `1px solid ${RED}`, borderRadius: 99, padding: "4px 10px" }}>
                    {a}
                    <X size={12} style={{ cursor: "pointer" }} onClick={() => update({ allergies: prefs.allergies.filter((_, j) => j !== i) })} />
                  </span>
                ))}
              </div>
            )}
          </Field>
          <Field label="Weekly schedule notes (optional)">
            <input style={inputStyle} placeholder="e.g. busy weekday lunches, family dinner Sundays" value={prefs.schedule} onChange={(e) => update({ schedule: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4">
          <Btn onClick={generate} disabled={loading}>
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <PlatformLogo s={14} />}
            {loading ? "Building your plan…" : dietPlan ? "Rebuild my plan" : "Build my plan with AI"}
          </Btn>
        </div>
      </Card>

      {dietPlan && (
        <Card>
          <Eyebrow>Your weekly plan</Eyebrow>
          <pre style={{ color: PAPER, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 12, fontFamily: "'Inter', sans-serif" }}>
            {dietPlan}
          </pre>
          <p style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 12, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
            General guidance — always double-check labels for your allergens.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ====================================================================== */
/* TAB 4 — ACCOUNTABILITY (with reminders)                                */
/* ====================================================================== */
const LEADS = ["15 min", "30 min", "1 hour", "1 day", "1 week"];
const LEAD_MS = { "15 min": 15 * 60e3, "30 min": 30 * 60e3, "1 hour": 60 * 60e3, "1 day": 24 * 3600e3, "1 week": 7 * 24 * 3600e3 };

function AccountabilityTab({ commitments, setCommitments }) {
  const [text, setText] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [notifStatus, setNotifStatus] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const add = () => {
    if (!text.trim()) return;
    setCommitments([...commitments, { id: Date.now().toString(), text: text.trim(), checks: [], reminder: null }]);
    setText("");
  };

  const toggle = (id) => {
    setCommitments(commitments.map((c) => {
      if (c.id !== id) return c;
      const has = c.checks.includes(today);
      return { ...c, checks: has ? c.checks.filter((d) => d !== today) : [...c.checks, today] };
    }));
  };

  const streak = (c) => {
    let s = 0;
    const d = new Date();
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (c.checks.includes(key)) { s++; d.setDate(d.getDate() - 1); }
      else if (key === today) { d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  };

  const last7 = (c) => {
    let n = 0;
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      if (c.checks.includes(d.toISOString().slice(0, 10))) n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  };

  const enableNotifs = async () => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") { setNotifStatus("granted"); return true; }
    try {
      const p = await Notification.requestPermission();
      setNotifStatus(p);
      return p === "granted";
    } catch { return false; }
  };

  const setReminder = (id, patch) => {
    setCommitments(commitments.map((c) =>
      c.id === id
        ? { ...c, reminder: { enabled: false, lead: "30 min", dueTime: "18:00", dueDate: "", ...(c.reminder || {}), ...patch } }
        : c
    ));
  };

  const toggleReminder = async (c) => {
    const enabling = !c.reminder?.enabled;
    if (enabling) await enableNotifs();
    setReminder(c.id, { enabled: enabling });
  };

  /* when should this commitment's reminder fire? */
  const triggerFor = (c) => {
    const r = c.reminder;
    if (!r?.enabled) return null;
    const [hh, mm] = (r.dueTime || "18:00").split(":").map(Number);
    let due;
    if (r.lead === "1 day" || r.lead === "1 week") {
      if (!r.dueDate) return null;
      due = new Date(`${r.dueDate}T00:00`);
      if (isNaN(due)) return null;
    } else {
      due = new Date();
    }
    due.setHours(hh, mm, 0, 0);
    return new Date(due.getTime() - LEAD_MS[r.lead]);
  };

  /* reminder loop — checks every 20s while the app is open */
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      let changed = false;
      const updated = commitments.map((c) => {
        const trig = triggerFor(c);
        if (!trig) return c;
        const key = trig.toISOString().slice(0, 16);
        const dayKey = now.toISOString().slice(0, 10);
        const withinWindow = now >= trig && now - trig < 6 * 3600e3;
        if (withinWindow && c.lastNotified !== key && !c.checks.includes(dayKey)) {
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("pd / performance", { body: `Reminder: ${c.text}` });
            }
          } catch {}
          changed = true;
          return { ...c, lastNotified: key };
        }
        return c;
      });
      if (changed) setCommitments(updated);
    }, 20000);
    return () => clearInterval(iv);
  }, [commitments]);

  return (
    <div className="space-y-5">
      <Card>
        <Eyebrow>Make a commitment</Eyebrow>
        <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          Write it down, check it off daily, protect the streak. Turn on reminders so it never slips.
        </p>
        <div className="flex gap-2 mt-3">
          <input style={inputStyle} placeholder="e.g. Hit 150g protein every day" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Btn onClick={add}><Plus size={14} /></Btn>
        </div>
        {notifStatus === "denied" && (
          <p style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 8 }}>
            Notifications are blocked in your browser settings — allow them for this site to get reminders.
          </p>
        )}
      </Card>

      {commitments.length === 0 ? (
        <Card>
          <p style={{ ...fontBody, color: MUTED, fontSize: 13 }}>No commitments yet. Add your first one above — start with something you can do every single day.</p>
        </Card>
      ) : (
        commitments.map((c) => {
          const done = c.checks.includes(today);
          const rOn = c.reminder?.enabled;
          const r = c.reminder || { lead: "30 min", dueTime: "18:00", dueDate: "" };
          const needsDate = r.lead === "1 day" || r.lead === "1 week";
          return (
            <Card key={c.id} style={{ borderColor: done ? RED : LINE }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3" style={{ flex: 1 }}>
                  <button onClick={() => toggle(c.id)}
                    style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: done ? RED : "transparent", border: `2px solid ${done ? RED : MUTED}`,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    {done && <Check size={14} color={PAPER} />}
                  </button>
                  <span style={{ ...fontBody, color: PAPER, fontSize: 14 }}>{c.text}</span>
                </div>
                <button onClick={() => setCommitments(commitments.filter((x) => x.id !== c.id))} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={14} color={MUTED} />
                </button>
              </div>
              <div className="flex items-center gap-4 mt-3" style={{ paddingLeft: 38 }}>
                <span className="flex items-center gap-1" style={{ ...fontMono, color: RED, fontSize: 12 }}>
                  <Flame size={13} /> {streak(c)} day streak
                </span>
                <span style={{ ...fontMono, color: MUTED, fontSize: 12 }}>{last7(c)}/7 this week</span>
              </div>

              {/* reminder controls */}
              <div style={{ paddingLeft: 38, marginTop: 10 }}>
                <button onClick={() => toggleReminder(c)} className="flex items-center gap-2"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <div style={{
                    width: 36, height: 20, borderRadius: 99, position: "relative", transition: "background .15s",
                    background: rOn ? RED : SURFACE2, border: `1px solid ${rOn ? RED : LINE}`,
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 99, background: PAPER, position: "absolute", top: 2,
                      left: rOn ? 18 : 2, transition: "left .15s",
                    }} />
                  </div>
                  <Bell size={13} color={rOn ? RED : MUTED} />
                  <span style={{ ...fontBody, color: rOn ? PAPER : MUTED, fontSize: 12 }}>
                    {rOn ? "Reminders on" : "Remind me"}
                  </span>
                </button>

                {rOn && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2 flex-wrap items-center">
                      <select style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 12 }}
                        value={r.lead} onChange={(e) => setReminder(c.id, { lead: e.target.value })}>
                        {LEADS.map((l) => <option key={l}>{l}</option>)}
                      </select>
                      <span style={{ ...fontBody, color: MUTED, fontSize: 12 }}>before</span>
                      <input type="time" style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 12 }}
                        value={r.dueTime} onChange={(e) => setReminder(c.id, { dueTime: e.target.value })} />
                      {needsDate && (
                        <input type="date" style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 12 }}
                          value={r.dueDate} onChange={(e) => setReminder(c.id, { dueDate: e.target.value })} />
                      )}
                    </div>
                    <p style={{ ...fontBody, color: MUTED, fontSize: 11 }}>
                      {needsDate
                        ? `You'll get a heads-up ${r.lead} before the deadline you set.`
                        : `You'll get a nudge ${r.lead} before ${r.dueTime} each day it's unchecked.`}
                      {" "}Reminders fire while the app is open in your browser.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

/* ====================================================================== */
/* TAB 5 — GROUPS (community feed)                                        */
/* ====================================================================== */
const POST_TAGS = ["Goal", "Progress", "Meal", "Workout", "Thought"];

function GroupsTab({ profile, posts, setPosts }) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("Goal");
  const [photo, setPhoto] = useState(null);

  const publish = () => {
    if (!text.trim() && !photo) return;
    const post = {
      id: Date.now().toString(),
      author: profile.name?.trim() || "Anonymous athlete",
      tag,
      text: text.trim(),
      photo,
      likes: 0,
      date: new Date().toISOString(),
    };
    setPosts([post, ...posts].slice(0, 40)); // keep feed bounded for storage limits
    setText("");
    setPhoto(null);
  };

  const like = (id) => setPosts(posts.map((p) => (p.id === id ? { ...p, likes: (p.likes || 0) + 1 } : p)));

  const ago = (iso) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="space-y-5">
      <Card>
        <Eyebrow>Post to the group</Eyebrow>
        <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 6 }}>
          Visible to everyone in the program — goals, progress, meals, workout clips.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {POST_TAGS.map((t) => (
            <button key={t} onClick={() => setTag(t)}
              style={{
                ...fontDisplay, fontSize: 11, letterSpacing: "0.12em", padding: "5px 12px", borderRadius: 99, cursor: "pointer",
                background: tag === t ? RED : "transparent", color: tag === t ? PAPER : MUTED, border: `1px solid ${tag === t ? RED : LINE}`,
              }} className="uppercase">
              {t}
            </button>
          ))}
        </div>
        <textarea
          style={{ ...inputStyle, marginTop: 12, minHeight: 70, resize: "vertical" }}
          placeholder={tag === "Goal" ? "This month I'm committing to…" : tag === "Meal" ? "Tonight's high-protein dinner…" : "Share it with the group…"}
          value={text} onChange={(e) => setText(e.target.value)}
        />
        {photo && (
          <div className="mt-2 relative inline-block">
            <img src={photo} alt="Post preview" style={{ maxHeight: 120, borderRadius: 10, border: `1px solid ${LINE}` }} />
            <button onClick={() => setPhoto(null)}
              style={{ position: "absolute", top: -6, right: -6, background: RED, border: "none", borderRadius: 99, width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={11} color={PAPER} />
            </button>
          </div>
        )}
        <div className="flex gap-3 mt-3">
          <PhotoPick label="Photo" icon={ImagePlus} onPick={setPhoto} />
          <Btn onClick={publish} style={{ flex: 1, justifyContent: "center" }}>Post it</Btn>
        </div>
      </Card>

      {posts.length === 0 ? (
        <Card>
          <p style={{ ...fontBody, color: MUTED, fontSize: 13 }}>
            Nothing here yet. Be the first — post your goal for the month and set the tone.
          </p>
        </Card>
      ) : (
        posts.map((p) => (
          <Card key={p.id} style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 10px" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div style={{
                    width: 32, height: 32, borderRadius: 99, background: SURFACE2, border: `1px solid ${LINE}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    ...fontDisplay, color: RED, fontSize: 14,
                  }}>
                    {(p.author || "A")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{p.author}</div>
                    <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{ago(p.date)}</div>
                  </div>
                </div>
                <span style={{ ...fontDisplay, color: RED, fontSize: 10, letterSpacing: "0.15em", border: `1px solid ${LINE}`, borderRadius: 99, padding: "3px 10px" }} className="uppercase">
                  {p.tag}
                </span>
              </div>
              {p.text && <p style={{ ...fontBody, color: PAPER, fontSize: 14, lineHeight: 1.55, marginTop: 10, whiteSpace: "pre-wrap" }}>{p.text}</p>}
            </div>
            {p.photo && <img src={p.photo} alt={`${p.tag} post by ${p.author}`} style={{ width: "100%", display: "block", maxHeight: 360, objectFit: "cover" }} />}
            <div className="flex items-center gap-2" style={{ padding: "10px 16px", borderTop: `1px solid ${LINE}` }}>
              <button onClick={() => like(p.id)} className="flex items-center gap-1"
                style={{ background: "none", border: "none", cursor: "pointer", ...fontMono, color: p.likes > 0 ? RED : MUTED, fontSize: 13 }}>
                <Heart size={15} fill={p.likes > 0 ? RED : "none"} color={p.likes > 0 ? RED : MUTED} /> {p.likes || 0}
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

/* ====================================================================== */
/* TAB 6 — AI COACH                                                       */
/* ====================================================================== */
function CoachTab({ profile, dietPrefs, plan }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const context = `You are the in-app AI coach for a personal training program. The default program is a 6-day split: Mon legs (optional Hyrox/CrossFit-style circuit: 4 rounds of 0.7mi run + station — sled push 8x45lb plates 2 lengths, sled pull 5 plates 2 lengths, burpees 3.5 distances, lunges 70lb 4 distances), Tue chest/biceps, Wed back/triceps, Thu light legs/shoulders, Fri chest/biceps, Sat back/triceps, Sun rest. Clients can also build a custom split without the Hyrox day.
Client profile: ${JSON.stringify(profile)}. Diet prefs: ${JSON.stringify(dietPrefs)}. Plan: ${plan?.id || "none yet"}.
Answer questions and give recommendations tied to their goals. Be direct, encouraging, plain language, no markdown formatting, keep answers under 150 words unless asked for detail. For medical issues, recommend a professional.`;
      const apiMsgs = [
        { role: "user", content: context },
        { role: "assistant", content: "Understood. I'm ready to coach." },
        ...next,
      ];
      const txt = await askClaude(apiMsgs, 800);
      setMsgs([...next, { role: "assistant", content: txt }]);
    } catch {
      /* built-in engine takes over when external AI is unavailable */
      setMsgs([...next, { role: "assistant", content: localCoach(q, profile, dietPrefs) }]);
    }
    setLoading(false);
  };

  const starters = ["How do I pace the Hyrox runs?", "What should I eat before Monday legs?", "I can only train 4 days this week — what do I cut?"];

  return (
    <div className="flex flex-col" style={{ height: "100%", minHeight: 0 }}>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {msgs.length === 0 && (
          <Card>
            <Eyebrow>Ask your AI coach</Eyebrow>
            <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
              I know your split, your goals, and your diet preferences. Ask me anything.
            </p>
            <div className="flex flex-col gap-2 mt-3">
              {starters.map((s) => (
                <button key={s} onClick={() => setInput(s)} className="text-left"
                  style={{ ...fontBody, color: PAPER, fontSize: 13, background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div style={{
              maxWidth: "85%", padding: "10px 14px", borderRadius: 14,
              background: m.role === "user" ? RED : SURFACE,
              border: m.role === "user" ? "none" : `1px solid ${LINE}`,
              ...fontBody, color: PAPER, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ ...fontMono, color: MUTED, fontSize: 12 }} className="flex items-center gap-2">
            <RefreshCw size={12} className="animate-spin" /> coach is typing…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 pt-3">
        <input style={inputStyle} placeholder="Ask about training, food, recovery…" value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <Btn onClick={send} disabled={loading}>Send</Btn>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* TRAINER SETTINGS MODAL                                                 */
/* ====================================================================== */
function TrainerPanel({ trainerCfg, setTrainerCfg, onClose, bookings }) {
  const [venmo, setVenmo] = useState(trainerCfg.venmo || "");
  const [stripe, setStripe] = useState(trainerCfg.stripe || "");
  const [calendar, setCalendar] = useState(trainerCfg.calendar || "");
  const [pin, setPin] = useState("");
  const weekAgo = Date.now() - 7 * 24 * 3600e3;
  const thisWeek = (bookings || []).filter((b) => new Date(b.date).getTime() >= weekAgo);
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", zIndex: 60 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: SURFACE, borderTop: `2px solid ${RED}`, borderRadius: "18px 18px 0 0", padding: 20, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
        <Eyebrow>Trainer settings</Eyebrow>
        <div className="space-y-3 mt-4">
          <Field label="Your Venmo username (clients pay you here)">
            <input style={inputStyle} placeholder="e.g. payton-trainer" value={venmo} onChange={(e) => setVenmo(e.target.value)} />
          </Field>
          <Field label="Stripe payment link (optional — from your Stripe dashboard)">
            <input style={inputStyle} placeholder="https://buy.stripe.com/…" value={stripe} onChange={(e) => setStripe(e.target.value)} />
          </Field>
          <Field label="Booking calendar link (Calendly, Google appointments, etc.)">
            <input style={inputStyle} placeholder="https://calendly.com/…" value={calendar} onChange={(e) => setCalendar(e.target.value)} />
          </Field>
          <Field label="Change trainer PIN (optional)">
            <input style={inputStyle} placeholder="New 4-digit PIN" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" />
          </Field>
        </div>

        <div className="mt-5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
          <Eyebrow>On your schedule this week</Eyebrow>
          {thisWeek.length === 0 ? (
            <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 8 }}>No in-person sessions booked in the last 7 days.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {thisWeek.map((b) => (
                <div key={b.id} className="flex items-center justify-between" style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} color={RED} />
                    <span style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{b.name}</span>
                  </div>
                  <span style={{ ...fontMono, color: MUTED, fontSize: 11 }}>
                    {new Date(b.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <Btn onClick={() => { setTrainerCfg({ ...trainerCfg, venmo: venmo.trim(), stripe: stripe.trim(), calendar: calendar.trim(), ...(pin.trim() ? { pin: pin.trim() } : {}) }); onClose(); }}>
            Save settings
          </Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* SITE PAGES — About / FAQ / Pricing                                     */
/* ====================================================================== */
const FaqItem = ({ q, a }) => (
  <details style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
    <summary style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{q}</summary>
    <p style={{ ...fontBody, color: MUTED, fontSize: 13, lineHeight: 1.65, marginTop: 8, marginBottom: 0 }}>{a}</p>
  </details>
);

function AboutPage({ onStart }) {
  const bullets = [
    ["The program", "A push/pull muscle-building split you can run 3 to 6 days a week, with an optional Hyrox/CrossFit-style conditioning day for people who want an engine, not just a physique."],
    ["The app", "Custom split builder, personalized diet plans built around foods you actually eat, weigh-in and photo tracking, daily commitments with streaks, and a private group feed."],
    ["The coaching", "Your trainer posts video demos, reviews your progress, and is available for weekly one-on-one in-person sessions on any plan."],
    ["The AI", "A built-in coaching engine answers questions and builds your split and diet instantly — and you can connect your favorite AI platform (ChatGPT, Claude, Gemini, and more) for deeper dives."],
  ];
  return (
    <div className="space-y-5">
      <Card>
        <Eyebrow>About PD Performance</Eyebrow>
        <p style={{ ...fontBody, color: PAPER, fontSize: 15, lineHeight: 1.7, marginTop: 12 }}>
          PD Performance is an online personal training program built on one idea: consistency beats complexity. No gimmicks, no 45-supplement stacks — a proven training split, food you'll actually eat, and accountability that keeps you showing up.
        </p>
        <p style={{ ...fontBody, color: MUTED, fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>
          Whether your goal is fat loss, building muscle, recomposition, or Hyrox/CrossFit and endurance performance, the program meets you where you are and scales with you.
        </p>
      </Card>
      <Card>
        <Eyebrow>How it works</Eyebrow>
        <div className="mt-3 space-y-3">
          {bullets.map(([t, d]) => (
            <div key={t}>
              <div style={{ ...fontDisplay, color: PAPER, fontSize: 13, letterSpacing: "0.08em" }} className="uppercase">{t}</div>
              <p style={{ ...fontBody, color: MUTED, fontSize: 13, lineHeight: 1.6, marginTop: 4, marginBottom: 0 }}>{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <Btn onClick={onStart}>Start in the app <ChevronRight size={14} /></Btn>
        </div>
      </Card>
    </div>
  );
}

function FaqPage({ onStart }) {
  return (
    <div className="space-y-5">
      <Card>
        <Eyebrow>FAQ · Training & health basics</Eyebrow>
        <p style={{ ...fontBody, color: MUTED, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
          Straight answers to the questions everyone asks — no fads, no bro-science.
        </p>
        <div className="mt-3 space-y-2">
          {INDUSTRY_FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </Card>
      <Card>
        <Eyebrow>FAQ · The program</Eyebrow>
        <div className="mt-3 space-y-2">
          {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
        <div className="mt-5">
          <Btn onClick={onStart}>Join the program <ChevronRight size={14} /></Btn>
        </div>
      </Card>
      <p style={{ ...fontBody, color: MUTED, fontSize: 11, lineHeight: 1.6 }}>
        This page is general education, not medical advice. Check with a healthcare professional before starting a new training or nutrition program, especially with existing conditions or injuries.
      </p>
    </div>
  );
}

function PricingPage({ onStart }) {
  return (
    <div className="space-y-5">
      <Card>
        <Eyebrow>Pricing</Eyebrow>
        <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          Commit longer, pay less per month. Every plan includes the full app, custom programming, and diet planning.
        </p>
        <div className="space-y-3 mt-4">
          {PLANS.map((p) => (
            <div key={p.id} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 14 }}>
              <div className="flex items-start justify-between">
                <div>
                  <div style={{ ...fontDisplay, color: PAPER, fontSize: 18, letterSpacing: "0.05em" }} className="uppercase">{p.name}</div>
                  <div style={{ ...fontBody, color: MUTED, fontSize: 12 }}>{p.sub}</div>
                </div>
                <div className="text-right">
                  <div style={{ ...fontMono, color: RED, fontSize: 22 }}>${p.price}</div>
                  <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{p.per}</div>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2" style={{ ...fontBody, color: MUTED, fontSize: 12 }}>
                    <Check size={12} color={RED} /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4" style={{ border: `1px dashed ${LINE}`, borderRadius: 12, padding: 14 }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{ADDON.name}</div>
              <div style={{ ...fontBody, color: MUTED, fontSize: 12 }}>{ADDON.note}</div>
            </div>
            <div style={{ ...fontMono, color: PAPER, fontSize: 16 }}>+${ADDON.price}/mo</div>
          </div>
        </div>
        <div className="mt-5">
          <Btn onClick={onStart}>Choose your plan in the app <ChevronRight size={14} /></Btn>
        </div>
      </Card>
    </div>
  );
}

/* ====================================================================== */
/* APP SHELL                                                              */
/* ====================================================================== */
export default function App() {
  const [tab, setTab] = useState("profile");
  const [page, setPage] = useState("home");
  const [loaded, setLoaded] = useState(false);

  const [profile, setProfileState] = useState({ name: "", age: "", heightIn: "", weightLb: "", goal: "", addon: false, aiPlatform: "chatgpt" });
  const [plan, setPlanState] = useState(null);
  const [dietPrefs, setDietPrefsState] = useState({ dietGoal: "Fat loss (cut)", mealsPerDay: "4", likes: "", dislikes: "", allergies: [], schedule: "" });
  const [dietPlan, setDietPlanState] = useState("");
  const [commitments, setCommitmentsState] = useState([]);
  const [videos, setVideosState] = useState([]);
  const [customSplit, setCustomSplitState] = useState(null);
  const [progress, setProgressState] = useState([]);
  const [posts, setPostsState] = useState([]);
  const [bookings, setBookingsState] = useState([]);
  const [trainerCfg, setTrainerCfgState] = useState({ venmo: "", stripe: "", pin: "", calendar: "" });
  const [trainerMode, setTrainerMode] = useState(false);
  const [showTrainerPanel, setShowTrainerPanel] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [theme, setThemeState] = useState("dark");

  useEffect(() => {
    (async () => {
      const [p, pl, dp, dpl, cm, vd, cs, pg, ps, tc, bk, th] = await Promise.all([
        sget("pt:profile"), sget("pt:plan"), sget("pt:diet-prefs"), sget("pt:diet-plan"),
        sget("pt:commitments"), sget("pt:videos", true), sget("pt:custom-split"),
        sget("pt:progress"), sget("pt:group-posts", true), sget("pt:trainer-cfg", true),
        sget("pt:bookings", true), sget("pt:theme"),
      ]);
      if (p) setProfileState(p);
      if (pl) setPlanState(pl);
      if (dp) setDietPrefsState(dp);
      if (dpl) setDietPlanState(dpl);
      if (cm) setCommitmentsState(cm);
      if (vd) setVideosState(vd);
      if (cs) setCustomSplitState(cs);
      if (pg) setProgressState(pg);
      if (ps) setPostsState(ps);
      if (tc) setTrainerCfgState(tc);
      if (bk) setBookingsState(bk);
      if (th) setThemeState(th);
      setLoaded(true);
    })();
  }, []);

  const setProfile = (v) => { setProfileState(v); sset("pt:profile", v); };
  const setPlan = (v) => { setPlanState(v); sset("pt:plan", v); };
  const setDietPrefs = (v) => { setDietPrefsState(v); sset("pt:diet-prefs", v); };
  const setDietPlan = (v) => { setDietPlanState(v); sset("pt:diet-plan", v); };
  const setCommitments = (v) => { setCommitmentsState(v); sset("pt:commitments", v); };
  const setVideos = (v) => { setVideosState(v); sset("pt:videos", v, true); };
  const setCustomSplit = (v) => { setCustomSplitState(v); sset("pt:custom-split", v); };
  const setProgress = (v) => { setProgressState(v); sset("pt:progress", v); };
  const setPosts = (v) => { setPostsState(v); sset("pt:group-posts", v, true); };
  const setBookings = (v) => { setBookingsState(v); sset("pt:bookings", v, true); };
  const setTrainerCfg = (v) => { setTrainerCfgState(v); sset("pt:trainer-cfg", v, true); };
  const setTheme = (v) => { setThemeState(v); sset("pt:theme", v); };

  /* declare color-scheme so browsers with forced/auto dark mode don't re-invert the light theme */
  useEffect(() => {
    try {
      document.documentElement.style.colorScheme = theme === "light" ? "only light" : "dark";
      document.body.style.background = theme === "light" ? "#F5F5F4" : "#0A0A0B";
    } catch {}
  }, [theme]);

  const addBooking = (b) => setBookings([b, ...bookings].slice(0, 50));

  /* SEO / GEO: document head metadata + structured data */
  useEffect(() => {
    document.documentElement.lang = "en";
    document.title = "PD Performance | Online Personal Training, Hyrox Workouts & Custom Diet Plans";
    const ensure = (attr, key, content) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    ensure("name", "description", SEO_DESC);
    ensure("name", "keywords", "online personal training, personal trainer, Hyrox training program, custom workout plan, custom diet plan, body recomposition, muscle building, fat loss coaching, AI fitness coach, accountability coaching");
    ensure("name", "robots", "index, follow");
    ensure("property", "og:title", "PD Performance — Online Personal Training");
    ensure("property", "og:description", SEO_DESC);
    ensure("property", "og:type", "website");
    let ld = document.getElementById("pd-jsonld");
    if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "pd-jsonld"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebApplication",
          name: "PD Performance",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web",
          description: SEO_DESC,
          offers: PLANS.map((p) => ({ "@type": "Offer", name: `${p.name} — ${p.sub}`, price: String(p.price), priceCurrency: "USD" })),
        },
        {
          "@type": "FAQPage",
          mainEntity: [...INDUSTRY_FAQS, ...FAQS].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        },
      ],
    });
  }, []);

  const addVideo = (v) => setVideos([...videos, v]);
  const removeVideo = (id) => setVideos(videos.filter((x) => x.id !== id));

  const aiPlatform = getPlatform(profile.aiPlatform);
  const AiLogo = aiPlatform.Logo;

  const toggleTrainer = () => {
    if (trainerMode) { setTrainerMode(false); return; }
    const stored = trainerCfg.pin;
    if (!stored) {
      const newPin = prompt("Set a trainer PIN (first-time setup). Clients won't see upload controls without it:");
      if (newPin && newPin.trim()) {
        setTrainerCfg({ ...trainerCfg, pin: newPin.trim() });
        setTrainerMode(true);
        setShowTrainerPanel(true);
      }
    } else {
      const entered = prompt("Enter trainer PIN:");
      if (entered === stored) setTrainerMode(true);
      else if (entered !== null) alert("Wrong PIN.");
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "train", label: "Train", icon: Dumbbell },
    { id: "fuel", label: "Fuel", icon: Utensils },
    { id: "track", label: "Track", icon: CheckSquare },
    { id: "groups", label: "Groups", icon: Users },
  ];

  return (
    <div className={theme === "light" ? "pd-light" : "pd-dark"} style={{ background: INK, minHeight: "100vh", ...fontBody }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        /* dark palette — light is its exact RGB inversion (red accent stays) */
        .pd-dark {
          --ink:#0A0A0B; --surface:#141416; --surface2:#1B1B1E; --line:#26262B;
          --paper:#F5F5F2; --muted:#8B8B94; --red:#D90429;
          --ink-glass:rgba(10,10,11,0.95); --ink-glass2:rgba(10,10,11,0.96);
        }
        .pd-light {
          --ink:#F5F5F4; --surface:#EBEBE9; --surface2:#E4E4E1; --line:#D9D9D4;
          --paper:#0A0A0D; --muted:#74746B; --red:#D90429;
          --ink-glass:rgba(245,245,244,0.95); --ink-glass2:rgba(245,245,244,0.96);
        }
        * { box-sizing: border-box; }
        ::selection { background: ${RED}; color: ${PAPER}; }
        select option { background: ${SURFACE2}; }
        input:focus, select:focus, textarea:focus { border-color: ${RED} !important; }
        button:focus-visible, input:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      {/* header */}
      <header className="sticky top-0" style={{ background: "var(--ink-glass)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${LINE}`, zIndex: 50 }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h1 className="flex items-baseline gap-2" style={{ margin: 0 }} aria-label="PD Performance — online personal training">
          <span style={{ ...fontDisplay, color: PAPER, fontSize: 22, fontWeight: 700, letterSpacing: "0.04em", textTransform: "lowercase" }}>pd</span>
          <span style={{ color: RED, fontWeight: 700, fontSize: 20, transform: "skewX(-12deg)", display: "inline-block" }} aria-hidden="true">/</span>
          <span style={{ ...fontDisplay, color: PAPER, fontSize: 20, fontWeight: 500, letterSpacing: "0.18em" }}>PERFORMANCE</span>
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{ background: "transparent", border: `1px solid ${LINE}`, borderRadius: 8, padding: "5px 7px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            {theme === "dark" ? <Sun size={13} color={MUTED} /> : <Moon size={13} color={MUTED} />}
          </button>
          <button onClick={() => setShowCoach(true)} className="flex items-center gap-1" title="Built-in AI coach" aria-label="Open the built-in AI coach"
            style={{ background: RED, border: `1px solid ${RED}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
            <MessageCircle size={13} color={PAPER} />
            <span style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.12em", color: PAPER }} className="uppercase">Coach</span>
          </button>
          <button onClick={() => window.open(aiPlatform.url, "_blank")} className="flex items-center gap-1"
            title={aiPlatform.id === "chatgpt" ? 'Opens ChatGPT — "pd performance" folder' : `Ask ${aiPlatform.name}`}
            aria-label={`Open your AI assistant (${aiPlatform.name})`}
            style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
            <AiLogo s={13} />
            <span style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.12em", color: PAPER }} className="uppercase">AI</span>
          </button>
          {trainerMode && (
            <button onClick={() => setShowTrainerPanel(true)} style={{ background: "none", border: "none", cursor: "pointer" }} title="Trainer settings">
              <Settings size={17} color={RED} />
            </button>
          )}
          <button onClick={toggleTrainer} className="flex items-center gap-1" title={trainerMode ? "Exit trainer mode" : "Trainer sign-in"}
            style={{ background: trainerMode ? RED : "transparent", border: `1px solid ${trainerMode ? RED : LINE}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer" }}>
            {trainerMode ? <Unlock size={13} color={PAPER} /> : <Lock size={13} color={MUTED} />}
            <span style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.12em", color: trainerMode ? PAPER : MUTED }} className="uppercase">
              Trainer
            </span>
          </button>
        </div>
      </div>

      {/* site navigation */}
      <nav aria-label="Site" className="flex gap-5 px-5 pb-2">
        {[["home", "Home"], ["about", "About"], ["faq", "FAQ"], ["pricing", "Pricing"]].map(([id, label]) => (
          <button key={id} onClick={() => setPage(id)}
            style={{
              ...fontDisplay, fontSize: 11, letterSpacing: "0.14em", background: "none", border: "none", cursor: "pointer",
              padding: "4px 0", color: page === id ? RED : MUTED,
              borderBottom: `2px solid ${page === id ? RED : "transparent"}`,
            }} className="uppercase">
            {label}
          </button>
        ))}
      </nav>
      </header>

      {/* content */}
      <main className="px-4 pt-5 mx-auto" style={{ maxWidth: 640, paddingBottom: 96 }}>
        {!loaded ? (
          <div className="flex items-center gap-2 justify-center pt-16" style={{ ...fontMono, color: MUTED, fontSize: 13 }}>
            <RefreshCw size={14} className="animate-spin" /> loading…
          </div>
        ) : page !== "home" ? (
          <>
            {page === "about" && <AboutPage onStart={() => { setPage("home"); setTab("profile"); }} />}
            {page === "faq" && <FaqPage onStart={() => { setPage("home"); setTab("profile"); }} />}
            {page === "pricing" && <PricingPage onStart={() => { setPage("home"); setTab("profile"); }} />}
          </>
        ) : (
          <>
            {tab === "profile" && (
              <ProfileTab profile={profile} setProfile={setProfile} plan={plan} setPlan={setPlan}
                trainerCfg={trainerCfg} progress={progress} setProgress={setProgress} addBooking={addBooking} />
            )}
            {tab === "train" && (
              <WorkoutsTab trainerMode={trainerMode} videos={videos} addVideo={addVideo} removeVideo={removeVideo}
                customSplit={customSplit} setCustomSplit={setCustomSplit} profile={profile} />
            )}
            {tab === "fuel" && <DietTab profile={profile} dietPrefs={dietPrefs} setDietPrefs={setDietPrefs} dietPlan={dietPlan} setDietPlan={setDietPlan} />}
            {tab === "track" && <AccountabilityTab commitments={commitments} setCommitments={setCommitments} />}
            {tab === "groups" && <GroupsTab profile={profile} posts={posts} setPosts={setPosts} />}

            {/* SEO / GEO footer — profile tab only */}
            {tab === "profile" && (
              <footer style={{ marginTop: 36, borderTop: `1px solid ${LINE}`, paddingTop: 18 }}>
                <p style={{ ...fontBody, color: MUTED, fontSize: 12, lineHeight: 1.6, marginTop: 0 }}>
                  {SEO_DESC}
                </p>
                <div className="mt-3 space-y-2">
                  {FAQS.map((f) => (
                    <details key={f.q} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
                      <summary style={{ ...fontBody, color: PAPER, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{f.q}</summary>
                      <p style={{ ...fontBody, color: MUTED, fontSize: 12, lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>{f.a}</p>
                    </details>
                  ))}
                </div>
                <p style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 14 }}>
                  PD Performance · Online personal training, optional Hyrox/CrossFit-style conditioning, custom workout splits & diet plans
                </p>
              </footer>
            )}
          </>
        )}
      </main>

      {/* bottom nav — app tabs, home page only */}
      {page === "home" && (
      <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 flex justify-center" style={{ background: "var(--ink-glass2)", backdropFilter: "blur(10px)", borderTop: `1px solid ${LINE}`, zIndex: 50 }}>
        <div className="flex w-full" style={{ maxWidth: 640 }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex flex-col items-center gap-1 py-3"
                style={{ background: "none", border: "none", cursor: "pointer", borderTop: `2px solid ${active ? RED : "transparent"}` }}>
                <Icon size={18} color={active ? RED : MUTED} />
                <span style={{ ...fontDisplay, fontSize: 8.5, letterSpacing: "0.14em", color: active ? PAPER : MUTED }} className="uppercase">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      )}

      {/* AI coach overlay */}
      {showCoach && (
        <div className="fixed inset-0 flex flex-col" style={{ background: INK, zIndex: 70 }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div className="flex items-center gap-2">
              <MessageCircle size={16} color={RED} />
              <span style={{ ...fontDisplay, color: PAPER, fontSize: 16, letterSpacing: "0.12em" }} className="uppercase">AI Coach</span>
            </div>
            <button onClick={() => setShowCoach(false)} style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 8, padding: 6, cursor: "pointer" }}>
              <X size={16} color={PAPER} />
            </button>
          </div>
          <div className="flex-1 px-4 py-4 mx-auto w-full" style={{ maxWidth: 640, minHeight: 0 }}>
            <CoachTab profile={profile} dietPrefs={dietPrefs} plan={plan} />
          </div>
        </div>
      )}

      {showTrainerPanel && <TrainerPanel trainerCfg={trainerCfg} setTrainerCfg={setTrainerCfg} onClose={() => setShowTrainerPanel(false)} bookings={bookings} />}
    </div>
  );
}
