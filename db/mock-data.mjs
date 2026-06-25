// ============================================================================
// Mock data — migrated from the original static feed (index.html / create.html)
// Consumed by db/seed.mjs to populate Neon.
//
// v2: creators are now REAL users (profiles). Demo authors use synthetic
// `user_id`s prefixed with `seed_`. Imagery is generated as self-hosted SVG
// posters (see db/seed.mjs) — no Unsplash. Each video declares an intrinsic
// poster size so the player can "fit to original size".
// ============================================================================

// Demo author profiles (the @handles that publish videos). These become rows
// in `profiles`; a real signed-in user can also author videos.
export const authors = [
  { handle: '@mathmood',   display_name: 'Math Mood',     avatar_color: '#3f7d92', bio: '60-second math that finally clicks.' },
  { handle: '@giggle',     display_name: 'Giggle',        avatar_color: '#cf4f2a', bio: 'Tiny skits, big laughs.' },
  { handle: '@biobites',   display_name: 'Bio Bites',     avatar_color: '#4a7a6a', bio: 'Biology in bite-sized pieces.' },
  { handle: '@chillplay',  display_name: 'Chill Play',    avatar_color: '#52708f', bio: 'Cozy games & calm vibes.' },
  { handle: '@loops',      display_name: 'Loops',         avatar_color: '#b06a3a', bio: 'Lo-fi loops to study to.' },
  { handle: '@histshorts', display_name: 'History Shorts', avatar_color: '#7e4135', bio: 'The past, fast.' },
  { handle: '@goodboys',   display_name: 'Good Boys',     avatar_color: '#5f7d78', bio: 'Just dogs being dogs.' },
  { handle: '@writewell',  display_name: 'Write Well',    avatar_color: '#445b56', bio: 'Better writing, one tip at a time.' },
  { handle: '@asmrly',     display_name: 'ASMRly',        avatar_color: '#3c5470', bio: 'Oddly satisfying, every day.' },
  { handle: '@chemfast',   display_name: 'Chem Fast',     avatar_color: '#85591f', bio: 'Chemistry without the cramming.' },
  { handle: '@playtime',   display_name: 'Play Time',     avatar_color: '#a85f4f', bio: 'Games, quizzes & fun.' },
  { handle: '@physfun',    display_name: 'Phys Fun',      avatar_color: '#37604f', bio: 'Physics you can feel.' },
  { handle: '@hoopdaily',  display_name: 'Hoop Daily',    avatar_color: '#3f9d6a', bio: 'Daily buckets.' },
  { handle: '@footyfix',   display_name: 'Footy Fix',     avatar_color: '#2e5562', bio: 'Your weekly goals fix.' },
  { handle: '@skatelab',   display_name: 'Skate Lab',     avatar_color: '#8a4e25', bio: 'Tricks, lines & bails.' },
  { handle: '@runsmart',   display_name: 'Run Smart',     avatar_color: '#3f6b78', bio: 'Run farther, smarter.' },
];

// Videos (the feed). `author` maps to authors.handle. `poster` declares the
// intrinsic poster geometry (`w`/`h`) + gradient stops used to render the
// self-hosted SVG cover. Mix of portrait ratios so the player adapts per clip.
export const videos = [
  { category: 'study', title: 'Fractions in 60s',       author: '@mathmood',   duration: '0:58', size: 'big',  description: 'A 60-second lesson on fractions, made simple.',           poster: { w: 1080, h: 1350, c: ['#3f6b78', '#2e5562'] } },
  { category: 'play',  title: 'Tiny comedy skit',       author: '@giggle',     duration: '0:33', size: 'tall', description: 'Made to make you smile in under a minute.',               poster: { w: 1080, h: 1920, c: ['#a8542f', '#7e3c20'] } },
  { category: 'study', title: 'How DNA copies',         author: '@biobites',   duration: '0:55', size: '',     description: 'Replication, explained without the textbook.',            poster: { w: 1080, h: 1080, c: ['#4a7a6a', '#37604f'] } },
  { category: 'play',  title: 'Cozy game picks',        author: '@chillplay',  duration: '0:42', size: '',     description: 'Three relaxing games for your evening.',                  poster: { w: 1080, h: 1350, c: ['#52708f', '#3c5470'] } },
  { category: 'play',  title: 'Lo-fi to study to',      author: '@loops',      duration: '0:51', size: '',     description: 'A loop to keep you in the zone.',                         poster: { w: 1080, h: 1080, c: ['#b06a3a', '#8a4e25'] } },
  { category: 'study', title: 'The Silk Road',          author: '@histshorts', duration: '0:57', size: 'tall', description: 'Trade routes that connected the world.',                  poster: { w: 1080, h: 1920, c: ['#7e4135', '#5a2f26'] } },
  { category: 'play',  title: 'Dogs being dogs',        author: '@goodboys',   duration: '0:29', size: '',     description: 'Pure, uncut good-boy energy.',                            poster: { w: 1080, h: 1350, c: ['#5f7d78', '#445b56'] } },
  { category: 'study', title: 'Essay hooks that work',  author: '@writewell',  duration: '0:50', size: '',     description: 'Open strong — three hooks you can steal.',                poster: { w: 1080, h: 1080, c: ['#445b56', '#2f3f3b'] } },
  { category: 'play',  title: 'Oddly satisfying',       author: '@asmrly',     duration: '0:38', size: '',     description: 'Sit back and let your brain relax.',                      poster: { w: 1080, h: 1350, c: ['#3c5470', '#283a4d'] } },
  { category: 'study', title: 'Balancing equations',    author: '@chemfast',   duration: '1:02', size: 'big',  description: 'Balance any equation with one trick.',                    poster: { w: 1080, h: 1350, c: ['#85591f', '#5f3f14'] } },
  { category: 'play',  title: 'Would you rather?',      author: '@playtime',   duration: '0:36', size: '',     description: 'Pick fast — no overthinking allowed.',                    poster: { w: 1080, h: 1080, c: ['#a85f4f', '#7e4135'] } },
  { category: 'study', title: 'Why the sky is blue',    author: '@physfun',    duration: '0:48', size: '',     description: 'Rayleigh scattering, the short version.',                 poster: { w: 1080, h: 1350, c: ['#37604f', '#274236'] } },
  { category: 'play',  title: 'Best buzzer beaters',    author: '@hoopdaily',  duration: '0:44', size: 'tall', description: 'Game-winners that broke the internet.', label: 'SPORTS',  poster: { w: 1080, h: 1920, c: ['#3f9d6a', '#2c6e4a'] } },
  { category: 'play',  title: 'Top 10 goals this week', author: '@footyfix',   duration: '0:39', size: '',     description: 'This week\u2019s best finishes, ranked.', label: 'SPORTS',  poster: { w: 1080, h: 1080, c: ['#2e5562', '#1e3a44'] } },
  { category: 'play',  title: 'Skate tricks 101',       author: '@skatelab',   duration: '0:35', size: '',     description: 'Land your first kickflip.', label: 'SPORTS',               poster: { w: 1080, h: 1350, c: ['#8a4e25', '#603518'] } },
  { category: 'study', title: 'The science of running', author: '@runsmart',   duration: '0:53', size: '',     description: 'What actually makes you faster.', label: 'SPORTS',         poster: { w: 1080, h: 1080, c: ['#3f6b78', '#2a4a53'] } },
];
