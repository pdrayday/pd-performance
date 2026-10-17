/* ======================================================================
   pd / performance — coach-assigned client programs
   ----------------------------------------------------------------------
   Send a client their link:  https://pdrayday.github.io/pd-performance/?client=<id>
   On first open (and whenever `v` is bumped) this preloads the client's
   split, diet plan and fuel prefs into the app before it mounts. Profile
   fields only fill in if they are still empty, so the client's own edits
   (weigh-ins, name) are never overwritten.
   To update a program: edit it below and bump `v`.
   ====================================================================== */
(function () {
  var PROGRAMS = {
    cj: {
      v: 1,
      profile: { name: "CJ", age: "30", heightIn: "74", weightLb: "280", goal: "Recomposition (lose fat + build muscle)" },
      dietPrefs: {
        dietGoal: "Fat loss (cut)", mealsPerDay: "3", likes: "Anything", dislikes: "", allergies: [],
        schedule: "Desk job, lunch provided at work, trains Mon/Tue/Thu/Fri",
      },
      split: {
        summary:
          "CJ's 4-day version of the coach's split: one Hyrox-style leg day, one push day, one pull day and one Hyrox + shoulders day, 60 minutes each. Weeks 1-2: learn the movements and leave 3 reps in the tank. After that, add a rep each week; once every set hits the top of the rep range, add weight. Runs are swapped for incline walking, rowing or the bike until you're under ~255 lb to protect knees and shins. Week 9 is a lighter deload week.",
        warmup:
          "10 min incline walk (3.0-3.3 mph, 6-8% incline) or the stair stepper at an easy pace. Swap in the 1 mile chill run once you're under ~255 lb.",
        abs:
          "Tuesday and Thursday after lifting: pick 2 of planks (30-45 sec), dead bugs (8/side), cable crunches (12-15) - 3 sets each. Monday and Friday skip it; the circuits cover core.",
        days: [
          {
            day: "Monday", focus: "Legs + Hyrox-lite", notes: "Hyrox-style circuit first, then lower-body strength",
            exercises: [
              { name: "Hyrox-lite circuit", sets: 3, reps: "rounds", note: "0.25 mi incline walk (or 400 m row) + sled push 2 lengths · start with 2-4 plates, add a plate when it feels easy · rest 90 sec" },
              { name: "Goblet squat to box", sets: 4, reps: "8–12", note: "first lift — solo · box at parallel · move to back squat around week 5" },
              { name: "Dumbbell Romanian deadlift", sets: 3, reps: "10–12", note: "soft knees, hips back, flat back · feel the hamstrings" },
              { name: "Hamstring curl machine", sets: 3, reps: "10–12", note: "superset with calf machine" },
              { name: "Calf machine", sets: 3, reps: "12–15", note: "superset with hamstring curls · pause at the bottom" },
            ],
          },
          {
            day: "Tuesday", focus: "Chest & Biceps", notes: "Push plus arms",
            exercises: [
              { name: "Incline dumbbell press", sets: 4, reps: "8–12", note: "first exercise — solo, no superset · top of range on every set = go up in weight" },
              { name: "Machine or flat dumbbell chest press", sets: 3, reps: "10–12", note: "superset with EZ bar curl" },
              { name: "EZ bar curl", sets: 3, reps: "10–12", note: "superset with chest press · no swinging" },
              { name: "Cable fly", sets: 3, reps: "12–15", note: "superset with hammer curl · slow negatives" },
              { name: "Hammer curl", sets: 3, reps: "10–12", note: "superset with cable fly" },
            ],
          },
          { day: "Wednesday", focus: "Rest", notes: "Active rest — hit 8-10k steps. A 30-45 min walk is the workout today." },
          {
            day: "Thursday", focus: "Back & Triceps", notes: "Pull plus arms",
            exercises: [
              { name: "Lat pulldown", sets: 4, reps: "8–12", note: "first exercise — solo, no superset · pull to upper chest" },
              { name: "Chest-supported row", sets: 3, reps: "10–12", note: "superset with rope pushdown · squeeze 1 sec" },
              { name: "Rope pushdown", sets: 3, reps: "10–15", note: "superset with chest-supported row" },
              { name: "Seated cable row", sets: 3, reps: "10–12", note: "superset with overhead cable extension · flat back" },
              { name: "Overhead cable extension", sets: 3, reps: "10–12", note: "superset with cable row · stands in for dips for now" },
            ],
          },
          {
            day: "Friday", focus: "Hyrox + Shoulders", notes: "Engine work, then delts",
            exercises: [
              { name: "Hyrox-lite station 1", sets: 1, reps: "round", note: "5 min bike or row, hard but steady + sled push 2 lengths" },
              { name: "Hyrox-lite station 2", sets: 1, reps: "round", note: "5 min bike or row + 40 wall balls (10-14 lb) — break them up · build toward 100 by month 3" },
              { name: "Seated dumbbell shoulder press", sets: 3, reps: "8–12", note: "back supported · graduates to standing military press later" },
              { name: "Rear delt fly", sets: 3, reps: "12–15", note: "superset with lateral raise · cables or fly machine" },
              { name: "Lateral raise", sets: 3, reps: "12–15", note: "superset with rear delt fly · light, strict" },
              { name: "Walking lunges", sets: 2, reps: "10/leg", note: "bodyweight — hold dumbbells once these feel easy" },
            ],
          },
          { day: "Saturday", focus: "Rest", notes: "Active rest — 8-10k steps. Optional: easy hike, bike ride or pickup sport." },
          { day: "Sunday", focus: "Rest", notes: "Full rest. Walk, stretch, sleep, hydrate — recovery is where the growth happens." },
        ],
      },
      dietPlan: [
        "Overview: CJ - 6'2\", 280 lb, estimated about 35% body fat (roughly 98 lb fat, 182 lb lean). Recomp at this starting point means a steady calorie deficit plus hard lifting: the fat comes off and, as a newer lifter, you still build muscle. Target pace is 1-1.5 lb per week - about 30 lb down by month 5 and 40+ by month 6-7. The first two weeks drop faster (water); that's normal.",
        "",
        "YOUR NUMBERS",
        "Training days (Mon, Tue, Thu, Fri): 2,500 calories · 200g protein · 265g carbs · 70g fat.",
        "Rest days (Wed, Sat, Sun): 2,250 calories · 200g protein · 205g carbs · 70g fat.",
        "Protein is the non-negotiable - 200g every day. Calories and carbs can flex a little; protein can't.",
        "Steps: 8,000 a day for the first two weeks, then 10,000. With a desk job, walking does a lot of the work. Water: about a gallon a day. Sleep: aim for 7+ hours - even 30 extra minutes helps hunger, stress and recovery.",
        "",
        "TRAINING DAYS",
        "Meal 1 (breakfast, about 550 cal, 45-50g protein): 3 eggs, 1 cup egg whites, 2 slices whole-grain toast, 1 banana",
        "Breakfast swaps: 1.5 cups nonfat Greek yogurt with a scoop of whey stirred in, 1 cup berries and 1/3 cup granola - or on the go, a 2-scoop protein shake with a banana and 1 tbsp peanut butter.",
        "Meal 2 (work lunch, about 800 cal, 55g protein): (build whatever work provides this way - two palms of protein, one fist of carbs, half the plate vegetables, sauces and dressing on the side, skip the chips and dessert; if the protein option is light, add a shake or jerky)",
        "Snack (afternoon, about 300 cal, 35g protein): this replaces grazing. A protein shake + a piece of fruit, 2 oz beef jerky + 2 string cheese, or a Greek yogurt cup + an apple.",
        "Meal 3 (dinner, about 800 cal, 60g protein): 8 oz chicken breast or 93% lean ground beef, 1.5 cups cooked rice or a large potato, 2 cups vegetables, salsa or hot sauce",
        "Rotate dinners so it never gets boring - taco bowl, burger bowl, stir-fry, sheet-pan chicken + potatoes, sirloin or salmon once a week. Same formula every time. Eat it after training when you can; it's your biggest carb meal.",
        "",
        "REST DAYS",
        "Meal 1 (breakfast): (same as training days - drop the toast or granola)",
        "Meal 2 (work lunch): (same build - carbs down to half a fist)",
        "Snack: same - protein first.",
        "Meal 3 (dinner): (same protein and vegetables - carbs cut to 3/4 cup rice or a medium potato)",
        "That trims about 250 calories, nearly all from carbs. Protein stays at 200g.",
        "",
        "GROCERY LIST",
        "Weekly, fits the $125-200 budget: 5-6 lb chicken breast, 3 lb 93% lean ground beef or turkey, 1-2 lb sirloin or salmon, 2.5 dozen eggs, 2 cartons liquid egg whites, 2 large tubs nonfat Greek yogurt, whey protein (one tub lasts about a month), oats or granola, rice, potatoes, whole-grain bread, bananas, frozen berries, 4-5 bags frozen vegetables, salsa and hot sauce, beef jerky, string cheese, peanut butter.",
        "",
        "HOW WE ADJUST",
        "Weigh in every morning after the bathroom, before food. We go by the weekly average, never a single day.",
        "Losing under 1 lb a week for 2 straight weeks: drop 150 calories, from carbs. Losing over 2.5 lb a week after week 3: add 150.",
        "Log food in an app for the first 4 weeks - that's how you learn portions. After that, the formula above is enough.",
        "One planned snack a day. Hungry outside meals? Water first, then protein (jerky, string cheese, Greek yogurt) - not chips or sweets.",
      ].join("\n"),
    },
  };

  window.PD_CLIENT_PROGRAMS = PROGRAMS;

  try {
    var id = (new URLSearchParams(window.location.search).get("client") || "").toLowerCase().trim();
    var prog = PROGRAMS[id];
    if (!prog || (window.storage && window.storage.get)) return;
    var P = "pt-web:";
    var read = function (k) { try { var v = localStorage.getItem(P + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
    var write = function (k, v) { localStorage.setItem(P + k, JSON.stringify(v)); };
    var applied = read("pt:client-applied");
    if (applied && applied.id === id && applied.v === prog.v) return;

    write("pt:custom-split", prog.split);
    write("pt:diet-plan", prog.dietPlan);
    write("pt:diet-prefs", prog.dietPrefs);

    var profile = read("pt:profile") || {};
    var defaults = { name: "", age: "", heightIn: "", weightLb: "", goal: "", addon: false, aiPlatform: "chatgpt" };
    var merged = {};
    for (var d in defaults) merged[d] = defaults[d];
    for (var p in profile) merged[p] = profile[p];
    for (var f in prog.profile) if (!merged[f]) merged[f] = prog.profile[f];
    write("pt:profile", merged);

    write("pt:client-applied", { id: id, v: prog.v, at: new Date().toISOString() });
  } catch (e) {
    /* never block the app from loading */
  }
})();
