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

/* tiny camera button — photo or short video, for per-exercise form checks */
function TinySnap({ onSave }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*,video/*" style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) { return; }
          try {
            if (f.type.startsWith("video/")) {
              if (f.size > 1500000) {
                alert("That video is too big to store in the app — text it to your coach for the form check.");
              } else {
                const r = new FileReader();
                r.onload = () => onSave(r.result, true);
                r.readAsDataURL(f);
              }
            } else {
              onSave(await compressImage(f, 500, 0.65), false);
            }
          } catch { alert("Couldn't read that file."); }
          e.target.value = "";
        }} />
      <button onClick={() => ref.current?.click()} title="Upload a photo or short video for a form check" aria-label="Upload a form-check photo or video"
        style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 7, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
        <Camera size={13} color={RED} />
      </button>
    </>
  );
}

const SnapThumb = ({ x, size = 26 }) => x.video ? (
  <video src={x.photo} muted playsInline style={{ width: size, height: size, objectFit: "cover", borderRadius: 6, border: `1px solid ${LINE}` }} />
) : (
  <img src={x.photo} alt={x.label || "snap"} style={{ width: size, height: size, objectFit: "cover", borderRadius: 6, border: `1px solid ${LINE}` }} />
);

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
        <span style={{ position: "absolute", bottom: 0, right: 0, background: RED, borderRadius: 99, width: 27, height: 27, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${SURFACE}` }}>
          <Camera size={15} color="#fff" />
        </span>
      </button>
      <div>
        <div style={{ ...fontBody, color: PAPER, fontSize: 14, fontWeight: 600 }}>{name?.trim() || "Your profile"}</div>
        <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>Tap the photo to change it</div>
      </div>
    </div>
  );
}

const GRID_HINTS = [["Goal", "Post your goals"], ["Progress", "Share your progress"], ["Meal", "Log your meals"], ["Workout", "Post a workout"], ["Thought", "Drop a thought"], ["Goal", "Anything on your mind"]];

function BodyCompCard({ profile }) {
  const [bmiNote, setBmiNote] = useState("");
  const [bmiLoading, setBmiLoading] = useState(false);
  const [bmiPhotos, setBmiPhotos] = useState({ front: null, back: null, side: null });
  const h = parseFloat(profile.heightIn) || 0;
  const w = parseFloat(profile.weightLb) || 0;
  const bmi = h > 0 && w > 0 ? (703 * w) / (h * h) : null;
  const bmiCat = !bmi ? "" : bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy range" : bmi < 30 ? "Overweight" : "Obese range";
  const picCount = [bmiPhotos.front, bmiPhotos.back, bmiPhotos.side].filter(Boolean).length;
  const PlatformLogo = getPlatform(profile.aiPlatform).Logo;

  const aiBmi = async () => {
    setBmiLoading(true);
    setBmiNote("");
    const pics = [bmiPhotos.front, bmiPhotos.back, bmiPhotos.side].filter(Boolean);
    try {
      const prompt = `You are an encouraging but honest personal-training assistant doing a body-composition check-in.
Client stats: height ${Math.floor(h / 12)}'${Math.round(h % 12)}\", weight ${w} lb, BMI ${bmi.toFixed(1)} (${bmiCat}). Goal: ${profile.goal || "general fitness"}. Trains 6 days/week (push/pull split with an optional Hyrox/CrossFit-style conditioning day).
${pics.length > 0 ? `${pics.length} physique photo${pics.length > 1 ? "s are" : " is"} attached (from the front/back/side set). Use them to give a visual estimate of body-fat percentage range and where they carry muscle vs fat, and explain how that changes the BMI interpretation (muscular people often read 'overweight' on BMI).` : "No photos attached — interpret the BMI number alone and note its limits."}
In 4-5 short sentences: give your assessment, then one concrete recommendation toward their goal. Plain language, no headers or bullet points. Note this is a visual estimate, not a medical measurement.`;
      const content = [...pics.map(dataUrlToImageBlock), { type: "text", text: prompt }];
      const txt = await askClaude([{ role: "user", content }], 1000);
      setBmiNote(txt);
    } catch {
      /* built-in engine takes over when external AI is unavailable */
      setBmiNote(localBmiInsight(bmi, bmiCat, profile.goal, pics.length, h, w));
    }
    setBmiLoading(false);
  };

  return (
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
  );
}

function WeighInsCard({ profile, setProfile, progress, setProgress }) {
  const [newWeight, setNewWeight] = useState("");
  const [newPhoto, setNewPhoto] = useState(null);
  const addWeighIn = () => {
    const wt = parseFloat(newWeight);
    if (!wt) { alert("Enter a weight first."); return; }
    const entry = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), weight: wt, photo: newPhoto };
    setProgress([entry, ...progress].slice(0, 30)); // keep last 30 to stay under storage limits
    setNewWeight("");
    setNewPhoto(null);
    setProfile({ ...profile, weightLb: String(wt) });
  };

  const delta = progress.length >= 2 ? (progress[0].weight - progress[progress.length - 1].weight) : null;

  return (
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
  );
}

function SettingsPanel({ profile, setProfile, onClose }) {
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", zIndex: 95 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: SURFACE, borderTop: `2px solid ${RED}`, borderRadius: "18px 18px 0 0", padding: 20, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between">
          <Eyebrow>Settings</Eyebrow>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 8, padding: 6, cursor: "pointer" }}>
            <X size={16} color={PAPER} />
          </button>
        </div>
        <div className="mt-4">
          <div style={{ ...fontDisplay, color: RED, fontSize: 11, letterSpacing: "0.18em" }} className="uppercase">Your AI platform</div>
          <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            Pick the AI you use — its icon becomes the AI button in the top bar. ChatGPT is the default and opens your account with your "pd performance" folder.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap items-center">
            {AI_PLATFORMS.map((p) => {
              const active = (profile.aiPlatform || "chatgpt") === p.id;
              const L = p.Logo;
              return (
                <button key={p.id} title={p.name} onClick={() => setProfile({ ...profile, aiPlatform: p.id })}
                  style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", background: active ? SURFACE2 : "transparent", border: `1px solid ${active ? RED : LINE}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <L s={14} />
                </button>
              );
            })}
            <span style={{ ...fontDisplay, color: RED, fontSize: 10, letterSpacing: "0.15em", marginLeft: 4 }} className="uppercase">
              {getPlatform(profile.aiPlatform).name}
            </span>
          </div>
        </div>
        <div className="mt-5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
          <div style={{ ...fontDisplay, color: RED, fontSize: 11, letterSpacing: "0.18em" }} className="uppercase">Integrations</div>
          <p style={{ ...fontBody, color: MUTED, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
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
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* TAB 1 — PROFILE                                                        */
/* ====================================================================== */
function ProfileTab({ profile, setProfile, posts, setPosts }) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [composeTag, setComposeTag] = useState(null);
  const [postText, setPostText] = useState("");
  const [postPhoto, setPostPhoto] = useState(null);

  const publish = () => {
    if (!postText.trim() && !postPhoto) return;
    setPosts([{ id: Date.now().toString(), author: draft.name?.trim() || "Anonymous athlete", tag: composeTag || "Goal", text: postText.trim(), photo: postPhoto, likes: 0, date: new Date().toISOString() }, ...posts].slice(0, 40));
    setPostText(""); setPostPhoto(null); setComposeTag(null);
  };

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

      {/* your posts — instagram-style grid */}
      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>Your posts</Eyebrow>
          <span style={{ ...fontMono, color: MUTED, fontSize: 11 }}>{posts.length} post{posts.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {posts.map((p) => (
            <div key={p.id} style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: SURFACE2, border: `1px solid ${LINE}` }}>
              {p.photo ? (
                <img src={p.photo} alt={p.tag} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ padding: 8 }}>
                  <div style={{ ...fontDisplay, color: RED, fontSize: 9, letterSpacing: "0.14em" }} className="uppercase">{p.tag}</div>
                  <div style={{ ...fontBody, color: PAPER, fontSize: 10.5, lineHeight: 1.4, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }}>{p.text}</div>
                </div>
              )}
            </div>
          ))}
          {GRID_HINTS.slice(0, Math.max(0, 6 - posts.length)).map(([tg, hint]) => (
            <button key={hint} onClick={() => setComposeTag(tg)}
              style={{ aspectRatio: "1", borderRadius: 8, background: "transparent", border: `1px dashed ${LINE}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 6 }}>
              <Plus size={14} color={MUTED} style={{ opacity: 0.55 }} />
              <span style={{ ...fontBody, color: MUTED, fontSize: 10, textAlign: "center", opacity: 0.65, lineHeight: 1.35 }}>{hint}</span>
            </button>
          ))}
        </div>
        {composeTag !== null && (
          <div className="mt-4" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
            <div className="flex gap-2 flex-wrap">
              {POST_TAGS.map((t) => (
                <button key={t} onClick={() => setComposeTag(t)}
                  style={{ ...fontDisplay, fontSize: 11, letterSpacing: "0.12em", padding: "5px 12px", borderRadius: 99, cursor: "pointer", background: composeTag === t ? RED : "transparent", color: composeTag === t ? PAPER : MUTED, border: `1px solid ${composeTag === t ? RED : LINE}` }} className="uppercase">
                  {t}
                </button>
              ))}
            </div>
            <textarea style={{ ...inputStyle, marginTop: 12, minHeight: 70, resize: "vertical" }}
              placeholder={composeTag === "Goal" ? "This month I'm committing to…" : composeTag === "Meal" ? "Tonight's high-protein dinner…" : "Share it with the community…"}
              value={postText} onChange={(e) => setPostText(e.target.value)} />
            {postPhoto && (
              <div className="mt-2 flex items-center gap-2">
                <img src={postPhoto} alt="Post preview" style={{ maxHeight: 90, borderRadius: 10, border: `1px solid ${LINE}` }} />
                <button onClick={() => setPostPhoto(null)} style={{ ...fontBody, background: "none", border: "none", color: MUTED, fontSize: 12, cursor: "pointer" }}>remove</button>
              </div>
            )}
            <div className="flex gap-3 mt-3">
              <PhotoPick label="Photo" icon={ImagePlus} onPick={setPostPhoto} />
              <Btn onClick={publish} style={{ flex: 1, justifyContent: "center" }}>Post it</Btn>
              <Btn variant="ghost" onClick={() => setComposeTag(null)}>Cancel</Btn>
            </div>
            <p style={{ ...fontBody, color: MUTED, fontSize: 11, marginTop: 8 }}>Posts show here and in the Community feed — visible to everyone in the program.</p>
          </div>
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

function ExerciseRow({ ex, inSuperset, snaps, addSnap, dayLabel }) {
  const label = `${dayLabel} · ${ex.name}`;
  const mine = (snaps || []).filter((x) => x.type === "workout" && x.label === label).slice(0, 3);
  return (
    <div className="flex items-center justify-between"
      style={{ background: inSuperset ? "transparent" : SURFACE, border: inSuperset ? "none" : `1px solid ${LINE}`, borderRadius: inSuperset ? 0 : 10, padding: "10px 12px" }}>
      <div>
        <div style={{ ...fontBody, color: PAPER, fontSize: 13, fontWeight: 600 }}>{ex.name}</div>
        <div style={{ ...fontBody, color: MUTED, fontSize: 11 }}>{ex.note}</div>
        {mine.length > 0 && (
          <div className="flex gap-1 mt-1">
            {mine.map((x) => <SnapThumb key={x.id} x={x} />)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2" style={{ marginLeft: 10 }}>
        <div style={{ ...fontMono, color: RED, fontSize: 12, whiteSpace: "nowrap" }}>
          {ex.sets} × {ex.reps}
        </div>
        <TinySnap onSave={(data, vid) => addSnap("workout", data, label, vid)} />
      </div>
    </div>
  );
}

function ExerciseList({ exercises, snaps, addSnap, dayLabel }) {
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
          <ExerciseRow ex={a} inSuperset snaps={snaps} addSnap={addSnap} dayLabel={dayLabel} />
          <div className="flex items-center" style={{ gap: 8, padding: "0 12px" }}>
            <div style={{ flex: 1, borderTop: `1px dashed ${LINE}` }} />
            <Link2 size={12} color={RED} />
            <div style={{ flex: 1, borderTop: `1px dashed ${LINE}` }} />
          </div>
          <ExerciseRow ex={b} inSuperset snaps={snaps} addSnap={addSnap} dayLabel={dayLabel} />
        </div>
      );
      i++;
    } else {
      rows.push(<ExerciseRow key={i} ex={a} snaps={snaps} addSnap={addSnap} dayLabel={dayLabel} />);
    }
  }
  return <div className="mt-3 space-y-2">{rows}</div>;
}

/* ---------- client-side PDF export (brand header, letter size) ---------- */
const PD_LOGO_B64 = "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wPi4z9vd3dOdkOiIiIiIaEF5N/lcvXpVhaJkFoZCwagXCoIAXQ+hp6e35dChQwMJi5DmFGt7EhERUTKJAOB2u1BZWV0jihKMVrqLoohwOISWlpbXjh07PpHQKImIiIhoQZAAID+/QFq+fPl6wLhTTJzccbO7u2uf1+s1Xg5PKY+9nkRERDRfRAAoKChIX7q04sLItprR8w5BEDE+7gt3d3d3+P3+RMZIc4QLjYiIiCjZRAAoKSleVFhYuMrvNxtN13HkyOGDra1tHQmKjYiIiIgWGEkUHVi7dt1qQICu6xCEM3s+BUGAKIo4ePDQ9v7+gbEkxElzYPpwerSeUA65ExER0XySMjMzhDVr1pxvdlEk+ZRw5MiRA8PDw4FEBUfzK55klIiIiGguiZmZmWJdXc1fBoMTUXs9gUjy6fdPoKura9/Y2BgXGy1Q7PUkIiKi+SYWFxenl5cvXTcxYV496ciRvr59+1r2me37TkREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQ09/4/tSM/m3WBp8cAAAAASUVORK5CYII=";
function pdfClean(t) {
  return String(t).replace(/\u2192/g, "->").replace(/[^\x20-\x7E\u00B7\u00D7\u2013\u2014\u2018\u2019\u201C\u201D]/g, "");
}
const PDF_INK = [10, 10, 11], PDF_PAPER = [245, 245, 242], PDF_MUTED = [169, 169, 178], PDF_RED = [217, 4, 41], PDF_HAIR = [45, 45, 50];
const PD_LOGO_DARK_B64 = "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3OwnbE6l+bWIovCJPXse/7mJickXT0xseQcgD5VS+FLKyeVk1FobxrF9IEniR8Nw6Z9nZ/d9IkmSp2KSUm43xlyR9XukBJaWmldYG5crDTBCOORORERE62FVQlGrjR9y0EGHamvjzDH0KIp+tG/fngvDsNm1rqVS7o5abewMpdwTgSQ2xtwbRVEQReEDSTKc7Scdx5nyvLFjXVc9Qwh1qBDJfBg272g2m3fEsVnXntdRUXTIncknERERrYdVPZ+eVzsNSDITz1Z5JbvH2vjJtGuMiZ40JroKwFXrEOe6iON4dnFx/pbFRdwy7FiIiIiINqNVSabneS/Lm++ZJAniOL4jjuOUEks0CtjrSURERIN2QPIppRCe552b9yBrbWhMeGWvheCJiIiIaHM6IPlUytsqxPJOP+mSJAmjKErb85U2EPZ6EhER0Xo6IPl0XfcoIDko6wHtmpb74zjmVlEjjLU9iYiIaBg6ks/aOYCo5z3ImOi2OO59C0wiIiIi2pyeSj6FEMJ1vWfmFWO31tooir7Wz/qcVA0cciciIqL19lTy6TjumJTOsctF47tZTkyNMbf2PzTqFw65ExER0bA8lXwqpXZKKU7Ke4C1diGOzYP9DYuIiIiINqKVyeeRUsrDsqonJQkQx9H3jYkeG0h0tO5Y25OIiIiG6ank0/O8k4XI3NgIQAJjoquttc0+x0VEREREG5AEAMdxlFLuWdk14wVayWd8J5Bkb4FEI429nkRERNQv7eRTjTuOc372YiMgSWDjOP4R9zUaTVxoRERERMO23PO5VUrn+LzdMuM4vi+Oox8NJDIiIiIi2nAUALhu7QQpJeI4vXRnkiQwJroxjuO5gUVH66pzOL1bTyiH3ImIiKiflJRCuK57bt5QuhACcRzfa62NBhMa9VuRZJSIiIhoPUkhpHQc9xVJzhoiaxMYY+5M8i6kkcVeTyIiIuo36Thq3HXdM/Lne5pHjInuHFBcRERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERt/x/hi3G8aNM23wAAAABJRU5ErkJggg==";
const pdfPal = (light) => light
  ? { bg: [255, 255, 255], text: [28, 28, 30], muted: [112, 112, 118], hair: [222, 222, 224], logo: PD_LOGO_DARK_B64 }
  : { bg: PDF_INK, text: PDF_PAPER, muted: PDF_MUTED, hair: PDF_HAIR, logo: PD_LOGO_B64 };
function pdfDecorate(doc, pal) {
  doc.setFillColor(pal.bg[0], pal.bg[1], pal.bg[2]); doc.rect(0, 0, 612, 792, "F");
  doc.setDrawColor(pal.hair[0], pal.hair[1], pal.hair[2]); doc.setLineWidth(0.7); doc.line(54, 748, 558, 748);
  try { doc.addImage("data:image/png;base64," + pal.logo, "PNG", 54, 756, 90, 19); } catch (e) {}
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(pal.muted[0], pal.muted[1], pal.muted[2]);
  doc.text(String(doc.getNumberOfPages()), 558, 769, { align: "right" });
}
function pdfDoc(title, subtitle, light) {
  const pal = pdfPal(light);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  pdfDecorate(doc, pal);
  doc.setFont("helvetica", "bold"); doc.setFontSize(21); doc.setTextColor(pal.text[0], pal.text[1], pal.text[2]);
  doc.text(pdfClean(title).toUpperCase(), 54, 76);
  doc.setFillColor(PDF_RED[0], PDF_RED[1], PDF_RED[2]); doc.rect(54, 86, 108, 3, "F");
  const st = { doc, y: 112, pal };
  if (subtitle) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(pal.muted[0], pal.muted[1], pal.muted[2]);
    const ls = doc.splitTextToSize(pdfClean(subtitle), 504);
    doc.text(ls, 54, st.y);
    st.y += ls.length * 13 + 10;
  }
  return st;
}
function pdfLine(st, txt, o = {}) {
  if (st.y > 722) { st.doc.addPage(); pdfDecorate(st.doc, st.pal); st.y = 64; }
  const doc = st.doc;
  doc.setFont("helvetica", o.bold ? "bold" : "normal");
  doc.setFontSize(o.size || 10);
  if (o.red) doc.setTextColor(PDF_RED[0], PDF_RED[1], PDF_RED[2]);
  else if (o.muted) doc.setTextColor(st.pal.muted[0], st.pal.muted[1], st.pal.muted[2]);
  else doc.setTextColor(st.pal.text[0], st.pal.text[1], st.pal.text[2]);
  const lines = doc.splitTextToSize(pdfClean(txt), o.indent ? 480 : 504);
  doc.text(lines, o.indent ? 76 : 54, st.y);
  if (o.bullet) { doc.setFillColor(PDF_RED[0], PDF_RED[1], PDF_RED[2]); doc.circle(66, st.y - 3, 1.8, "F"); }
  st.y += lines.length * (o.size || 10) * 1.45 + (o.gap ?? 5);
}
function downloadSplitPdf(activeSplit, isCustom, light, preview) {
  const st = pdfDoc("Weekly Training Split",
    "pd / performance · Swap any exercise for a similar one that hits the same muscle — these are guidelines to look, feel, and perform better. Intensity and consistency matter most.", light);
  activeSplit.forEach((d) => {
    pdfLine(st, `${d.day.toUpperCase()} — ${d.focus.toUpperCase()}`, { red: true, bold: true, size: 12, gap: 4 });
    if (d.hyrox && !isCustom) {
      HYROX.forEach((h) => pdfLine(st, `Run ${h.run} -> ${h.station} · ${h.detail}`, { indent: true, bullet: true, gap: 3 }));
    }
    if (d.exercises && d.exercises.length) {
      d.exercises.forEach((ex) => {
        pdfLine(st, `${ex.name} — ${ex.sets} × ${ex.reps}`, { indent: true, bullet: true, gap: 0.5 });
        if (ex.note) pdfLine(st, ex.note, { indent: true, muted: true, size: 8.5, gap: 4 });
      });
    }
    if ((!d.exercises || !d.exercises.length) && !d.hyrox) {
      pdfLine(st, d.tag || (d.day === "Sunday" ? "Full rest — walk, stretch, sleep, hydrate. Recovery is where the growth happens." : `${d.focus} session.`), { indent: true, muted: true });
    }
    st.y += 8;
  });
  pdfLine(st, "CARDIO & ABS", { red: true, bold: true, size: 12, gap: 4 });
  pdfLine(st, "Warm-up cardio, every workout — 1 mile chill run or 15 min on the stair stepper.", { indent: true, bullet: true });
  pdfLine(st, "Abs every day except leg days (Monday & Thursday) — pick 2–3 core moves, 3 sets each.", { indent: true, bullet: true });
  if (preview) window.open(st.doc.output("bloburl"), "_blank");
  else st.doc.save("pd-workout-plan.pdf");
}
function downloadDietPdf(dietPlan, prefs, profile, light, preview) {
  const st = pdfDoc("Weekly Meal Plan",
    `pd / performance · Goal: ${prefs.dietGoal} · ${prefs.mealsPerDay} meals per day${profile?.weightLb ? ` · ${profile.weightLb} lb` : ""}`, light);
  dietPlan.split("\n").forEach((ln) => {
    const t = ln.trim();
    if (!t) { st.y += 5; return; }
    if (/^[A-Z][A-Z \/&'\u2019-]{3,}$/.test(t)) { st.y += 4; pdfLine(st, t, { red: true, bold: true, size: 12, gap: 4 }); }
    else if (/^meal \d/i.test(t)) pdfLine(st, t, { indent: true, bullet: true, gap: 3 });
    else pdfLine(st, t, { gap: 4 });
  });
  if (preview) window.open(st.doc.output("bloburl"), "_blank");
  else st.doc.save("pd-meal-plan.pdf");
}

function WorkoutsTab({ trainerMode, videos, addVideo, removeVideo, customSplit, setCustomSplit, profile, snaps, addSnap }) {
  const [openDay, setOpenDay] = useState(null);
  const [splitPdfLight, setSplitPdfLight] = useState(true);
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
                {building ? "Building…" : customSplit ? "Rebuild in app" : "Quick-build in app"}
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
                        {d.exercises && d.exercises.length > 0 && <ExerciseList exercises={d.exercises} snaps={snaps} addSnap={addSnap} dayLabel={d.day} />}
                      </>
                    ) : d.exercises && d.exercises.length > 0 ? (
                      <ExerciseList exercises={d.exercises} snaps={snaps} addSnap={addSnap} dayLabel={d.day} />
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

                    <div className="mt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: `1px dashed ${LINE}`, paddingTop: 10 }}>
                      <PhotoPick label="Snap this workout" onPick={(p) => addSnap("workout", p, `${d.day} — ${d.focus}`)} />
                      {(snaps || []).filter((x) => x.type === "workout" && x.label === `${d.day} — ${d.focus}`).slice(0, 5).map((x) => (
                        <div key={x.id} style={{ textAlign: "center" }}>
                          <img src={x.photo} alt="workout snap" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />
                          <div style={{ ...fontBody, color: MUTED, fontSize: 8, marginTop: 1 }}>{x.date.slice(5)}</div>
                        </div>
                      ))}
                    </div>

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

        <div className="mt-4 flex items-center gap-2 flex-wrap" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          <Btn onClick={() => downloadSplitPdf(activeSplit, !!customSplit, splitPdfLight, false)}>
            <Download size={14} /> Download PDF
          </Btn>
          <Btn variant="ghost" onClick={() => downloadSplitPdf(activeSplit, !!customSplit, splitPdfLight, true)}>
            Preview
          </Btn>
          <div className="flex" style={{ border: `1px solid ${LINE}`, borderRadius: 99, overflow: "hidden" }}>
            {["White", "Dark"].map((m) => {
              const on = (m === "White") === splitPdfLight;
              return (
                <button key={m} onClick={() => setSplitPdfLight(m === "White")} className="uppercase"
                  style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.1em", padding: "7px 12px", border: "none", cursor: "pointer", background: on ? RED : "transparent", color: on ? "#fff" : MUTED }}>
                  {m}
                </button>
              );
            })}
          </div>
          <span style={{ ...fontBody, color: MUTED, fontSize: 10.5 }}>White = printer-friendly</span>
        </div>
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
  const [dietPdfLight, setDietPdfLight] = useState(true);
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
                const mealKey = (ci > 0 ? t.slice(0, ci) : t).replace(/\s*\(.*\)/, "");
                const mealSnaps = (snaps || []).filter((x) => x.type === "meal" && x.label === mealKey).slice(0, 4);
                return (
                  <div key={i} style={{ background: SURFACE2, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                    <span style={{ ...fontBody, color: RED, fontSize: 12.5, fontWeight: 600 }}>{ci > 0 ? t.slice(0, ci + 1) : ""} </span>
                    <span style={{ ...fontBody, color: PAPER, fontSize: 12.5, lineHeight: 1.6 }}>{ci > 0 ? t.slice(ci + 1) : t}</span>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <TinySnap onSave={(data, vid) => addSnap("meal", data, mealKey, vid)} />
                      {mealSnaps.map((x) => (
                        <div key={x.id} style={{ textAlign: "center" }}>
                          <SnapThumb x={x} size={36} />
                          <div style={{ ...fontBody, color: MUTED, fontSize: 8, marginTop: 1 }}>{x.date.slice(5)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return <p key={i} style={{ ...fontBody, color: PAPER, fontSize: 13, lineHeight: 1.75, margin: "0 0 10px" }}>{t}</p>;
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
            <Btn onClick={() => downloadDietPdf(dietPlan, prefs, profile, dietPdfLight, false)}>
              <Download size={14} /> Download PDF
            </Btn>
            <Btn variant="ghost" onClick={() => downloadDietPdf(dietPlan, prefs, profile, dietPdfLight, true)}>
              Preview
            </Btn>
            <div className="flex" style={{ border: `1px solid ${LINE}`, borderRadius: 99, overflow: "hidden" }}>
              {["White", "Dark"].map((m) => {
                const on = (m === "White") === dietPdfLight;
                return (
                  <button key={m} onClick={() => setDietPdfLight(m === "White")} className="uppercase"
                    style={{ ...fontDisplay, fontSize: 10, letterSpacing: "0.1em", padding: "7px 12px", border: "none", cursor: "pointer", background: on ? RED : "transparent", color: on ? "#fff" : MUTED }}>
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
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

function PhotoHistoryCard({ snaps, dailyLog, progress }) {
  const items = [
    ...(snaps || []).map((x) => ({ id: "s" + x.id, date: x.date, photo: x.photo, video: x.video, label: `${x.type === "meal" ? "Meal" : "Workout"}${x.label ? ` · ${x.label}` : ""}` })),
    ...Object.entries(dailyLog || {}).filter(([, v]) => v && v.photo).map(([d, v]) => ({ id: "d" + d, date: d, photo: v.photo, label: "Daily check-in" })),
    ...(progress || []).filter((p) => p.photo).map((p) => ({ id: "p" + p.id, date: p.date, photo: p.photo, label: `Weigh-in · ${p.weight} lb` })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  const groups = {};
  items.forEach((it) => { const m = it.date.slice(0, 7); (groups[m] = groups[m] || []).push(it); });
  const monthName = (m) => new Date(m + "-15T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow>Photo history</Eyebrow>
        <Camera size={14} color={RED} />
      </div>
      {items.length === 0 ? (
        <p style={{ ...fontBody, color: MUTED, fontSize: 12.5, marginTop: 8, lineHeight: 1.6 }}>
          Every photo you upload — workout snaps, meal snaps, daily check-ins, weigh-ins — collects here so you can watch the change build over weeks and months.
        </p>
      ) : (
        Object.entries(groups).map(([m, arr]) => (
          <div key={m} className="mt-3">
            <div style={{ ...fontDisplay, color: MUTED, fontSize: 10, letterSpacing: "0.16em" }} className="uppercase">{monthName(m)} · {arr.length}</div>
            <div className="mt-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {arr.map((it) => (
                <div key={it.id}>
                  {it.video ? (
                    <video src={it.photo} muted playsInline controls style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />
                  ) : (
                    <img src={it.photo} alt={it.label} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />
                  )}
                  <div style={{ ...fontBody, color: MUTED, fontSize: 8.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.date.slice(5)} · {it.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

const LOG_ITEMS = [["workout", "Workout"], ["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"]];

function AccountabilityTab({ commitments, setCommitments, dailyLog, setDailyLog, profile, setProfile, progress, setProgress, snaps }) {
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

      <BodyCompCard profile={profile} />
      <WeighInsCard profile={profile} setProfile={setProfile} progress={progress} setProgress={setProgress} />

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

      <PhotoHistoryCard snaps={snaps} dailyLog={dailyLog} progress={progress} />
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
    { v: "naJ-kDaaJns", t: "A new world champion — HYROX Elite 15 men's highlights", c: "HYROX" },
  ],
  Running: [
    { v: "dSRXMRkZM9U", t: "I ran the NYC Marathon — my first marathon ever", c: "Jen Lauren" },
    { v: "yqMYMu4Q2pM", t: "How To Prepare For An Ironman Triathlon", c: "Global Triathlon Network" },
    { v: "ZNs2qTXlRfg", t: "How to improve your VO₂ max as a beginner", c: "Peter Attia MD" },
  ],
  Athleticism: [
    { v: "7FYEeFt9PD8", t: "How To Jump Higher In Less Than 5 Minutes", c: "Isaiah Rivera" },
    { v: "jWJhJaXDo38", t: "Sprint Workout To Run Faster (approved by an Olympian)", c: "The Sprint Project" },
  ],
  Highlights: [
    { v: "YPl4kVPw8IY", t: "Greatest world records in sport history", c: "Wave of Trend" },
    { v: "Xw6k6Ma0oqo", t: "Royal Family — World of Dance front row", c: "Official World of Dance" },
  ],
};

function GroupsTab({ profile, posts, setPosts, interests, setInterests }) {
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

      {posts.length === 0 ? (
        <Card>
          <p style={{ ...fontBody, color: MUTED, fontSize: 13 }}>
            Nothing here yet — share your first post from the grid on your Profile tab.
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

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, loading]);

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
          <span style={{ ...fontDisplay, fontStyle: "italic", color: PAPER, fontSize: 27, fontWeight: 400, textTransform: "lowercase" }}>pd</span>
          <span style={{ color: RED, fontWeight: 700, fontSize: 22, transform: "skewX(-12deg)", display: "inline-block" }} aria-hidden="true">/</span>
          <span style={{ ...fontDisplay, color: PAPER, fontSize: 22, fontWeight: 400, letterSpacing: "0.18em" }}>PERFORMANCE</span>
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
  const [showSettings, setShowSettings] = useState(false);
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
  const addSnap = (type, photo, label, video) => {
    const next = [{ id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), type, photo, label: label || "", video: !!video }, ...snaps];
    const vids = next.filter((x) => x.video);
    const drop = new Set(vids.slice(3).map((x) => x.id));
    setSnaps(next.filter((x) => !drop.has(x.id)).slice(0, 30));
  };

  /* lock page scroll while the coach overlay is open */
  useEffect(() => {
    document.body.style.overflow = showCoach ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showCoach]);

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
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Great+Vibes&display=swap');
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
          <span className="brand-a" style={{ ...fontDisplay, fontStyle: "italic", color: PAPER, fontSize: 24, fontWeight: 400, letterSpacing: "0.04em", textTransform: "lowercase" }}>pd</span>
          <span className="brand-slash" style={{ color: RED, fontWeight: 700, fontSize: 20, transform: "skewX(-12deg)", display: "inline-block" }} aria-hidden="true">/</span>
          <span className="brand-b" style={{ ...fontDisplay, color: PAPER, fontSize: 20, fontWeight: 400, letterSpacing: "0.18em" }}>PERFORMANCE</span>
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
            <Btn variant="ghost" onClick={() => { setShowSettings(true); setShowAccount(false); }} style={{ width: "100%", justifyContent: "center" }}>
              <Settings size={14} /> Settings
            </Btn>
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
              <ProfileTab profile={profile} setProfile={setProfile} posts={posts} setPosts={setPosts} />
            )}
            {tab === "train" && (
              <WorkoutsTab trainerMode={trainerMode} videos={videos} addVideo={addVideo} removeVideo={removeVideo}
                customSplit={customSplit} setCustomSplit={setCustomSplit} profile={profile} snaps={snaps} addSnap={addSnap} />
            )}
            {tab === "fuel" && <DietTab profile={profile} dietPrefs={dietPrefs} setDietPrefs={setDietPrefs} dietPlan={dietPlan} setDietPlan={setDietPlan} snaps={snaps} addSnap={addSnap} />}
            {tab === "track" && (
              <AccountabilityTab commitments={commitments} setCommitments={setCommitments}
                dailyLog={dailyLog} setDailyLog={setDailyLog} profile={profile}
                setProfile={setProfile} progress={progress} setProgress={setProgress} snaps={snaps} />
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
      {showSettings && <SettingsPanel profile={profile} setProfile={setProfile} onClose={() => setShowSettings(false)} />}

      {/* login gate — shown until signed in */}
      {loaded && !session && <LoginGate onLogin={(provider) => setSession({ provider, at: Date.now() })} />}
    </div>
  );
}
