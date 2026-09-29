import React, { useState, useEffect, useRef } from "react";
import {
  User, Dumbbell, Utensils, CheckSquare, MessageCircle, Lock, Unlock,
  Play, Plus, Trash2, ChevronRight, Flame, Sparkles, CreditCard, Users,
  RefreshCw, Check, X, Video, Settings, Camera, Heart, ImagePlus, Scale, Bell, CalendarDays,
  Sun, Moon, Link2, Download
} from "lucide-react";
import { jsPDF } from "jspdf";

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

/* ---------- faint body outlines shown inside empty photo slots ---------- */
const BodyOutline = ({ view }) => (
  <svg viewBox="0 0 100 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true"
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.13, pointerEvents: "none" }}>
    {view === "side" ? (
      <path fill={PAPER} d="M54 6c7 0 12 5 12 13 0 5-2 9-5 11l-1 4c7 4 10 10 10 18l-1 28c0 10-3 20-4 30l-2 40c0 20 1 35 1 48h-9v-46l-1-22-1 22v46h-9c0-13 1-28 1-48l-2-40c-1-10-4-20-4-30l-1-28c0-8 3-14 10-18l-1-4c-3-2-5-6-5-11 0-8 5-13 12-13z" />
    ) : (
      <path fill={PAPER} d="M50 6c7 0 12 5 12 13 0 5-2 9-5 11v4c11 3 18 8 19 18l2 26c0 6-4 8-7 6l-3-22-1 28c0 6-2 12-2 20l-2 40c0 20 1 35 1 48h-8c0-13-1-28-2-46l-4-32-4 32c-1 18-2 33-2 46h-8c0-13 1-28 1-48l-2-40c0-8-2-14-2-20l-1-28-3 22c-3 2-7 0-7-6l2-26c1-10 8-15 19-18v-4c-3-2-5-6-5-11 0-8 5-13 12-13z" />
    )}
  </svg>
);

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
      ["Hyrox + Shoulders", "Two run+station rounds, then strict delt work"],
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
  const parts = [`Your BMI comes out to ${bmi.toFixed(1)} at ${Math.floor(h / 12)}'${Math.round(h % 12)}\" and ${w} lb — the ${cat.toLowerCase()}.`];
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
  { run: "0.7 mi", station: "Lunges", detail: "70 lb EZ bar or two 35 lb dumbbells · 4 distances" },
];

const SPLIT = [
  {
    day: "Monday", focus: "Legs", tag: "HYROX / CROSSFIT", hyrox: true,
    exercises: [
      { name: "Box jumps or standing long jumps", sets: 4, reps: "3–5", note: "do these first — explosive, land quiet, full recovery" },
      { name: "Back squat or split squat", sets: 4, reps: "6–10", note: "after the circuit" },
      { name: "Hamstring curl machine", sets: 3, reps: "10–12", note: "superset with calf machine" },
      { name: "Calf machine", sets: 3, reps: "12–15", note: "superset with hamstring curls" },
    ],
  },
  {
    day: "Tuesday", focus: "Chest & Biceps", tag: "PUSH + ARMS",
    exercises: [
      { name: "Incline dumbbell press", sets: 4, reps: "8–12", note: "first exercise — solo, no superset" },
      { name: "Flat barbell bench press", sets: 4, reps: "6–10", note: "superset with barbell curl" },
      { name: "Barbell curl", sets: 4, reps: "8–12", note: "superset with flat bench" },
      { name: "Cable fly", sets: 3, reps: "12–15", note: "superset with hammer curl · slow negatives" },
      { name: "Hammer curl", sets: 3, reps: "10–12", note: "superset with cable fly" },
    ],
  },
  {
    day: "Wednesday", focus: "Back & Triceps", tag: "PULL + ARMS",
    exercises: [
      { name: "Lat pulldown", sets: 4, reps: "8–12", note: "first exercise — solo, no superset" },
      { name: "Barbell row", sets: 4, reps: "6–10", note: "superset with rope pushdown · flat back" },
      { name: "Rope pushdown", sets: 4, reps: "10–15", note: "superset with barbell row" },
      { name: "Seated cable row", sets: 3, reps: "10–12", note: "superset with dips · squeeze 1 sec" },
      { name: "Dips", sets: 3, reps: "8–12", note: "superset with cable row · bodyweight or assisted" },
    ],
  },
  {
    day: "Thursday", focus: "Hyrox + Shoulders", tag: "ENGINE + DELTS",
    exercises: [
      { name: "Hyrox station 1", sets: 1, reps: "round", note: "0.7 mile run + sled push" },
      { name: "Hyrox station 2", sets: 1, reps: "round", note: "0.7 mile run + 100 wall balls — break them up as needed" },
      { name: "Military press", sets: 4, reps: "8–12", note: "strict, full lockout" },
      { name: "Rear delt fly", sets: 4, reps: "8–12", note: "cables or fly machine" },
      { name: "Lateral raise", sets: 4, reps: "8–12", note: "light weight, strict form" },
    ],
  },
  {
    day: "Friday", focus: "Chest & Biceps", tag: "PUSH + ARMS",
    exercises: [
      { name: "Flat dumbbell press", sets: 4, reps: "8–12", note: "first exercise — solo, no superset" },
      { name: "Incline barbell press", sets: 4, reps: "6–10", note: "superset with EZ bar curl" },
      { name: "EZ bar curl", sets: 4, reps: "8–12", note: "superset with incline press" },
      { name: "Pec deck or dumbbell fly", sets: 3, reps: "12–15", note: "superset with cable curl · stretch focus" },
      { name: "Cable curl", sets: 3, reps: "12–15", note: "superset with pec deck · constant tension" },
    ],
  },
  {
    day: "Saturday", focus: "Back & Triceps", tag: "PULL + ARMS",
    exercises: [
      { name: "Pull-ups", sets: 4, reps: "6–10", note: "first exercise — solo · weighted or assisted" },
      { name: "T-bar or chest-supported row", sets: 4, reps: "8–12", note: "superset with cable tricep extensions" },
      { name: "Cable tricep extensions", sets: 4, reps: "8–10", note: "superset with T-bar row" },
      { name: "Straight-arm pulldown", sets: 3, reps: "12–15", note: "superset with skull crushers · lats only" },
      { name: "Skull crushers", sets: 3, reps: "10–12", note: "superset with straight-arm pulldown · elbows in" },
    ],
  },
  { day: "Sunday", focus: "Rest & Recovery", tag: "RECOVER", exercises: [] },
];

const PLANS = [
  {
    id: "plus",
    name: "PD Plus",
    sub: "Self-guided premium",
    price: 29,
    per: "per month · cancel anytime",
    monthly: 29,
    features: ["AI-built custom splits & meal plans", "PDF exports & progress analytics", "Partner discounts — supplements & apparel", "Everything in Free"],
  },
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
const ADDON = { name: "In-person training session", price: 100, note: "Available on every plan · one-on-one with your trainer each week" };

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
  /* official Grok mark — vector sourced from grok.com */
  <svg viewBox="0 0 34 33" width={s} height={s} aria-hidden="true">
    <g fill={PAPER}>
      <path d="M13.2371 21.0407L24.3186 12.8506C24.8619 12.4491 25.6384 12.6057 25.8973 13.2294C27.2597 16.5185 26.651 20.4712 23.9403 23.1851C21.2297 25.8989 17.4581 26.4941 14.0108 25.1386L10.2449 26.8843C15.6463 30.5806 22.2053 29.6665 26.304 25.5601C29.5551 22.3051 30.562 17.8683 29.6205 13.8673L29.629 13.8758C28.2637 7.99809 29.9647 5.64871 33.449 0.844576C33.5314 0.730667 33.6139 0.616757 33.6964 0.5L29.1113 5.09055V5.07631L13.2343 21.0436" />
      <path d="M10.9503 23.0313C7.07343 19.3235 7.74185 13.5853 11.0498 10.2763C13.4959 7.82722 17.5036 6.82767 21.0021 8.2971L24.7595 6.55998C24.0826 6.07017 23.215 5.54334 22.2195 5.17313C17.7198 3.31926 12.3326 4.24192 8.67479 7.90126C5.15635 11.4239 4.0499 16.8403 5.94992 21.4622C7.36924 24.9165 5.04257 27.3598 2.69884 29.826C1.86829 30.7002 1.0349 31.5745 0.36364 32.5L10.9474 23.0341" />
    </g>
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
const aiLink = (id, prompt) => {
  const q = encodeURIComponent(prompt);
  switch (id) {
    case "google": return `https://www.google.com/search?udm=50&q=${q}`;
    case "gemini": return "https://gemini.google.com/app";
    case "claude": return `https://claude.ai/new?q=${q}`;
    case "perplexity": return `https://www.perplexity.ai/search?q=${q}`;
    case "grok": return `https://grok.com/?q=${q}`;
    default: return `https://chatgpt.com/?q=${q}`;
  }
};

const getPlatform = (id) => AI_PLATFORMS.find((p) => p.id === id) || AI_PLATFORMS.find((p) => p.id === "chatgpt");

/* ---------- SEO / GEO content (rendered in footer + JSON-LD) ---------- */
const SEO_DESC = "PD Performance is an online personal training program: a customizable muscle-building split, an optional Hyrox/CrossFit-style conditioning day, AI-built custom workout splits and diet plans, accountability tracking, and optional in-person coaching. Free to join — coaching plans from $250/month.";
const FAQS = [
  {
    q: "What is PD Performance?",
    a: "PD Performance is an online personal training program built around a customizable training split — push/pull muscle-building sessions with an optional Hyrox/CrossFit-style conditioning day — plus AI-generated custom workout splits, personalized diet plans, daily accountability tracking, and a group community.",
  },
  {
    q: "How much does online personal training with PD Performance cost?",
    a: "Most of the app is free forever — the training log, community, weekly split, and progress tracking. PD Plus ($29/month) adds AI-built custom splits and meal plans, PDF exports, and partner discounts. Personal coaching runs $250 to $300 per month depending on commitment, and weekly one-on-one in-person training can be added to any coaching plan for $100/month.",
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
function PhotoSlot({ label, photo, onPick, onClear, outline }) {
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
            background: SURFACE2, border: `2px dashed ${LINE}`, position: "relative", overflow: "hidden",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
          {outline && <BodyOutline view={outline} />}
          <Camera size={18} color={RED} style={{ position: "relative" }} />
          <span style={{ ...fontDisplay, color: PAPER, fontSize: 10.5, letterSpacing: "0.12em", textAlign: "center" }} className="uppercase">Add {label}</span>
          <span style={{ ...fontBody, color: MUTED, fontSize: 10 }}>Tap to upload</span>
        </button>
      )}
    </div>
  );
}

function AvatarPicker({ value, name, onPick }) {
  const ref = useRef(null);
  return (
    <div className="flex items-center gap-4">
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) { try { onPick(await compressImage(f, 400, 0.7)); } catch { alert("Couldn't read that photo."); } }
          e.target.value = "";
        }} />
      <button onClick={() => ref.current?.click()} aria-label="Set profile photo"
        style={{ width: 74, height: 74, borderRadius: 99, overflow: "hidden", position: "relative", border: `2px solid ${LINE}`, background: SURFACE2, cursor: "pointer", padding: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {value
          ? <img src={value} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ ...fontDisplay, color: RED, fontSize: 26 }}>{(name || "A")[0].toUpperCase()}</span>}
        <span style={{ position: "absolute", bottom: 2, right: 2, background: RED, borderRadius: 99, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Camera size={12} color={PAPER} />
        </span>
      </button>
      <div>
        <div style={{ ...fontBody, color: PAPER, fontSize: 14, fontWeight: 600 }}>{name?.trim() || "Your profile"}</div>
        <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>Tap the photo to change it</div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* TAB 1 — PROFILE                                                        */
/* ====================================================================== */
function ProfileTab({ profile, setProfile, progress, setProgress, session, onSignOut }) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [bmiNote, setBmiNote] = useState("");
  const [bmiLoading, setBmiLoading] = useState(false);
  const [bmiPhotos, setBmiPhotos] = useState({ front: null, back: null, side: null });
  const [newWeight, setNewWeight] = useState("");
  const [newPhoto, setNewPhoto] = useState(null);

  useEffect(() => {
    const t = parseFloat(profile.heightIn);
    setDraft({
      ...profile,
      heightFt: profile.heightFt ?? (t ? String(Math.floor(t / 12)) : ""),
      heightInch: profile.heightInch ?? (t ? String(Math.round(t % 12)) : ""),
    });
  }, [profile]);

  const setHeight = (ft, inch) => {
    const total = (parseFloat(ft) || 0) * 12 + (parseFloat(inch) || 0);
    setDraft((d) => ({ ...d, heightFt: ft, heightInch: inch, heightIn: total ? String(total) : "" }));
  };

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
Client stats: height ${Math.floor(h / 12)}'${Math.round(h % 12)}\", weight ${w} lb, BMI ${bmi.toFixed(1)} (${bmiCat}). Goal: ${draft.goal || "general fitness"}. Trains 6 days/week (push/pull split with an optional Hyrox/CrossFit-style conditioning day).
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
        <div className="mt-4">
          <AvatarPicker value={draft.avatar} name={draft.name}
            onPick={(p) => { const nd = { ...draft, avatar: p }; setDraft(nd); setProfile(nd); }} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Name">
            <input style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Your name" />
          </Field>
          <Field label="Age">
            <input style={inputStyle} value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} placeholder="28" inputMode="numeric" />
          </Field>
          <Field label="Height">
            <div className="flex gap-2">
              <input style={inputStyle} value={draft.heightFt ?? ""} onChange={(e) => setHeight(e.target.value, draft.heightInch)}
                placeholder="ft" inputMode="numeric" aria-label="Height, feet" />
              <input style={inputStyle} value={draft.heightInch ?? ""} onChange={(e) => setHeight(draft.heightFt, e.target.value)}
                placeholder="in" inputMode="numeric" aria-label="Height, inches" />
            </div>
          </Field>
          <Field label="Weight (lb)">
            <input style={inputStyle} value={draft.weightLb} onChange={(e) => setDraft({ ...draft, weightLb: e.target.value })} placeholder="185" inputMode="decimal" />
          </Field>
          <Field label="Sex (for app visuals)">
            <select style={inputStyle} value={draft.sex || ""} onChange={(e) => { const nd = { ...draft, sex: e.target.value }; setDraft(nd); setProfile(nd); }}>
              <option value="">Prefer not to say</option>
              <option>Male</option>
              <option>Female</option>
            </select>
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
          <Btn onClick={save}>{saved ? <Check size={14} /> : null}{saved ? "Saved" : "Save profile"}</Btn>
        </div>
      </Card>

      {/* photos + body comp */}
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>Photos · Body comp</Eyebrow>
          <Sparkles size={16} color={RED} />
        </div>
        <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
          Add your front, back, and side photos — the AI reads them together with your height and weight. Same spot, same lighting each time.
        </p>
        <div className="flex gap-2 mt-3">
          <PhotoSlot label="Front" outline="front" photo={bmiPhotos.front}
            onPick={(p) => setBmiPhotos({ ...bmiPhotos, front: p })}
            onClear={() => setBmiPhotos({ ...bmiPhotos, front: null })} />
          <PhotoSlot label="Back" outline="back" photo={bmiPhotos.back}
            onPick={(p) => setBmiPhotos({ ...bmiPhotos, back: p })}
            onClear={() => setBmiPhotos({ ...bmiPhotos, back: null })} />
          <PhotoSlot label="Side" outline="side" photo={bmiPhotos.side}
            onPick={(p) => setBmiPhotos({ ...bmiPhotos, side: p })}
            onClear={() => setBmiPhotos({ ...bmiPhotos, side: null })} />
        </div>
        {bmi ? (
          <div className="mt-4 flex items-end gap-4">
            <div style={{ ...fontMono, fontSize: 44, lineHeight: 1, color: PAPER }}>{bmi.toFixed(1)}</div>
            <div>
              <div style={{ ...fontDisplay, color: RED, fontSize: 14, letterSpacing: "0.1em" }} className="uppercase">BMI · {bmiCat}</div>
              <div style={{ ...fontBody, color: MUTED, fontSize: 12 }}>{Math.floor(h / 12)}'{Math.round(h % 12)}" · {w} lb{picCount > 0 ? ` · ${picCount} photo${picCount > 1 ? "s" : ""} attached` : ""}</div>
            </div>
          </div>
        ) : (
          <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 12 }}>Enter your height and weight above to calculate BMI.</p>
        )}
        {bmi && (
          <div className="mt-4 space-y-3">
            <Btn onClick={aiBmi} disabled={bmiLoading} style={{ width: "100%", justifyContent: "center" }}>
              {bmiLoading ? <RefreshCw size={14} className="animate-spin" /> : <PlatformLogo s={14} />}
              {bmiLoading ? "Analyzing your photos…" : picCount > 0 ? "Analyze my photos with AI" : "Get AI insight (numbers only)"}
            </Btn>
            {bmiNote && (
              <p style={{ ...fontBody, color: PAPER, fontSize: 13, lineHeight: 1.6, borderLeft: `2px solid ${RED}`, paddingLeft: 12 }}>{bmiNote}</p>
            )}
            <p style={{ ...fontBody, color: MUTED, fontSize: 11 }}>
              Visual estimate only — not a medical measurement. Photos here aren't saved; use the weigh-in section below to keep progress photos.
            </p>
          </div>
        )}
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

      {/* integrations */}
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>Integrations</Eyebrow>
          <RefreshCw size={14} color={RED} />
        </div>
        <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
          Sync your watch and training apps. Connections go live when accounts launch — tell your coach which ones you use.
        </p>
        <div className="mt-3 space-y-2">
          {[["Strava", "Runs, rides & activities"], ["Garmin", "Watch workouts & heart rate"], ["Apple Health", "Steps, sleep & weight"], ["WHOOP", "Recovery & strain"], ["Oura", "Sleep & readiness"]].map(([n, d]) => (
            <div key={n} className="flex items-center justify-between" style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 12px" }}>
              <div>
                <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{n}</div>
                <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{d}</div>
              </div>
              <span style={{ ...fontDisplay, fontSize: 9, letterSpacing: "0.14em", color: MUTED, border: `1px solid ${LINE}`, borderRadius: 99, padding: "3px 10px" }} className="uppercase">Soon</span>
            </div>
          ))}
        </div>
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

function ExerciseRow({ ex, inSuperset }) {
  return (
    <div className="flex items-center justify-between"
      style={{ background: inSuperset ? "transparent" : SURFACE, border: inSuperset ? "none" : `1px solid ${LINE}`, borderRadius: inSuperset ? 0 : 10, padding: "10px 12px" }}>
      <div>
        <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{ex.name}</div>
        <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{ex.note}</div>
      </div>
      <div style={{ ...fontMono, color: RED, fontSize: 12, whiteSpace: "nowrap", marginLeft: 10 }}>
        {ex.sets} × {ex.reps}
      </div>
    </div>
  );
}

function ExerciseList({ exercises }) {
  const isSS = (x) => (x?.note || "").toLowerCase().includes("superset");
  const rows = [];
  for (let i = 0; i < exercises.length; i++) {
    const a = exercises[i], b = exercises[i + 1];
    if (isSS(a) && isSS(b)) {
      rows.push(
        <div key={i} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderLeft: `3px solid ${RED}`, borderRadius: 10, overflow: "hidden" }}>
          <div className="flex items-center gap-1" style={{ ...fontDisplay, fontSize: 9, letterSpacing: "0.18em", color: RED, padding: "7px 12px 0" }}>
            <Link2 size={10} /> SUPERSET · BACK TO BACK, THEN REST
          </div>
          <ExerciseRow ex={a} inSuperset />
          <div className="flex items-center" style={{ gap: 8, padding: "0 12px" }}>
            <div style={{ flex: 1, borderTop: `1px dashed ${LINE}` }} />
            <Link2 size={12} color={RED} />
            <div style={{ flex: 1, borderTop: `1px dashed ${LINE}` }} />
          </div>
          <ExerciseRow ex={b} inSuperset />
        </div>
      );
      i++;
    } else {
      rows.push(<ExerciseRow key={i} ex={a} />);
    }
  }
  return <div className="mt-3 space-y-2">{rows}</div>;
}

/* ---------- client-side PDF export (brand header, letter size) ---------- */
const PD_LOGO_B64 = "iVBORw0KGgoAAAANSUhEUgAAAscAAACgCAYAAADgmMHlAAAzz0lEQVR4nO3deVwc93038M/M7AE7MCAJCXFKIIHEJSQQkh3LZ+LEdnzbiR2nSdu0OR0nbZM4T9unOZy2TtMcTp8ncWq76RM5cdq6rhMfTezEjq/YkhACIU4JdN8XMDDAnvP8saDKMszFsju7+rxfr30lht8MP1azy3e/8/19fwARERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERFRQn3sY3+0enx8LDg5qemaplp+jI2N6Lqu67fddmtVqn8HIiIiokwhpnoCFzNBEFBdvWpldrbsi0ajto71eDwYGjo9vGtX5+F5mh4RERHRRYfBcQopiiKsXl3TGP8v3fJxuq7D789GT0/fCyMjo8F5mp5r9HtqrD85RERERHPgSfUELmZFRUt9K1eufJeu28saxwno7u56fXR09KIIHM8PkFdFeoVUzoWIiIgyF4PjFCosLAwsW1b6nmAwCMB+vNfV1d02OTmZ0cHxTFljBspEREQ0Xxgcp1BNTW1RTk6eT9NUCIL1GM/r9UBVhya7u3v2zOP00gIDZSIiIkok1hyniN/vR2NjY7OTY71ePw4dOvLW8ePHxhM9LyIiIqKLGYPjFJFlWWxsXPNeXY/ZPlYQJOzfv7/12LFjGb0Yz85CPGaNiYiIKBEYHKeILMtiQ0PdrcHghK2Simn9/f1dw8Mj9iNrIiIiIpoVg+MUaWxsLMjJycux299YkiRMTo6Fenq6O3Q9c9fisX0bERERpQKD4xTZuHFDo5PjRFHCmTMjAwMDA8cSPad0xZIKIiIiShQGxynS0tJ8QywWsX2cJEk4derUvv7+3SPzMC0iIiKiixqD4xTIzc0V1q5ten8oFHRQb6xjcHBw+4kTJ8PzMjkX4EI8IiIiShUGxynQ0FCfm5+fX2S3ZlgQBESjiHV2dmzL5HpjIiIiolRhcJwCLS3rqyVJ8jkJjicnJ4c7O3f1ztPUiIiIiC5qDI5T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EREREVE6eVtw3NS0bkkgEMh30pM4GtVjO3a0v5GwmZGrsNaYiIiILgZvC47XrVtbk5WVtdBucBzvVBELtbW19Sd0dkRERERESfS24HjNmrWXSpLgsR8cAyMjwyd27uw8ldDZEREREREl0bnguKCgQFyxYkWd3Y0/dF2Hz+fHzp07XxwaGk6/3mRkiiUVREREdLE4FxyvXr0qt6CgoNrJYjxR9GLHju2/TejMiIiIiIiS7FxwXFVVVVxQsKDG6cYUra1t7QmbFbmG3d7GREREROns/MxxVXZ2TsBucCxJIjRtZLyjo/1wwmdHaYUlFURERJTuRADIzc0VVq2qaXByAr8/Gz09vS8OD48EEzs1IiIiIqLkEgGgtLTEV1lZuVHX7WWNdV2HIEjo7Nz1sqZpsXmZIaUMF+IRERHRxUYEgKKiInnZstJ3h8MhRyfZubOzLRhk4piIiIiI0psHAKqrVy1VlAUBTVNhp5WbJHmgaWpk165dux1sqkcud342mAvziIiI6GLg8fv9aGioa7R/qA6/34++vn1vnjhxYizxUyM3MQqUWVJBREREmcKjKLliQ0PDNYD9xKAgSBgY2Lvt+PETzuoxKC0xo0xERESZSszNzZXq6+tuDwYnbJVUAPGx/f39HcPDw1yMd5Fi1piIiIgyiVhbW7dowYKChZFIxNaBkiRhcnI80tfXs1NnwTERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERkQv9f8TvGglo0RsGAAAAAElFTkSuQmCC";
function pdfClean(t) {
  return String(t).replace(/\u2192/g, "->").replace(/[^\x20-\x7E\u00B7\u00D7\u2013\u2014\u2018\u2019\u201C\u201D]/g, "");
}
function pdfDoc(title) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFillColor(10, 10, 11); doc.rect(0, 0, 612, 70, "F");
  try { doc.addImage("data:image/png;base64," + PD_LOGO_B64, "PNG", 48, 19, 152, 32); } catch (e) {}
  doc.setTextColor(10, 10, 11); doc.setFontSize(15); doc.text(pdfClean(title), 48, 102);
  return { doc, y: 130 };
}
function pdfLine(st, txt, opts = {}) {
  if (st.y > 730) { st.doc.addPage(); st.y = 60; }
  st.doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  st.doc.setFontSize(opts.size || 10);
  if (opts.red) st.doc.setTextColor(217, 4, 41); else st.doc.setTextColor(35, 35, 38);
  const lines = st.doc.splitTextToSize(pdfClean(txt), 516);
  st.doc.text(lines, 48, st.y);
  st.y += lines.length * (opts.size || 10) * 1.4 + (opts.gap ?? 4);
}
function downloadSplitPdf(activeSplit, isCustom) {
  const st = pdfDoc("Weekly Training Split");
  activeSplit.forEach((d) => {
    pdfLine(st, `${d.day.toUpperCase()} — ${d.focus}`, { bold: true, size: 12, red: true, gap: 3 });
    if (d.hyrox && !isCustom) HYROX.forEach((h) => pdfLine(st, `Run ${h.run} -> ${h.station} — ${h.detail}`));
    if (d.exercises && d.exercises.length) d.exercises.forEach((ex) => pdfLine(st, `${ex.name} — ${ex.sets} x ${ex.reps}${ex.note ? `   (${ex.note})` : ""}`));
    if ((!d.exercises || !d.exercises.length) && !d.hyrox) pdfLine(st, d.tag || (d.day === "Sunday" ? "Full rest — walk, stretch, hydrate." : `${d.focus} session.`));
    st.y += 8;
  });
  pdfLine(st, "CARDIO & ABS", { bold: true, size: 12, red: true, gap: 3 });
  pdfLine(st, "Warm-up cardio every workout: 1 mile chill run or 15 min on the stair stepper.");
  pdfLine(st, "Abs every day except leg days (Monday & Thursday): pick 2-3 core moves, 3 sets each.");
  st.doc.save("pd-workout-plan.pdf");
}
function downloadDietPdf(dietPlan, prefs, profile) {
  const st = pdfDoc("Weekly Meal Plan");
  pdfLine(st, `Goal: ${prefs.dietGoal}   ·   Meals per day: ${prefs.mealsPerDay}${profile?.weightLb ? `   ·   Weight: ${profile.weightLb} lb` : ""}`, { bold: true, gap: 12 });
  dietPlan.split("\n").forEach((ln) => {
    const t = ln.trim();
    if (!t) { st.y += 6; return; }
    if (/^[A-Z][A-Z \/&'\u2019-]{3,}$/.test(t)) pdfLine(st, t, { bold: true, red: true, size: 11.5, gap: 3 });
    else pdfLine(st, t);
  });
  st.doc.save("pd-meal-plan.pdf");
}

function WorkoutsTab({ trainerMode, videos, addVideo, removeVideo, customSplit, setCustomSplit, profile, snaps, addSnap }) {
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
      <Card style={{ position: "relative", overflow: "hidden" }}>
        <div className="flex items-center justify-between" style={{ position: "relative" }}>
          <Eyebrow>{customSplit ? "Your custom split" : "Weekly split"}</Eyebrow>
          <button onClick={() => setShowBuilder(!showBuilder)}
            style={{ ...fontDisplay, color: RED, fontSize: 11, letterSpacing: "0.15em", background: "none", border: "none", cursor: "pointer" }}
            className="uppercase">
            {showBuilder ? "Close builder" : "Customize split"}
          </button>
        </div>

        <p style={{ ...fontBody, color: MUTED, fontSize: 12, lineHeight: 1.55, marginTop: 8, borderLeft: `2px solid ${RED}`, paddingLeft: 10 }}>
          If you'd like to replace a workout with a similar one that hits the same muscle — go ahead. These are guidelines to look, feel, and perform better. Intensity and consistency are what matter most.
        </p>

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
              <Btn onClick={() => window.open(aiLink(profile.aiPlatform, `Build me a weekly training split: ${bDays} days per week, about ${bMins} minutes per session, main focus ${bFocus}, goal: ${profile.goal || "general fitness"}. Give exercises, sets and reps for each day.`), "_blank")}>
                <PlatformLogo s={14} /> Build my split with AI
              </Btn>
              <Btn variant="ghost" onClick={buildSplit} disabled={building}>
                {building ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {building ? "Building…" : "Quick-build in app"}
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
                      <>
                        <HyroxCircuit />
                        {d.exercises && d.exercises.length > 0 && <ExerciseList exercises={d.exercises} />}
                      </>
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

        <Btn variant="ghost" onClick={() => downloadSplitPdf(activeSplit, !!customSplit)} style={{ width: "100%", justifyContent: "center", marginTop: 14 }}>
          <Download size={14} /> Download my split (PDF)
        </Btn>
      </Card>

      {/* cardio & abs — every week */}
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>Cardio & Abs</Eyebrow>
          <Flame size={16} color={RED} />
        </div>
        <div className="mt-3 space-y-2">
          <div style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>Warm-up cardio — every workout</div>
            <div style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 2 }}>
              1 mile chill run or 15 min on the stair stepper at the beginning of every session.
            </div>
          </div>
          <div style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>Abs — every day except leg days</div>
            <div style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 2 }}>
              Hit core at the end of every session except Monday and Thursday (leg days). Pick any 2–3: hanging knee raises, cable crunches, planks, ab-wheel — 3 sets each.
            </div>
          </div>
        </div>
      </Card>

      <SnapCard title="Workout snaps" type="workout" snaps={snaps} addSnap={addSnap} />
    </div>
  );
}

function SnapCard({ title, type, snaps, addSnap }) {
  const mine = (snaps || []).filter((x) => x.type === type).slice(0, 6);
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow>{title}</Eyebrow>
        <PhotoPick label="Add photo" icon={ImagePlus} onPick={(p) => addSnap(type, p)} />
      </div>
      {mine.length > 0 ? (
        <div className="flex gap-2 mt-3 flex-wrap">
          {mine.map((x) => (
            <div key={x.id} style={{ textAlign: "center" }}>
              <img src={x.photo} alt={type} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, border: `1px solid ${LINE}` }} />
              <div style={{ ...fontBody, color: MUTED, fontSize: 9, marginTop: 2 }}>{x.date.slice(5)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 8 }}>Snap it — your coach looks for consistency, not perfection.</p>
      )}
    </Card>
  );
}

/* ====================================================================== */
/* TAB 3 — DIET                                                           */
/* ====================================================================== */
function DietTab({ profile, dietPrefs, setDietPrefs, dietPlan, setDietPlan, snaps, addSnap }) {
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
    <div className="fuel-cols">
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
          <div className="flex gap-3 flex-wrap">
            <Btn onClick={() => window.open(aiLink(profile.aiPlatform, `Build me a weekly meal plan: goal ${prefs.dietGoal}, ${prefs.mealsPerDay} meals per day${profile.weightLb ? `, weight ${profile.weightLb} lb` : ""}. Foods I like: ${prefs.likes || "no preference"}. Avoid: ${prefs.dislikes || "none"}. Allergies: ${(prefs.allergies || []).join(", ") || "none"}. Include daily calorie and protein targets.`), "_blank")}>
              <PlatformLogo s={14} /> Build my plan with AI
            </Btn>
            <Btn variant="ghost" onClick={generate} disabled={loading}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? "Building…" : dietPlan ? "Rebuild in app" : "Quick-build in app"}
            </Btn>
          </div>
        </div>
      </Card>

      <SnapCard title="Meal snaps" type="meal" snaps={snaps} addSnap={addSnap} />
      </div>

      <div className="space-y-5">
      {dietPlan ? (
        <Card>
          <Eyebrow>Your weekly plan</Eyebrow>
          <div className="mt-3">
            {dietPlan.split("\n").map((ln, i) => {
              const t = ln.trim();
              if (!t) return <div key={i} style={{ height: 10 }} />;
              if (/^[A-Z][A-Z \/&'\u2019-]{3,}$/.test(t)) return (
                <div key={i} style={{ ...fontDisplay, color: RED, fontSize: 12, letterSpacing: "0.16em", marginTop: 16, marginBottom: 8 }} className="uppercase">{t}</div>
              );
              if (/^meal \d/i.test(t)) {
                const ci = t.indexOf(":");
                return (
                  <div key={i} style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                    <span style={{ ...fontBody, color: RED, fontSize: 12.5, fontWeight: 600 }}>{ci > 0 ? t.slice(0, ci + 1) : ""} </span>
                    <span style={{ ...fontBody, color: PAPER, fontSize: 12.5, lineHeight: 1.6 }}>{ci > 0 ? t.slice(ci + 1) : t}</span>
                  </div>
                );
              }
              return <p key={i} style={{ ...fontBody, color: PAPER, fontSize: 13, lineHeight: 1.75, margin: "0 0 10px" }}>{t}</p>;
            })}
          </div>
          <Btn variant="ghost" onClick={() => downloadDietPdf(dietPlan, prefs, profile)} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
            <Download size={14} /> Download my meal plan (PDF)
          </Btn>
          <p style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 12, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
            General guidance — always double-check labels for your allergens.
          </p>
        </Card>
      ) : (
        <Card>
          <Eyebrow>Your weekly plan</Eyebrow>
          <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
            Your full meal plan lays out here — every meal, calories, and macros. Set your preferences on the left and hit “Build my plan.”
          </p>
        </Card>
      )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/* TAB 4 — ACCOUNTABILITY (with reminders)                                */
/* ====================================================================== */
const LEADS = ["15 min", "30 min", "1 hour", "1 day", "1 week"];
const fmt12 = (t) => { const [h, m] = (t || "18:00").split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
const LEAD_MS = { "15 min": 15 * 60e3, "30 min": 30 * 60e3, "1 hour": 60 * 60e3, "1 day": 24 * 3600e3, "1 week": 7 * 24 * 3600e3 };

const LOG_ITEMS = [["workout", "Workout"], ["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"]];

function AccountabilityTab({ commitments, setCommitments, dailyLog, setDailyLog, profile }) {
  const [text, setText] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = dailyLog[today] || {};

  const setDay = (patch) => {
    const next = { ...dailyLog, [today]: { ...todayLog, ...patch } };
    /* keep photos for 14 days only — protects browser storage limits */
    const cutoff = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    Object.keys(next).forEach((k) => { if (k < cutoff && next[k]?.photo) next[k] = { ...next[k], photo: null }; });
    setDailyLog(next);
  };

  const sendWeek = async () => {
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); }).reverse();
    const lines = days.map((k) => {
      const l = dailyLog[k];
      if (!l) return `${k}: no log`;
      const done = LOG_ITEMS.filter(([key]) => l[key] === true).map(([, lab]) => lab).join(", ");
      const missed = LOG_ITEMS.filter(([key]) => l[key] === false).map(([, lab]) => lab).join(", ");
      return `${k}: done — ${done || "none"}${missed ? ` · missed — ${missed}` : ""}${l.photo ? " · photo taken" : ""}`;
    });
    const txt = `PD Performance weekly log — ${profile?.name?.trim() || "Client"}\n${lines.join("\n")}`;
    try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch {}
    try { await navigator.clipboard.writeText(txt); alert("Your week is copied — paste it into a text to your coach, and attach your photos to the same message."); }
    catch { alert(txt); }
  };

  const logDays = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); });
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
      {/* daily log — workout, meals, photo */}
      <Card style={{ position: "relative", overflow: "hidden" }}>
        <div className="flex items-center justify-between" style={{ position: "relative" }}>
          <Eyebrow>Daily log</Eyebrow>
          <CheckSquare size={16} color={RED} />
        </div>
        <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 6 }}>
          Check off today — Yes if you did it on plan, No if you didn't. Send it to your coach every Sunday.
        </p>
        <div className="mt-3 space-y-2">
          {LOG_ITEMS.map(([key, label]) => {
            const v = todayLog[key];
            return (
              <div key={key} className="flex items-center justify-between" style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 12px" }}>
                <span style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{label}</span>
                <div className="flex gap-2">
                  <button onClick={() => setDay({ [key]: true })} className="uppercase"
                    style={{ ...fontDisplay, fontSize: 11, letterSpacing: "0.08em", padding: "4px 14px", borderRadius: 8, cursor: "pointer", background: v === true ? RED : "transparent", color: v === true ? PAPER : MUTED, border: `1px solid ${v === true ? RED : LINE}` }}>
                    Yes
                  </button>
                  <button onClick={() => setDay({ [key]: false })} className="uppercase"
                    style={{ ...fontDisplay, fontSize: 11, letterSpacing: "0.08em", padding: "4px 14px", borderRadius: 8, cursor: "pointer", background: "transparent", color: v === false ? PAPER : MUTED, border: `1px solid ${v === false ? PAPER : LINE}` }}>
                    No
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <PhotoPick label={todayLog.photo ? "Photo ✓" : "Add today's photo"} onPick={(p) => setDay({ photo: p })} />
          {todayLog.photo && <img src={todayLog.photo} alt="Today's check-in" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />}
        </div>
        <div className="mt-4" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          <div className="flex gap-1">
            {[...logDays].reverse().map((k) => {
              const l = dailyLog[k] || {};
              const n = LOG_ITEMS.filter(([key]) => l[key] === true).length;
              return (
                <div key={k} style={{ flex: 1, textAlign: "center", background: SURFACE2, border: `1px solid ${n === 5 ? RED : LINE}`, borderRadius: 8, padding: "6px 2px" }}>
                  <div style={{ ...fontMono, color: n > 0 ? PAPER : MUTED, fontSize: 11 }}>{n}/5</div>
                  <div style={{ ...fontBody, color: MUTED, fontSize: 9 }}>{k.slice(5)}</div>
                </div>
              );
            })}
          </div>
          <Btn onClick={sendWeek} style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>Send my week to coach</Btn>
          <p style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 8 }}>
            Packages your last 7 days into a message — text it to your coach with your photos attached.
          </p>
        </div>
      </Card>

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
                      {(() => {
                        const [H, M] = (r.dueTime || "18:00").split(":").map(Number);
                        const h12 = H % 12 || 12;
                        const ap = H >= 12 ? "PM" : "AM";
                        const selStyle = { ...inputStyle, width: "auto", padding: "7px 8px", fontSize: 12 };
                        const setT = (hh, mm, a) => setReminder(c.id, { dueTime: `${String((hh % 12) + (a === "PM" ? 12 : 0)).padStart(2, "0")}:${String(mm).padStart(2, "0")}` });
                        const mins = [0, 15, 30, 45].includes(M) ? [0, 15, 30, 45] : [M, 0, 15, 30, 45];
                        return (
                          <>
                            <select style={selStyle} value={h12} onChange={(e) => setT(parseInt(e.target.value, 10), M, ap)}>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <select style={selStyle} value={M} onChange={(e) => setT(h12, parseInt(e.target.value, 10), ap)}>
                              {mins.map((n) => <option key={n} value={n}>{String(n).padStart(2, "0")}</option>)}
                            </select>
                            <select style={selStyle} value={ap} onChange={(e) => setT(h12, M, e.target.value)}>
                              <option>AM</option>
                              <option>PM</option>
                            </select>
                          </>
                        );
                      })()}
                      {needsDate && (
                        <input type="date" style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 12 }}
                          value={r.dueDate} onChange={(e) => setReminder(c.id, { dueDate: e.target.value })} />
                      )}
                    </div>
                    <p style={{ ...fontBody, color: MUTED, fontSize: 11 }}>
                      {needsDate
                        ? `You'll get a heads-up ${r.lead} before the deadline you set.`
                        : `You'll get a nudge ${r.lead} before ${fmt12(r.dueTime)} each day it's unchecked.`}
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

/* curated media feed — real videos with thumbnails, plus live-search links */
const FEED_TOPICS = {
  Bodybuilding: [
    { v: "si2vi517BH4", t: "2026 Mr. Olympia Finals and Recap: Nick Walker wins", c: "Nick's Strength and Power" },
    { v: "roHQ3F7d9YQ", t: "How To Get Lean & STAY Lean Forever (Using Science)", c: "Jeff Nippard" },
  ],
  Hyrox: [
    { v: "Qu_rcoH5ieA", t: "HYROX Pro Explains Mistakes to Avoid for Every Station", c: "Rich Ryan" },
    { t: "Hyrox news & race results", d: "Events, qualifiers, world champs", u: "https://news.google.com/search?q=hyrox" },
  ],
  Running: [
    { v: "dSRXMRkZM9U", t: "I ran the NYC Marathon — my first marathon ever", c: "Jen Lauren" },
    { t: "First Ironman prep", d: "How people train for 140.6", u: "https://www.youtube.com/results?search_query=first+ironman+preparation" },
  ],
  Athleticism: [
    { t: "Jump higher", d: "Vertical-jump training that transfers", u: "https://www.youtube.com/results?search_query=increase+vertical+jump+training" },
    { t: "Get faster", d: "Sprint mechanics & speed drills", u: "https://www.youtube.com/results?search_query=sprint+faster+training+drills" },
  ],
  Highlights: [
    { v: "YPl4kVPw8IY", t: "Greatest world records in sport history", c: "Wave of Trend" },
    { v: "Xw6k6Ma0oqo", t: "Royal Family — World of Dance front row", c: "Official World of Dance" },
  ],
};

function GroupsTab({ profile, posts, setPosts, interests, setInterests }) {
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
  const [drafts, setDrafts] = useState({});
  const comment = (id) => {
    const t = (drafts[id] || "").trim();
    if (!t) return;
    setPosts(posts.map((p) => p.id === id
      ? { ...p, comments: [...(p.comments || []), { id: Date.now().toString(), author: profile.name?.trim() || "Anonymous", text: t }].slice(-20) }
      : p));
    setDrafts({ ...drafts, [id]: "" });
  };

  const ago = (iso) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const activeTopics = interests && interests.length ? interests : Object.keys(FEED_TOPICS);
  const toggleTopic = (k) => {
    const cur = interests && interests.length ? interests : Object.keys(FEED_TOPICS);
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    setInterests(next.length ? next : Object.keys(FEED_TOPICS));
  };

  return (
    <div className="space-y-5">
      {/* for-you feed */}
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>For you · The feed</Eyebrow>
          <Flame size={14} color={RED} />
        </div>
        <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 6 }}>
          Pick your interests — fresh content from the sports and athletes you care about.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {Object.keys(FEED_TOPICS).map((k) => {
            const on = activeTopics.includes(k);
            return (
              <button key={k} onClick={() => toggleTopic(k)}
                style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.12em", padding: "5px 12px", borderRadius: 99, cursor: "pointer", background: on ? RED : "transparent", color: on ? PAPER : MUTED, border: `1px solid ${on ? RED : LINE}` }} className="uppercase">
                {k}
              </button>
            );
          })}
        </div>
        <div className="mt-3 space-y-3">
          {activeTopics.flatMap((k) => (FEED_TOPICS[k] || []).map((it) => it.v ? (
            <button key={it.v} onClick={() => window.open(`https://www.youtube.com/watch?v=${it.v}`, "_blank")} className="w-full text-left"
              style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 12, padding: 0, overflow: "hidden", cursor: "pointer", display: "block" }}>
              <div style={{ position: "relative" }}>
                <img src={`https://i.ytimg.com/vi/${it.v}/hqdefault.jpg`} alt={it.t} loading="lazy"
                  style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(226,4,41,0.92)", borderRadius: 99, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
                </span>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{it.t}</div>
                <div style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 2 }}>{it.c} · YouTube · {k}</div>
              </div>
            </button>
          ) : (
            <button key={it.u} onClick={() => window.open(it.u, "_blank")} className="w-full text-left"
              style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 12, padding: "10px 12px", cursor: "pointer", display: "block", width: "100%" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{it.t}</div>
                  <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{it.d} · {k}</div>
                </div>
                <ChevronRight size={14} color={RED} />
              </div>
            </button>
          )))}
        </div>
        <p style={{ ...fontBody, color: MUTED, fontSize: 10.5, marginTop: 10 }}>
          Links open the newest content on each topic. A fully personalized in-app feed arrives with accounts.
        </p>
      </Card>

      <Card>
        <Eyebrow>Post to the community</Eyebrow>
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
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${LINE}` }}>
              <button onClick={() => like(p.id)} className="flex items-center gap-1"
                style={{ background: "none", border: "none", cursor: "pointer", ...fontMono, color: p.likes > 0 ? RED : MUTED, fontSize: 13 }}>
                <Heart size={15} fill={p.likes > 0 ? RED : "none"} color={p.likes > 0 ? RED : MUTED} /> {p.likes || 0}
              </button>
              {(p.comments || []).map((cm) => (
                <div key={cm.id} style={{ ...fontBody, fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>
                  <span style={{ color: PAPER, fontWeight: 600 }}>{cm.author}</span>{" "}
                  <span style={{ color: MUTED }}>{cm.text}</span>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input style={{ ...inputStyle, padding: "7px 10px", fontSize: 12 }} placeholder="Add a comment…"
                  value={drafts[p.id] || ""} onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && comment(p.id)} />
                <Btn variant="ghost" onClick={() => comment(p.id)} style={{ padding: "7px 12px" }}>Post</Btn>
              </div>
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
/* LOGIN GATE — screen-recording-style preview + sign in                  */
/* ====================================================================== */
const AppleLogo = ({ s = 16 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">
    <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702" />
  </svg>
);

const PREVIEW_FRAMES = [
  {
    title: "Train smarter", icon: Dumbbell,
    cap: "Follow your coach's split — or build a custom one with AI in seconds.",
    rows: ["MON · Legs — Hyrox/CrossFit circuit", "TUE · Chest & biceps", "WED · Back & triceps", "THU · Hyrox stations + shoulders"],
  },
  {
    title: "Fuel it right", icon: Utensils,
    cap: "Diet plans built around foods you actually eat — allergies excluded automatically.",
    rows: ["2,400 cal · 185g protein daily", "Meal 1 — eggs, oatmeal, berries", "Meal 2 — chicken, rice, veggies", "Rest day: drop 200 calories"],
  },
  {
    title: "Stay accountable", icon: CheckSquare,
    cap: "Daily commitments, streaks, and reminders that keep you honest.",
    rows: ["✓ Hit 150g protein — 12-day streak", "✓ 10k steps — 5/7 this week", "○ In bed by 10:30", "Reminder set · 30 min before 6 pm"],
  },
  {
    title: "Coached 24/7", icon: MessageCircle,
    cap: "A built-in AI coach that knows your program — plus your real trainer.",
    rows: ["You: What do I eat before legs?", "Coach: Carbs + protein, 90 min out…", "You: How do I pace the runs?", "Coach: A pace you could hold twice…"],
  },
  {
    title: "See the change", icon: Scale,
    cap: "Weigh-ins, front/back/side photos, and trends that prove it's working.",
    rows: ["Today · 182.4 lb (−6.2 lb total)", "Photos: front ✓ back ✓ side ✓", "BMI 24.1 · healthy range", "4-week trend ▁▂▄▆"],
  },
];

function LoginGate({ onLogin }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((x) => (x + 1) % PREVIEW_FRAMES.length), 3200);
    return () => clearInterval(iv);
  }, []);
  const f = PREVIEW_FRAMES[i];
  const Icon = f.icon;
  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: INK, zIndex: 80 }}>
      <div className="mx-auto px-5 py-8 flex flex-col" style={{ maxWidth: 420, minHeight: "100%" }}>
        <div className="flex items-baseline gap-2 justify-center">
          <span style={{ ...fontDisplay, fontStyle: "italic", color: PAPER, fontSize: 27, fontWeight: 700, textTransform: "lowercase" }}>pd</span>
          <span style={{ color: RED, fontWeight: 700, fontSize: 22, transform: "skewX(-12deg)", display: "inline-block" }} aria-hidden="true">/</span>
          <span style={{ ...fontDisplay, color: PAPER, fontSize: 22, fontWeight: 500, letterSpacing: "0.18em" }}>PERFORMANCE</span>
        </div>
        <p style={{ ...fontBody, color: MUTED, fontSize: 13, textAlign: "center", marginTop: 6 }}>
          Online personal training that actually sticks.
        </p>

        {/* screen-recording-style preview */}
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, overflow: "hidden", marginTop: 22 }}>
          <div className="flex gap-1" style={{ padding: "10px 12px 0" }}>
            {PREVIEW_FRAMES.map((_, j) => (
              <div key={j} style={{ flex: 1, height: 3, borderRadius: 99, background: j <= i ? RED : LINE, transition: "background .3s" }} />
            ))}
          </div>
          <div style={{ padding: 18 }}>
            <div className="flex items-center gap-2">
              <Icon size={16} color={RED} />
              <span style={{ ...fontDisplay, color: PAPER, fontSize: 15, letterSpacing: "0.08em" }} className="uppercase">{f.title}</span>
              <span className="flex items-center gap-1" style={{ ...fontMono, marginLeft: "auto", color: MUTED, fontSize: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: RED, display: "inline-block", animation: "pdblink 1.2s infinite" }} /> PREVIEW
              </span>
            </div>
            <div className="mt-3 space-y-2" key={i} style={{ animation: "pdfade .45s ease" }}>
              {f.rows.map((r, k) => (
                <div key={k} style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 9, padding: "9px 12px", ...fontBody, color: PAPER, fontSize: 12.5 }}>
                  {r}
                </div>
              ))}
            </div>
            <p style={{ ...fontBody, color: MUTED, fontSize: 12.5, lineHeight: 1.55, marginTop: 12, marginBottom: 0 }}>{f.cap}</p>
          </div>
        </div>

        {/* sign in */}
        <div className="mt-6 space-y-3">
          <button onClick={() => onLogin("google")}
            className="w-full flex items-center justify-center gap-3"
            style={{ ...fontBody, background: "#FFFFFF", color: "#1F1F1F", border: "1px solid #DADCE0", borderRadius: 12, padding: "12px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            <GoogleLogo s={18} /> Continue with Google
          </button>
          <button onClick={() => onLogin("apple")}
            className="w-full flex items-center justify-center gap-3"
            style={{ ...fontBody, background: PAPER, color: INK, border: `1px solid ${PAPER}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            <AppleLogo s={18} /> Continue with Apple
          </button>
          <button onClick={() => onLogin("guest")}
            className="w-full"
            style={{ ...fontBody, background: "none", color: MUTED, border: "none", fontSize: 13, cursor: "pointer", padding: 6 }}>
            Continue without an account
          </button>
        </div>
        <p style={{ ...fontBody, color: MUTED, fontSize: 11, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
          Your training data is stored privately on this device.
        </p>
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
          <Btn onClick={onStart}>See plans & pricing <ChevronRight size={14} /></Btn>
        </div>
      </Card>
      <p style={{ ...fontBody, color: MUTED, fontSize: 11, lineHeight: 1.6 }}>
        This page is general education, not medical advice. Check with a healthcare professional before starting a new training or nutrition program, especially with existing conditions or injuries.
      </p>
    </div>
  );
}

function PricingPage({ plan, setPlan, profile, setProfile, trainerCfg, addBooking }) {
  const total = (p) => p.monthly + (profile.addon ? ADDON.price : 0);
  const payVenmo = (p) => {
    const handle = trainerCfg.venmo || "your-trainer";
    const note = encodeURIComponent(`${p.name} plan${profile.addon ? " + trainer access" : ""}`);
    window.open(`https://venmo.com/u/${handle}?txn=pay&amount=${total(p)}&note=${note}`, "_blank");
  };
  const payStripe = (p) => {
    if (trainerCfg.stripe) window.open(trainerCfg.stripe, "_blank");
    else alert("Your trainer hasn't connected a Stripe payment link yet. Use Venmo for now.");
  };
  const toggleAddon = () => {
    const np = { ...profile, addon: !profile.addon };
    setProfile(np);
    if (plan) setPlan({ ...plan, addon: np.addon });
  };
  const selected = plan ? PLANS.find((p) => p.id === plan.id) : null;
  return (
    <div className="space-y-5">
      <Card>
        <Eyebrow>Membership · Pricing</Eyebrow>
        <p style={{ ...fontBody, color: MUTED, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          Most of PD Performance is free — forever. You pay only for the personal side: custom programming, real coaching, and the accountability that gets results. Tap a plan to select it.
        </p>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, marginTop: 14 }}>
          <div className="flex items-start justify-between">
            <div>
              <div style={{ ...fontDisplay, color: PAPER, fontSize: 18, letterSpacing: "0.05em" }} className="uppercase">Free</div>
              <div style={{ ...fontBody, color: MUTED, fontSize: 12 }}>PD Athlete — free forever</div>
            </div>
            <div className="text-right">
              <div style={{ ...fontMono, color: PAPER, fontSize: 22 }}>$0</div>
            </div>
          </div>
          <ul className="mt-2 space-y-1">
            {["The full app: daily log, streaks & tracking", "Community — posts, comments & support", "The proven weekly split & exercise library", "Weigh-ins, photos & body comp check"].map((f) => (
              <li key={f} className="flex items-center gap-2" style={{ ...fontBody, color: MUTED, fontSize: 12 }}>
                <Check size={12} color={RED} /> {f}
              </li>
            ))}
          </ul>
          <div style={{ ...fontDisplay, color: MUTED, fontSize: 10, letterSpacing: "0.15em", marginTop: 8 }} className="uppercase">You're already on it</div>
        </div>
        <div className="space-y-3 mt-3">
          {PLANS.map((p) => {
            const active = plan?.id === p.id;
            return (
              <div key={p.id} onClick={() => setPlan({ id: p.id, addon: profile.addon })}
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
        {selected && (
          <div className="mt-5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
            <div className="flex items-baseline justify-between">
              <Eyebrow>Due now</Eyebrow>
              <div style={{ ...fontMono, color: PAPER, fontSize: 28 }}>
                ${total(selected)}
                <span style={{ fontSize: 12, color: MUTED }}> {selected.flat ? "flat" : "/mo"}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-3 flex-wrap">
              <Btn onClick={() => payVenmo(selected)} style={{ flex: 1, justifyContent: "center", minWidth: 140 }}>
                Pay with Venmo
              </Btn>
              <Btn variant="ghost" onClick={() => payStripe(selected)} style={{ flex: 1, justifyContent: "center", minWidth: 140 }}>
                <CreditCard size={14} /> Card (Stripe)
              </Btn>
            </div>
          </div>
        )}

        {/* in-person session add-on */}
        <div className="mt-5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
          <div onClick={toggleAddon} className="flex items-center justify-between gap-3"
            style={{ border: `1px dashed ${profile.addon ? RED : LINE}`, borderRadius: 12, padding: 14, cursor: "pointer" }}>
            <div>
              <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{ADDON.name}</div>
              <div style={{ ...fontBody, color: MUTED, fontSize: 12 }}>{ADDON.note}</div>
            </div>
            <div style={{ ...fontMono, color: profile.addon ? RED : PAPER, fontSize: 16, whiteSpace: "nowrap" }}>+${ADDON.price}/mo</div>
          </div>
          {profile.addon && (
            <div className="mt-3">
              <Btn
                onClick={() => {
                  addBooking({ id: Date.now().toString(), name: profile.name?.trim() || "Client", date: new Date().toISOString() });
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
  const [showAccount, setShowAccount] = useState(false);
  const [theme, setThemeState] = useState("dark");
  const [session, setSessionState] = useState(null);
  const [dailyLog, setDailyLogState] = useState({});
  const [snaps, setSnapsState] = useState([]);
  const [interests, setInterestsState] = useState(null);

  useEffect(() => {
    (async () => {
      const [p, pl, dp, dpl, cm, vd, cs, pg, ps, tc, bk, th, se, dl, sn, it] = await Promise.all([
        sget("pt:profile"), sget("pt:plan"), sget("pt:diet-prefs"), sget("pt:diet-plan"),
        sget("pt:commitments"), sget("pt:videos", true), sget("pt:custom-split"),
        sget("pt:progress"), sget("pt:group-posts", true), sget("pt:trainer-cfg", true),
        sget("pt:bookings", true), sget("pt:theme"), sget("pt:session"), sget("pt:daily-log"),
        sget("pt:snaps"), sget("pt:interests"),
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
      if (se) setSessionState(se);
      if (dl) setDailyLogState(dl);
      if (sn) setSnapsState(sn);
      if (it) setInterestsState(it);
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
  const setSession = (v) => { setSessionState(v); sset("pt:session", v); };
  const setDailyLog = (v) => { setDailyLogState(v); sset("pt:daily-log", v); };
  const setSnaps = (v) => { setSnapsState(v); sset("pt:snaps", v); };
  const setInterests = (v) => { setInterestsState(v); sset("pt:interests", v); };
  const addSnap = (type, photo) => setSnaps([{ id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), type, photo }, ...snaps].slice(0, 12));

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
    { id: "groups", label: "Community", icon: Users },
    { id: "train", label: "Train", icon: Dumbbell },
    { id: "fuel", label: "Fuel", icon: Utensils },
    { id: "track", label: "Track", icon: CheckSquare },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className={theme === "light" ? "pd-light" : "pd-dark"} style={{ background: INK, minHeight: "100vh", ...fontBody }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Great+Vibes&display=swap');
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
        @keyframes pdfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes pdblink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes pdPoseA { 0%, 42% { opacity: 1; } 50%, 92% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes pdPoseB { 0%, 42% { opacity: 0; } 50%, 92% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes pdSteam { 0% { transform: translateY(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }
        @keyframes pdSlide { from { transform: translateX(0); } to { transform: translateX(-30px); } }
        @keyframes pdBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
        /* phone-width header: icons only, smaller wordmark */
        .fuel-cols { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
        @media (min-width: 900px) { .fuel-cols { grid-template-columns: 5fr 6fr; } }
        @media (max-width: 520px) {
          .hdr-label { display: none !important; }
          .brand-a { font-size: 19px !important; }
          .brand-slash { font-size: 15px !important; }
          .brand-b { font-size: 14px !important; letter-spacing: 0.12em !important; }
        }
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
          <span className="brand-a" style={{ ...fontDisplay, fontStyle: "italic", color: PAPER, fontSize: 24, fontWeight: 700, letterSpacing: "0.04em", textTransform: "lowercase" }}>pd</span>
          <span className="brand-slash" style={{ color: RED, fontWeight: 700, fontSize: 20, transform: "skewX(-12deg)", display: "inline-block" }} aria-hidden="true">/</span>
          <span className="brand-b" style={{ ...fontDisplay, color: PAPER, fontSize: 20, fontWeight: 500, letterSpacing: "0.18em" }}>PERFORMANCE</span>
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
            <span style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.12em", color: PAPER }} className="uppercase hdr-label">Coach</span>
          </button>
          <button onClick={() => window.open(aiPlatform.url, "_blank")} className="flex items-center gap-1"
            title={aiPlatform.id === "chatgpt" ? 'Opens ChatGPT — "pd performance" folder' : `Ask ${aiPlatform.name}`}
            aria-label={`Open your AI assistant (${aiPlatform.name})`}
            style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
            <AiLogo s={13} />
            <span style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.12em", color: PAPER }} className="uppercase hdr-label">AI</span>
          </button>
          {trainerMode && (
            <button onClick={() => setShowTrainerPanel(true)} style={{ background: "none", border: "none", cursor: "pointer" }} title="Trainer settings">
              <Settings size={17} color={RED} />
            </button>
          )}
          <button onClick={toggleTrainer} className="flex items-center gap-1" title={trainerMode ? "Exit trainer mode" : "Trainer sign-in"}
            style={{ background: trainerMode ? RED : "transparent", border: `1px solid ${trainerMode ? RED : LINE}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer" }}>
            {trainerMode ? <Unlock size={13} color={PAPER} /> : <Lock size={13} color={MUTED} />}
            <span style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.12em", color: trainerMode ? PAPER : MUTED }} className="uppercase hdr-label">
              Trainer
            </span>
          </button>
          {session && (
            <button onClick={() => setShowAccount((v) => !v)} aria-label="Account menu" title={profile.name || "Account"}
              style={{ width: 30, height: 30, borderRadius: 99, overflow: "hidden", border: `1px solid ${showAccount ? RED : LINE}`, background: SURFACE2, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {profile.avatar
                ? <img src={profile.avatar} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ ...fontDisplay, color: RED, fontSize: 13 }}>{(profile.name || "A")[0].toUpperCase()}</span>}
            </button>
          )}
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

      {/* account menu */}
      {showAccount && session && (
        <div style={{ position: "fixed", top: 60, right: 14, zIndex: 90, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, width: 235 }}>
          <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{profile.name?.trim() || "Athlete"}</div>
          <div style={{ ...fontBody, color: MUTED, fontSize: 11, marginBottom: 10 }}>
            Signed in{session.provider !== "guest" ? ` with ${session.provider === "google" ? "Google" : "Apple"}` : " as guest"}
          </div>
          <div className="space-y-2">
            <PhotoPick label={profile.avatar ? "Change photo" : "Set profile photo"} icon={ImagePlus}
              onPick={(p) => { setProfile({ ...profile, avatar: p }); }} />
            <Btn variant="ghost" onClick={() => { setSession(null); setShowAccount(false); }} style={{ width: "100%", justifyContent: "center" }}>
              Sign out
            </Btn>
          </div>
        </div>
      )}

      {/* content */}
      <main className="px-4 pt-5 mx-auto" style={{ maxWidth: page === "home" && tab === "fuel" ? 980 : 640, paddingBottom: 96 }}>
        {!loaded ? (
          <div className="flex items-center gap-2 justify-center pt-16" style={{ ...fontMono, color: MUTED, fontSize: 13 }}>
            <RefreshCw size={14} className="animate-spin" /> loading…
          </div>
        ) : page !== "home" ? (
          <>
            {page === "about" && <AboutPage onStart={() => { setPage("home"); setTab("profile"); }} />}
            {page === "faq" && <FaqPage onStart={() => setPage("pricing")} />}
            {page === "pricing" && (
              <PricingPage plan={plan} setPlan={setPlan} profile={profile} setProfile={setProfile}
                trainerCfg={trainerCfg} addBooking={addBooking} />
            )}
          </>
        ) : (
          <>
            {tab === "profile" && (
              <ProfileTab profile={profile} setProfile={setProfile} progress={progress} setProgress={setProgress}
                session={session} onSignOut={() => setSession(null)} />
            )}
            {tab === "train" && (
              <WorkoutsTab trainerMode={trainerMode} videos={videos} addVideo={addVideo} removeVideo={removeVideo}
                customSplit={customSplit} setCustomSplit={setCustomSplit} profile={profile} snaps={snaps} addSnap={addSnap} />
            )}
            {tab === "fuel" && <DietTab profile={profile} dietPrefs={dietPrefs} setDietPrefs={setDietPrefs} dietPlan={dietPlan} setDietPlan={setDietPlan} snaps={snaps} addSnap={addSnap} />}
            {tab === "track" && (
              <AccountabilityTab commitments={commitments} setCommitments={setCommitments}
                dailyLog={dailyLog} setDailyLog={setDailyLog} profile={profile} />
            )}
            {tab === "groups" && <GroupsTab profile={profile} posts={posts} setPosts={setPosts} interests={interests} setInterests={setInterests} />}

            {/* SEO / GEO footer — profile tab only */}
            {tab === "profile" && (
              <footer style={{ marginTop: 36, borderTop: `1px solid ${LINE}`, paddingTop: 18 }}>
                <p style={{ ...fontBody, color: MUTED, fontSize: 12, lineHeight: 1.6, marginTop: 0 }}>
                  {SEO_DESC}
                </p>
                <p style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 10 }}>
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

      {/* login gate — shown until signed in */}
      {loaded && !session && <LoginGate onLogin={(provider) => setSession({ provider, at: Date.now() })} />}
    </div>
  );
}
