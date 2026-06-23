// ============================================================================
// Mock data — migrated from the original static feed (index.html / create.html)
// Consumed by db/seed.mjs to populate Neon.
// ============================================================================

// Creators (the @handles that appear on the cards)
export const creators = [
  { handle: '@mathmood', display_name: 'Math Mood' },
  { handle: '@giggle', display_name: 'Giggle' },
  { handle: '@biobites', display_name: 'Bio Bites' },
  { handle: '@chillplay', display_name: 'Chill Play' },
  { handle: '@loops', display_name: 'Loops' },
  { handle: '@histshorts', display_name: 'History Shorts' },
  { handle: '@goodboys', display_name: 'Good Boys' },
  { handle: '@writewell', display_name: 'Write Well' },
  { handle: '@asmrly', display_name: 'ASMRly' },
  { handle: '@chemfast', display_name: 'Chem Fast' },
  { handle: '@playtime', display_name: 'Play Time' },
  { handle: '@physfun', display_name: 'Phys Fun' },
  { handle: '@hoopdaily', display_name: 'Hoop Daily' },
  { handle: '@footyfix', display_name: 'Footy Fix' },
  { handle: '@skatelab', display_name: 'Skate Lab' },
  { handle: '@runsmart', display_name: 'Run Smart' },
];

// Videos (the feed). `creator` maps to creators.handle.
export const videos = [
  { category: 'study', title: 'Fractions in 60s',        creator: '@mathmood',  duration: '0:58', size: 'big',  image_id: '1509228468518-180dd4864904' },
  { category: 'play',  title: 'Tiny comedy skit',        creator: '@giggle',    duration: '0:33', size: 'tall', image_id: '1543007630-9710e4a00a20' },
  { category: 'study', title: 'How DNA copies',          creator: '@biobites',  duration: '0:55', size: '',     image_id: '1532094349884-543bc11b234d' },
  { category: 'play',  title: 'Cozy game picks',         creator: '@chillplay', duration: '0:42', size: '',     image_id: '1542751371-adc38448a05e' },
  { category: 'play',  title: 'Lo-fi to study to',       creator: '@loops',     duration: '0:51', size: '',     image_id: '1511671782779-c97d3d27a1d4' },
  { category: 'study', title: 'The Silk Road',           creator: '@histshorts',duration: '0:57', size: 'tall', image_id: '1509316785289-025f5b846b35' },
  { category: 'play',  title: 'Dogs being dogs',         creator: '@goodboys',  duration: '0:29', size: '',     image_id: '1543466835-00a7907e9de1' },
  { category: 'study', title: 'Essay hooks that work',   creator: '@writewell', duration: '0:50', size: '',     image_id: '1455390582262-044cdead277a' },
  { category: 'play',  title: 'Oddly satisfying',        creator: '@asmrly',    duration: '0:38', size: '',     image_id: '1530026405186-ed1f139313f8' },
  { category: 'study', title: 'Balancing equations',     creator: '@chemfast',  duration: '1:02', size: 'big',  image_id: '1576086213369-97a306d36557' },
  { category: 'play',  title: 'Would you rather?',       creator: '@playtime',  duration: '0:36', size: '',     image_id: '1496957961599-e35b69ef5d7c' },
  { category: 'study', title: 'Why the sky is blue',     creator: '@physfun',   duration: '0:48', size: '',     image_id: '1601297183305-6df142704ea2' },
  { category: 'play',  title: 'Best buzzer beaters',     creator: '@hoopdaily', duration: '0:44', size: 'tall', image_id: '1546519638-68e109498ffc', label: 'SPORTS' },
  { category: 'play',  title: 'Top 10 goals this week',  creator: '@footyfix',  duration: '0:39', size: '',     image_id: '1517649763962-0c623066013b', label: 'SPORTS' },
  { category: 'play',  title: 'Skate tricks 101',        creator: '@skatelab',  duration: '0:35', size: '',     image_id: '1547036967-23d11aacaee0', label: 'SPORTS' },
  { category: 'study', title: 'The science of running',  creator: '@runsmart',  duration: '0:53', size: '',     image_id: '1552674605-db6ffd4facb5', label: 'SPORTS' },
];
