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
      v: 3,
      profile: { name: "CJ", age: "30", heightIn: "74", weightLb: "280", goal: "Recomposition (lose fat + build muscle)" },
      dietPrefs: {
        dietGoal: "Fat loss (cut)", mealsPerDay: "3", likes: "Anything", dislikes: "", allergies: [],
        schedule: "Desk job, lunch provided at work, trains Mon/Tue/Thu/Fri",
      },
      split: {
        summary:
          "CJ's 4-day version of the coach's split: one Hyrox-style leg day, one push day, one pull day and one Hyrox + shoulders day, 60 minutes each. Add a rep each week; once every set hits the top of the rep range, add weight. Runs are swapped for the stair stepper and bike until you're under ~255 lb to protect knees and shins.",
        warmup:
          "10 min incline walk (3.0-3.3 mph, 6-8% incline) or the stair stepper at an easy pace. Swap in the 1 mile chill run once you're under ~255 lb.",
        abs:
          "Tuesday and Thursday after lifting: plank 30-45 sec, then straight into crunches (15-20). Rest 1 minute, then one more round of plank + crunches. Monday and Friday skip it; the circuits cover core.",
        days: [
          {
            day: "Monday", focus: "Legs + Hyrox-lite", notes: "Hyrox-style circuit first, then lower-body strength",
            exercises: [
              { name: "Hyrox-lite circuit", sets: 2, reps: "rounds", note: "5 min slow stair stepper + sled push 2 lengths · start with 2-4 plates, add a plate when it feels easy · rest 90 sec" },
              { name: "Smith machine squat", sets: 3, reps: "8–12", note: "first lift — solo · feet slightly forward, hips to parallel" },
              { name: "Dumbbell Romanian deadlift", sets: 3, reps: "10–12", note: "soft knees, hips back, flat back · feel the hamstrings" },
              { name: "Hamstring curl machine", sets: 3, reps: "10–12", note: "superset with standing calf raise" },
              { name: "Standing calf raise machine", sets: 3, reps: "12–15", note: "superset with hamstring curls · pause at the bottom" },
              { name: "Leg extension", sets: 3, reps: "12–15", note: "superset with seated calf raise · squeeze 1 sec at the top" },
              { name: "Seated calf raise machine", sets: 3, reps: "12–15", note: "superset with leg extensions · full stretch at the bottom" },
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
              { name: "Row machine (any)", sets: 3, reps: "10–12", note: "superset with rope tricep extensions · squeeze 1 sec" },
              { name: "Rope tricep extension (cable)", sets: 3, reps: "10–15", note: "superset with row machine · elbows pinned" },
              { name: "Seated cable row", sets: 3, reps: "10–12", note: "superset with leaning overhead cable extensions · flat back" },
              { name: "Leaning overhead cable extension", sets: 3, reps: "10–12", note: "superset with seated cable row · lean forward, full stretch behind the head" },
            ],
          },
          {
            day: "Friday", focus: "Hyrox + Shoulders", notes: "Engine work, then delts",
            exercises: [
              { name: "Hyrox-lite station 1", sets: 1, reps: "round", note: "5 min bike, hard but steady + sled push 2 lengths" },
              { name: "Hyrox-lite station 2", sets: 1, reps: "round", note: "5 min bike + 50 wall balls (10-14 lb) — break them up as needed" },
              { name: "Seated dumbbell shoulder press", sets: 3, reps: "8–12", note: "back supported · graduates to standing military press later" },
              { name: "Rear delt fly", sets: 3, reps: "12–15", note: "superset with lateral raise · cables or fly machine" },
              { name: "Lateral raise", sets: 3, reps: "12–15", note: "superset with rear delt fly · light, strict" },
              { name: "Walking lunges", sets: 2, reps: "10/leg", note: "bodyweight — hold dumbbells once these feel easy" },
            ],
          },
          { day: "Saturday", focus: "Rest", notes: "Active rest — hit 8-10k steps. A 30-45 min walk is the workout today." },
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
        "Meal 1 (breakfast, about 525 cal, 55-60g protein): 2 eggs, 1 cup egg whites, 2 rice cakes (one with 1 tbsp peanut butter), 1 Oikos Pro 15g yogurt",
        "Breakfast swaps: 1.5 cups nonfat Greek yogurt with a sliced banana and 1/3 cup granola - or on the go, a Fairlife 30g protein drink, an Oikos Pro, a banana and 1 tbsp peanut butter.",
        "Meal 2 (work lunch, about 800 cal, 55g protein): (build whatever work provides this way - two palms of protein, one fist of carbs, half the plate vegetables, sauces and dressing on the side, skip the chips and dessert; if the protein option is light, add a Fairlife or jerky)",
        "Meal 3 (dinner, about 800 cal, 60g protein): 8 oz chicken breast or 93% lean ground beef, 1.5 cups cooked rice or a large potato, 2 cups vegetables, salsa or hot sauce",
        "Rotate dinners so it never gets boring - taco bowl, burger bowl, stir-fry, sheet-pan chicken + potatoes, sirloin or salmon once a week. Same formula every time. Eat it after training when you can; it's your biggest carb meal.",
        "Snack (whenever hunger hits, about 250-300 cal, 20-35g protein): this replaces grazing. A Fairlife 30g protein drink + a piece of fruit, a protein bar (Built Bar, Barebells, etc.) + an apple, or 2 oz beef jerky + an Oikos Pro.",
        "",
        "REST DAYS",
        "Meal 1 (breakfast): (same - one rice cake instead of two, keep the peanut butter one)",
        "Meal 2 (work lunch): (same build - carbs down to half a fist)",
        "Meal 3 (dinner): (same protein and vegetables - carbs cut to 3/4 cup rice or a medium potato)",
        "Snack: same - protein first.",
        "That trims about 250 calories, nearly all from carbs. Protein stays at 200g.",
        "",
        "GROCERY LIST",
        "Weekly, fits the $125-200 budget: 5-6 lb chicken breast, 3 lb 93% lean ground beef or turkey, 1-2 lb sirloin or salmon, 1.5 dozen eggs, 2 cartons liquid egg whites, Fairlife 30g protein drinks, protein bars (Built Bar, Barebells), beef jerky, rice, potatoes, rice cakes, oats or granola, bananas, apples, 4-5 bags frozen vegetables, Oikos Pro 15g yogurt (8-10 cups), 1 large tub nonfat Greek yogurt, peanut butter, salsa and hot sauce.",
        "",
        "HOW WE ADJUST",
        "Weigh in every morning after the bathroom, before food. We go by the weekly average, never a single day.",
        "Losing under 1 lb a week for 2 straight weeks: drop 150 calories, from carbs. Losing over 2.5 lb a week after week 3: add 150.",
        "Log food in an app for the first 4 weeks - that's how you learn portions. After that, the formula above is enough.",
        "One planned snack a day. Hungry outside meals? Water first, then protein (jerky, a protein bar, Oikos Pro) - not chips or sweets.",
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
