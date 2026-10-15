// Worlds and levels. Every level is plain data, so adding level 41 is one more entry here.
// start: 8 rows of 8 ('.' empty, '#' block, 'b' block with a bone treat, 'C' crate holding a gift pup,
// 'P' fence post, 'x' off the board, 'o' buried bone, 'O' block over a buried bone, 'w' puddle,
// 'i' ice, 'm' mud, 'S' squirrel). Rules for each live in www/js/core.js.
(function (root) {
  'use strict';

  // Bot-tuned star thresholds (tools/bot.mjs tune). Hand targets below are the fallback.
  const Tuning = (root.PB && root.PB.LevelTuning) || (typeof require === 'function' ? require('./tuning.js') : {});

  // Star bands: easy early (these levels feed the player), brutal late (come back with leveled pups).
  const STAR_BANDS = [
    { upTo: 10, two: 1.3, three: 1.6 },
    { upTo: 20, two: 1.5, three: 2 },
    { upTo: 30, two: 1.75, three: 2.6 },
    { upTo: 39, two: 2, three: 3.2 },
    { upTo: 40, two: 2, three: 3.5 },
  ];
  const round50 = (n) => Math.round(n / 50) * 50;

  function starsFor(level) {
    if (level.stars) return level.stars;
    const band = STAR_BANDS.find((b) => level.n <= b.upTo) || STAR_BANDS.at(-1);
    return [level.target, round50(level.target * band.two), round50(level.target * band.three)];
  }
  function starsForScore(level, score) {
    return starsFor(level).filter((t) => score >= t).length;
  }

  const HELP_GOLDEN = { golden: 1 / 12 };
  const HELP_BOTH = { golden: 1 / 12, ball: 1 / 14 };
  const E = '........';

  // [name, target, reward, start rows, extra]
  const W1 = [
    ['Hello, Mochi', 150, 25, [E, E, E, E, E, E, E, E], { note: 'Tutorial' }],
    ['Almost There', 300, 25, [E, E, E, E, E, E, '#######.', '.#######']],
    ['Combo Steps', 400, 25, [E, E, E, E, '#.......', '##......', '###.....', '####....']],
    ['Treat Hunt', 550, 25, [E, '.b....#.', E, '...#b...', E, '#.....b.', '..b.....', '....#..#']],
    ['Couch Fort', 850, 'dig', [E, E, E, E, E, '#......#', '##.##.##', '###.####']],
    ['Paw Print', 600, 25, [E, '..#..#..', '#......#', E, '..####..', '.######.', '.######.', '..####..']],
    ['Hidden Bone', 800, 25, [E, E, '.##..##.', '..####..', '..####..', '.##..##.', E, E]],
    ['Happy Pup', 950, 25, [E, '..#..#..', '..#..#..', E, '#......#', '.#....#.', '..####..', E]],
    ['Four Corners', 1150, 25, ['##....##', '#......#', E, E, E, E, '#......#', '##....##']],
    ['Dog Bed', 1450, 'dig', [E, E, E, '#......#', '#......#', '##....##', '.######.', E]],
    ['Rug Stripes', 1100, 40, [E, '###.####', E, '####.###', E, '##.#####', E, '#####.##']],
    ['Ball Pit', 1250, 40, [E, '..####..', '.#....#.', '.#....#.', '.#....#.', '.#....#.', '..####..', E]],
    ['Leash', 1450, 40, ['#.......', '.#......', '..#.....', '...#....', '..#.....', '.#......', '#.......', '.b......']],
    ['Squeaky Ring', 1600, 40, [E, '..####..', '.##..##.', '.#....#.', '.#....#.', '.##..##.', '..####..', E]],
    ['Sunbeam', 2050, 'dig', ['##......', '###.....', '.###....', '..###...', '...###..', '....###.', '.....##.', E], { helpers: HELP_GOLDEN, note: 'Golden bones' }],
    ['Throw Pillows', 1550, 40, ['##....##', E, '...##...', E, '.##..##.', E, '...##...', '##....##'], { helpers: HELP_GOLDEN }],
    ['Fetch Hallway', 1750, 40, ['##....##', '#......#', '#......#', '.......#', '#......#', '#.......', '#......#', '##....##'], { helpers: HELP_BOTH, note: 'Tennis balls' }],
    ['Bookshelf', 1900, 40, ['###..###', '#......#', '#......#', E, E, '#......#', '#......#', '###..###'], { helpers: HELP_BOTH }],
    ['Kibble Spill', 2150, 40, ['#......#', '...#....', '.#....#.', '....#...', '..#.....', '......#.', '.#..#...', '#......#'], { helpers: HELP_BOTH }],
    ['The Crate', 2650, 'dig', [E, E, '...CC...', '...CC...', E, '#......#', '##....##', '###..###'], { helpers: HELP_BOTH, gift: 'sprout' }],
    ['Love Seat', 2050, 55, [E, '.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....', E], { helpers: HELP_BOTH }],
    ['Food Bowl', 2300, 55, [E, E, E, E, '#......#', '##....##', '.######.', '..####..'], { helpers: HELP_BOTH }],
    ['Piano Keys', 2500, 55, [E, '#######.', E, '.#######', E, '###.####', E, E], { helpers: HELP_BOTH }],
    ['Ceiling Fan', 2750, 55, ['...##...', '...##...', '...##...', '.######.', '.######.', '...##...', '...##...', E], { helpers: HELP_BOTH }],
    ['Laundry Maze', 3250, 'dig', ['#.######', '#.......', '#.#####.', '#.#.....', '#.#.###.', '#...#...', '#####.#.', E], { helpers: HELP_BOTH }],
    ['Spilled Water', 2500, 55, [E, E, '..###...', '.#####..', '.######.', '..####..', '...##...', E], { helpers: HELP_BOTH }],
    ['Tug Rope', 2900, 55, ['#.......', '##......', '.##.....', '..##....', '...##...', '....##..', '.....##.', '......##'], { helpers: HELP_BOTH }],
    ['Doggy Door', 3100, 55, [E, '.######.', '.#....#.', '.#....#.', '.#....#.', '.#....#.', '.#....#.', '.#....#.'], { helpers: HELP_BOTH }],
    ['Staircase', 3350, 55, ['#......#', '##....##', '###..###', E, E, '###..###', '##....##', '#......#'], { helpers: HELP_BOTH }],
    ['Coffee Table', 3950, 'dig', [E, E, '.######.', '.######.', '.#....#.', '.#....#.', '.#....#.', E], { helpers: HELP_BOTH }],
    ['Muddy Paws', 3100, 70, ['#.#.....', E, '..#.#...', E, '....#.#.', E, '......#.', '#......#'], { helpers: HELP_BOTH }],
    ['Floor Lamp', 3500, 70, ['..###...', '.#####..', '..###...', '...#....', E, '...#....', '..###...', '.#####..'], { helpers: HELP_BOTH }],
    ['Picnic Blanket', 3850, 70, [E, E, '..#.#...', '...#.#..', '..#.#...', '...#.#..', E, E], { helpers: HELP_BOTH }],
    ['Curtain Rods', 4200, 70, ['###.####', E, E, E, E, E, '####.###', '#......#'], { helpers: HELP_BOTH }],
    ['Window Seat', 4800, 'dig', ['.######.', '.#..#.#.', '.#..#.#.', '.######.', '.#..#.#.', '.#..#.#.', '.######.', E], { helpers: HELP_BOTH, tease: 'squirrel' }],
    ['Nap Spot', 3950, 70, [E, E, E, E, E, '#.#..#.#', '.#.##.#.', '##.#..##'], { helpers: HELP_BOTH }],
    ['Toy Box', 4450, 70, [E, E, '#######.', '#.....#.', '#.....#.', '#.....#.', '#######.', E], { helpers: HELP_BOTH }],
    ['Baseboards', 4900, 70, ['###.####', '#......#', '#.......', E, '#......#', '.......#', '#......#', '####.###'], { helpers: HELP_BOTH }],
    ['Messy Room', 5400, 70, ['#..#...#', '.#...#..', '...#..#.', '#.#.....', '.....#.#', '.#.#....', '#....#.#', '..#..#..'], { helpers: HELP_BOTH }],
    ['Living Room Champion', 6250, 'dig', ['#......#', '.#....#.', '...CC...', '#..CC..#', '.#....#.', '..#..#..', '#.#..#.#', E], { helpers: HELP_BOTH, gift: 'captain', note: 'Finale' }],
  ];


  // World 2, Dog Park: fence posts ('P') stay forever and shaped boards ('x' is off the board).
  // Lines complete around both. Opens once Living Room level 30 is cleared.
  const ROUND = ['xx....xx', 'x......x', E, E, E, E, 'x......x', 'xx....xx'];
  const PLUS = ['xx....xx', 'xx....xx', E, E, E, E, 'xx....xx', 'xx....xx'];
  const BONE = ['..xxxx..', E, E, 'x......x', 'x......x', E, E, '..xxxx..'];
  const HEART = ['x..xx..x', E, E, E, E, 'x......x', 'xx....xx', 'xx....xx'];
  const DONUT = ['xx....xx', 'x......x', '...xx...', '..xxxx..', '..xxxx..', '...xx...', 'x......x', 'xx....xx'];
  const CLOVER = ['...xx...', E, E, 'x......x', 'x......x', E, E, '...xx...'];
  const HOURGLASS = [E, E, 'x......x', 'xx....xx', 'xx....xx', 'x......x', E, E];
  // Every row and column of a level keeps 0 or at least 4 open cells; shorter lines clear too easily.
  // Lays rows over a shape: any non-'.' char in `over` wins.
  const on = (shape, over) => shape.map((row, r) => [...row].map((ch, c) => (over[r][c] !== '.' ? over[r][c] : ch)).join(''));

  const W2 = [
    ['Park Gate', 0, 55, [E, E, '..P.....', E, E, '.....P..', E, E], { helpers: HELP_BOTH, note: 'Fence posts' }],
    ['Fence Line', 0, 55, [E, E, E, 'P.P..P.P', E, E, '#......#', '##....##'], { helpers: HELP_BOTH }],
    ['Lamp Posts', 0, 55, ['P......P', E, E, '...##...', '...##...', E, E, 'P......P'], { helpers: HELP_BOTH }],
    ['Hydrant', 0, 55, [E, E, E, '...P....', '..PPP...', '...P....', E, '#b....b#'], { helpers: HELP_BOTH }],
    ['Gate Latch', 0, 'dig', ['##....##', '#..P...#', E, '..P..P..', E, '...P....', '#......#', '##.P..##'], { helpers: HELP_BOTH }],
    ['Round Pen', 0, 55, ROUND, { helpers: HELP_BOTH, note: 'Shaped boards' }],
    ['Crossroads', 0, 55, on(PLUS, [E, E, E, E, E, E, '..#..#..', '..##.#..']), { helpers: HELP_BOTH }],
    ['Park Bench', 0, 55, [E, E, '.######.', '.P....P.', E, E, '.P....P.', E], { helpers: HELP_BOTH }],
    ['Doghouse', 0, 55, ['xx....xx', 'x......x', E, E, E, E, '#......#', '##.b..##'], { helpers: HELP_BOTH }],
    ['Water Bowl', 0, 'dig', DONUT, { helpers: HELP_BOTH }],
    ['Fetch Field', 0, 70, [E, '.P....P.', E, E, E, E, '.P....P.', E], { helpers: HELP_BOTH }],
    ['Agility Poles', 0, 70, ['P.......', E, '..P.....', E, '....P...', E, '......P.', '#.....##'], { helpers: HELP_BOTH }],
    ['Big Bone', 0, 70, on(BONE, [E, E, E, E, E, '.#....#.', '.##..##.', E]), { helpers: HELP_BOTH }],
    ['Tire Jump', 0, 70, [E, '..P..P..', '.P....P.', E, E, '.P....P.', '..P..P..', E], { helpers: HELP_BOTH }],
    ['Heart Tree', 0, 'dig', on(HEART, [E, E, E, E, E, '..#..#..', E, E]), { helpers: HELP_BOTH }],
    ['Picnic Tables', 0, 70, ['##..##..', '##..##..', E, E, '..##..##', '..##..##', E, 'P..P..P.'], { helpers: HELP_BOTH }],
    ['Hourglass', 0, 70, HOURGLASS, { helpers: HELP_BOTH }],
    ['Sprinkler', 0, 70, [E, E, '...P....', '.P.##.P.', '...##...', '....P...', E, '##....##'], { helpers: HELP_BOTH }],
    ['Dog Run', 0, 70, ['x......x', 'x......x', 'x......x', 'x......x', 'x......x', 'x#....#x', 'x##..##x', 'x###.##x'], { helpers: HELP_BOTH }],
    ['Lost Pup', 0, 'dig', ['P......P', E, '...CC...', '...CC...', E, '.P....P.', '##....##', '###..###'], { helpers: HELP_BOTH, gift: 'domino' }],
    ['Clover Patch', 0, 85, CLOVER, { helpers: HELP_BOTH }],
    ['Duck Pond', 0, 85, [E, E, '..xxx...', '..xxxx..', '..xxxx..', '...xx...', E, '#......#'], { helpers: HELP_BOTH }],
    ['Flower Beds', 0, 85, ['PP....PP', 'P......P', E, E, E, E, 'P......P', 'PP....PP'], { helpers: HELP_BOTH }],
    ['Ball Launcher', 0, 85, on(PLUS, [E, E, '..P..P..', E, E, '..P..P..', E, E]), { helpers: HELP_BOTH }],
    ['Kennel Club', 0, 'dig', on(BONE, [E, '.#....#.', E, '..P..P..', E, '.##..##.', '###..###', E]), { helpers: HELP_BOTH }],
    ['Long Leash', 0, 85, ['P.......', '.P......', '..P.....', '...P....', '....P...', '.....P..', '......P.', '.......P'], { helpers: HELP_BOTH }],
    ['Squeaky Pond', 0, 85, on(DONUT, [E, E, '#......#', '#......#', E, E, '.##..##.', E]), { helpers: HELP_BOTH }],
    ['Dog Wash', 0, 85, on(HEART, [E, '...P....', E, '.P....P.', E, E, E, E]), { helpers: HELP_BOTH }],
    ['Hedge Maze', 0, 85, ['P...P...', E, '..P...P.', E, 'P...P...', E, '..P...P.', '#.#.#.#.'], { helpers: HELP_BOTH }],
    ['Big Field', 0, 'dig', on(ROUND, [E, '..P..P..', E, E, E, '#......#', '##.P..##', E]), { helpers: HELP_BOTH }],
    ['Gazebo', 0, 100, ROUND, { helpers: HELP_BOTH }],
    ['Twin Trees', 0, 100, [E, '.xx..xx.', '.xx..xx.', E, E, '.xx..xx.', '.xx..xx.', '#......#'], { helpers: HELP_BOTH }],
    ['Footbridge', 0, 100, ['x......x', 'x......x', E, E, E, '#......#', 'x......x', 'x......x'], { helpers: HELP_BOTH }],
    ['Obstacle Course', 0, 100, ['x..P....', '......x.', '.P..##..', '....##.P', 'x.......', '..P...x.', '.##.....', '.##..P.x'], { helpers: HELP_BOTH }],
    ['Sunset Hill', 0, 'dig', on(HEART, [E, E, '..P..P..', E, E, '..#..#..', E, E]), { helpers: HELP_BOTH }],
    ['Dog Show', 0, 100, on(CLOVER, [E, E, '..P..P..', E, E, '..P..P..', E, E]), { helpers: HELP_BOTH }],
    ['Lost Ball', 0, 100, on(DONUT, [E, '..P.....', '.P....P.', E, E, E, '.....P..', E]), { helpers: HELP_BOTH }],
    ['Paw Prints', 0, 100, [E, '..x..x..', '.x....x.', E, '...xx...', '..xxxx..', '..xxxx..', '#......#'], { helpers: HELP_BOTH }],
    ['Thunderstorm', 0, 100, on(HOURGLASS, ['.P....P.', E, E, E, E, E, E, '.P....P.']), { helpers: HELP_BOTH }],
    ['Dog Park Champion', 0, 'dig', ['xx......', 'x.......', '.....P..', '...CC...', '...CC...', '..P.....', '.......x', '......xx'], { helpers: HELP_BOTH, gift: 'disco', note: 'Finale' }],
  ];

  // Worlds 3-5 were drafted by tools/genlevels.mjs (seeded boards, checked by the bot) and are
  // plain data from here on: edit them like the hand-made worlds.
  // World 3, Beach: buried bones (a line clear over one digs it up: +50 points, +10 bones) and puddles
  // (count as filled, can't be placed on, dry up when a line clears through them). Shaped boards return.
  const W3 = [
    // <gen w3>
    ['Low Tide', 0, 70, [E, E, E, E, '..o..o..', '..#.....', '...##...', '.....o#.'], { helpers: HELP_BOTH, note: 'Buried bones' }],
    ['Sandcastle', 0, 70, [E, E, E, '#......#', E, '#o....o#', E, 'o.....o.'], { helpers: HELP_BOTH }],
    ['Shell Hunt', 0, 70, ['..o..o..', E, E, '#......#', E, 'o.o..o..', E, '...##...'], { helpers: HELP_BOTH }],
    ['Seagulls', 0, 70, ['...ooo..', E, E, E, 'o......o', '##.o..##', '..#.....', E], { helpers: HELP_BOTH }],
    ['Sand Dig', 0, 'dig', [E, '...oo...', E, E, 'o..oo..o', '.#....#.', '.#....#.', '..#o....'], { helpers: HELP_BOTH }],
    ['Tide Pools', 0, 70, ['..o..o..', E, E, '.....#..', '...#....', '...#o...', '.##w....', 'wo....ow'], { helpers: HELP_BOTH, note: 'Puddles' }],
    ['Boardwalk', 0, 70, [E, E, '..owwo.o', E, '..#..#..', '...###..', E, 'wo....o.'], { helpers: HELP_BOTH }],
    ['Beach Towel', 0, 70, ['...ww...', 'o......o', '..o..o..', E, E, '#......#', '#w.....#', 'o..##...'], { helpers: HELP_BOTH }],
    ['Sun Hat', 0, 70, ['o.w..w.o', E, E, '..####..', '#....o..', '..w.....', '.......#', '.o....o.'], { helpers: HELP_BOTH }],
    ['Lighthouse', 0, 'dig', [E, '..w..w.o', 'o......o', '..o.....', '..#.o#..', E, '...##...', '...w##..'], { helpers: HELP_BOTH }],
    ['Driftwood', 0, 85, ['x..xx..x', '.......w', 'ow....wo', '##....O#', '.o.....O', 'x......x', 'xx###.xx', 'xx....xx'], { helpers: HELP_BOTH, note: 'Shaped boards' }],
    ['Crab Walk', 0, 85, [E, E, E, '.o....#.', 'O#..w.#O', E, '.o....o.', 'w#..###w'], { helpers: HELP_BOTH }],
    ['Surf\'s Up', 0, 85, [E, 'o.......', '...oo...', '#.w..w##', '#......#', '...OO...', '..w..w.#', '.#......'], { helpers: HELP_BOTH }],
    ['Beach Ball', 0, 85, ['xxw..wxx', 'x......x', 'w..xxo.w', 'o#xxxx.o', '..xxxx..', '.##xx.#.', 'x##OO..x', 'xx.#..xx'], { helpers: HELP_BOTH }],
    ['Sea Glass', 0, 'dig', [E, E, 'w.......', '#......#', '.o...#o#', '....o...', 'O#....wO', '.w#..#w.'], { helpers: HELP_BOTH }],
    ['Pier', 0, 85, [E, E, 'o......o', '.O....#.', '..#.##.w', '..#..#..', '.o.#w.o.', 'wO.....w'], { helpers: HELP_BOTH }],
    ['Kelp Bed', 0, 85, ['...xx...', '..o..o..', 'w.w..w.w', 'x.###O.x', 'xo....ox', E, '#.##.##O', '...xx...'], { helpers: HELP_BOTH }],
    ['Sunscreen', 0, 85, ['o....w.o', '.o....o.', E, '##O..O##', '.#...##.', E, E, '.ww..#w.'], { helpers: HELP_BOTH }],
    ['Splash Zone', 0, 85, [E, '.o....o.', '..#..#..', '..#o.OO#', '.......o', '.#.ww...', '.#w..w#.', '...#....'], { helpers: HELP_BOTH }],
    ['Message in a Bottle', 0, 'dig', ['xx....xx', 'xw.oo..x', '..o.....', '#..CC...', 'Ow.CC.#O', '.#w..w#.', 'x##..##x', 'xx...oxx'], { helpers: HELP_BOTH, gift: 'cocoa' }],
    ['Tide Turns', 0, 100, [E, 'w.......', E, '...ooo..', '##.....#', '.O.#..O.', 'o.#ww#.#', 'w.#..#.w'], { helpers: HELP_BOTH }],
    ['Starfish', 0, 100, [E, 'wo....o.', '.w.oo.w.', '..###...', '.#....#.', '##....##', 'O......O', 'w......w'], { helpers: HELP_BOTH }],
    ['Lifeguard Tower', 0, 100, ['xxw..wxx', 'xx....xx', '...o..w.', '..#..#..', '.#.oO.#.', '##w.#w##', 'xx.oo.xx', 'xx.O..xx'], { helpers: HELP_BOTH }],
    ['Sandbar', 0, 100, [E, E, '......o.', '...#O...', '.#Ow###.', '.##...#.', 'o...w..o', 'w#ow...w'], { helpers: HELP_BOTH }],
    ['Shipwreck', 0, 'dig', ['..w..w..', E, '...oo...', 'O..###..', '..ww.w.O', '...#....', E, '##o##o##'], { helpers: HELP_BOTH }],
    ['Sand Dollar', 0, 100, ['..xxxx.o', '..w..w..', E, 'xo#..#.x', 'xoOooO.x', '.##.....', '##ww.w##', '.#xxxx#.'], { helpers: HELP_BOTH }],
    ['Coral Cove', 0, 100, ['..o.....', '...ww...', '...w.o..', '.w..#.w.', '...##...', 'Oo....oO', '.##..##.', '##.o...#'], { helpers: HELP_BOTH }],
    ['Rip Current', 0, 100, ['w.......', '.....w..', '.o.w..o.', '#..ww..#', '.o.##oo.', '.#.O..##', '.#......', '#...O..#'], { helpers: HELP_BOTH }],
    ['Sea Breeze', 0, 100, ['x.wxx..x', 'w.......', '...oo...', '#..OO#oo', '..wwww.#', 'x.#o.##x', 'xx#..#xx', 'xx#..#xx'], { helpers: HELP_BOTH }],
    ['Treasure Map', 0, 'dig', [E, E, '..w..w..', '...oo.#.', 'Oo.##.##', '.o####o.', 'w.#..#.w', 'w.O....w'], { helpers: HELP_BOTH }],
    ['Moon Tide', 0, 115, ['.w....w.', '..o..o..', E, 'ww#..#ww', '..####..', '..#..#..', '.O#o.#O.', '.o..#.o.'], { helpers: HELP_BOTH }],
    ['Jellyfish', 0, 115, ['xxwww.xx', 'x.o..o.x', '...xx...', 'w.xxxx#w', '.wxxxx##', '##OxxO.#', 'xo.###.x', 'xx#oo#xx'], { helpers: HELP_BOTH }],
    ['Dune Grass', 0, 115, ['...oo...', E, 'w..ww..w', '..OooOw.', '....o...', '.##..##w', '.#....##', '#..##..#'], { helpers: HELP_BOTH }],
    ['Bonfire', 0, 115, ['w......w', E, '...ww...', 'o.o....o', '..#OO#..', '#o..###.', '.w####wo', '..#..#..'], { helpers: HELP_BOTH }],
    ['Deep Dig', 0, 'dig', ['...xx...', '.w..w...', 'w......w', 'x......x', 'xo.oo.ox', '.######.', '#O.ww.O#', '#.#xx#o#'], { helpers: HELP_BOTH }],
    ['High Tide', 0, 115, ['w......w', E, 'woow..o.', '#wo..o.#', 'w.#..#..', 'O.#..o.O', '#...#.##', '...###..'], { helpers: HELP_BOTH }],
    ['Sea Cave', 0, 115, ['w......w', '.w.oo.w.', 'ow.oo.#o', 'w#....#.', '.##..##.', E, '#O##.#O#', '....w...'], { helpers: HELP_BOTH }],
    ['Storm Surge', 0, 115, ['xx....xx', 'xw.w..wx', 'wo....ow', '.w.oo.w#', 'O.####.O', '.#o.#o#.', 'x..##..x', 'xx###.xx'], { helpers: HELP_BOTH }],
    ['Sunset Pier', 0, 115, [E, 'w..ww...', '...wo...', '..o..o#.', '.##..##.', '.#w##o#.', '.#wo#w#.', '..O.#Oo.'], { helpers: HELP_BOTH }],
    ['Big Dig-Up', 0, 'dig', ['..w..w..', '.ow..w..', 'owo..owo', '#O.CC.O.', '.##CC##.', '#.oOOo..', '###..#.#', '..#o.#..'], { helpers: HELP_BOTH, gift: 'duchess', note: 'Finale' }],
    // </gen w3>
  ];
  // World 4, Snowy Hill: ice (survives one clear) and mud (survives two), on 8x8, 7x7 and 6x6 boards.
  const W4 = [
    // <gen w4>
    ['First Snow', 0, 85, [E, E, E, E, '.i......', '.i......', '#......#', E], { helpers: HELP_BOTH, note: 'Ice' }],
    ['Icicles', 0, 85, [E, 'i.......', E, E, E, E, '.#....#.', '..i..i..'], { helpers: HELP_BOTH }],
    ['Snowball', 0, 85, [E, E, E, E, E, E, '.ii..ii.', '...##...'], { helpers: HELP_BOTH }],
    ['Frozen Pond', 0, 85, [E, E, E, '..#..#..', '.i......', 'i......i', '.i......', '.i......'], { helpers: HELP_BOTH }],
    ['Sled Run', 0, 'dig', [E, E, '..iiii..', E, '..i..i..', E, '..#..##.', E], { helpers: HELP_BOTH }],
    ['Mud Season', 0, 85, [E, E, E, E, E, '..#..##.', '.i.mm.i.', '.i....i.'], { helpers: HELP_BOTH, note: 'Mud' }],
    ['Snow Boots', 0, 85, ['.i....i.', E, E, 'm..i...m', E, '....i#..', '....##..', E], { helpers: HELP_BOTH }],
    ['Mittens', 0, 85, ['..i..i..', E, E, '.i....i.', E, '....m...', 'm#......', '.#....#.'], { helpers: HELP_BOTH }],
    ['Hot Cocoa', 0, 85, [E, E, E, '...###..', '..i.ii..', '.i...m..', '.....m..', E], { helpers: HELP_BOTH }],
    ['Snow Fort', 0, 'dig', [E, 'i......i', '.i......', '...##...', E, 'i.......', E, 'm.m...#.'], { helpers: HELP_BOTH }],
    ['Little Hill', 0, 100, ['.......x', '.i....ix', '.......x', '...##..x', '.m....mx', '..iii#.x', '#......x', 'xxxxxxxx'], { helpers: HELP_BOTH, note: 'Small boards' }],
    ['Slush', 0, 100, [E, '.ii..ii.', E, '...mm...', '....i...', E, '.#....#.', '.#....#.'], { helpers: HELP_BOTH }],
    ['Ski Lift', 0, 100, [E, E, E, '.#....#.', E, '.i....i.', 'ii....mi', '#m....m#'], { helpers: HELP_BOTH }],
    ['Snow Angel', 0, 100, ['.i.....x', '.......x', '..iii..x', '.m#...mx', 'i...#.mx', '.##....x', '.......x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Igloo', 0, 'dig', [E, E, E, '.ii..#..', '..i..i..', E, '.m.##imm', '...#....'], { helpers: HELP_BOTH }],
    ['Frostbite', 0, 100, [E, E, '...ii...', E, '...ii...', 'm......m', 'i#..m.#.', '#......#'], { helpers: HELP_BOTH }],
    ['Pine Trees', 0, 100, ['.......x', '.i.....x', '.......x', '.ii..iix', '.#....#x', '.#....#x', '..m.mm.x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Thin Ice', 0, 100, ['...i....', E, E, 'i.i..i..', '#.i..i.#', '#.m..mm.', E, '...##...'], { helpers: HELP_BOTH }],
    ['Blizzard', 0, 100, [E, E, '.....i..', '.m....m.', '...iiim.', '.#...##.', '..#..#..', '..i....i'], { helpers: HELP_BOTH }],
    ['Snowed In', 0, 'dig', ['...iii.x', '....i..x', '..CC...x', '.mCC..mx', '..mii..x', '.#....#x', '.#...##x', 'xxxxxxxx'], { helpers: HELP_BOTH, gift: 'clover' }],
    ['Sled Dogs', 0, 115, [E, '..iiii..', E, '.O....m.', E, '..o..o..', '.m####m.', 'i....#mi'], { helpers: HELP_BOTH }],
    ['Ice Rink', 0, 115, ['i......i', E, 'i.i..i.i', '#......#', 'o..m.#..', '.mm#..m.', '#.......', '..o.O...'], { helpers: HELP_BOTH }],
    ['Snowdrift', 0, 115, ['io....ox', '.i...iix', '.......x', '.#....#x', '..mmmm.x', '...##..x', '.i.#.Oix', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Avalanche Zone', 0, 115, [E, '.i..i.i.', '.m....m.', 'im.oo.m#', '.#....O.', '##.....#', '......i#', '.i....i.'], { helpers: HELP_BOTH }],
    ['Mountain Hut', 0, 'dig', [E, E, '.i.i..i.', '..i..i..', '..i..i..', '.o####..', '.Oo##...', '.m.mm.m.'], { helpers: HELP_BOTH }],
    ['Tiny Peak', 0, 115, ['o......x', 'i......x', '..i..i.x', '.#....#x', '..###O.x', '..mmmm.x', 'o#iiii.x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Frozen Creek', 0, 115, ['xxxxxxxx', 'x..ii..x', 'xo.....x', 'x..##.Ox', 'x#.....x', 'xo.....x', 'x.immi.x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Muddy Trail', 0, 115, [E, '.i....i.', '.i....i.', E, '...###..', '#......#', 'mmm..m#.', 'iioO.o.i'], { helpers: HELP_BOTH }],
    ['Whiteout', 0, 115, ['.......x', '...ii..x', '.i.....x', 'm...mm.x', '.Om##m#x', '.o##o..x', '..iiii#x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Summit', 0, 'dig', ['xxxxxxxx', 'x.o..o.x', 'x......x', 'x.#ii#.x', 'x.....#x', 'x.miim.x', 'x.mO...x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Northern Lights', 0, 130, [E, 'i......i', E, 'O#iiii#.', '.#i..i#m', '.#......', 'm......m', 'm#.oo.#m'], { helpers: HELP_BOTH }],
    ['Ice Cave', 0, 130, ['.......x', '......ix', 'o..i...x', 'iiO##.ix', '#m....mx', '#o.mm#ix', '#i.#m.ix', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Cold Snap', 0, 130, ['xxxxxxxx', 'x.....ix', 'x.i....x', 'xi.##.ix', 'xm.mm.ix', 'x.o..o.x', 'x#...O#x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Glacier', 0, 130, ['iii..iii', '....o...', '.o....o.', '#..imi..', '......#.', '##Omm.#.', E, '.#m..m#.'], { helpers: HELP_BOTH }],
    ['Yeti Tracks', 0, 'dig', ['.i....ix', '.......x', '#......x', '#io.Ooix', '..#om#mx', '..#.##ix', '.iimmmix', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Deep Freeze', 0, 130, ['xxxxxxxx', 'x.....ix', 'x.....ix', 'x.Ooo.ix', 'x.#o.##x', 'x.#iim.x', 'x.m..m.x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Polar Night', 0, 130, [E, '.i....i.', '.ii...i.', 'Oi.i..i#', 'om.#..mo', 'mm.#i..m', '#..om..#', '..#.##..'], { helpers: HELP_BOTH }],
    ['Permafrost', 0, 130, ['o..ii..x', '...ii.ix', '.......x', '.moiiomx', '.##ii##x', 'Om#..#mx', '..m##m.x', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Ice Storm', 0, 130, ['xxxxxxxx', 'x..ii..x', 'x.immi.x', 'x##mm.#x', 'xo#O..ox', 'xi.....x', 'x.....ox', 'xxxxxxxx'], { helpers: HELP_BOTH }],
    ['Frozen Fortress', 0, 'dig', ['..m..m..', E, '...ooi..', '..OCCm..', 'i.mCCm.i', '..immo..', 'mm#..#mm', '......m.'], { helpers: HELP_BOTH, gift: 'merlin', note: 'Finale' }],
    // </gen w4>
  ];
  // World 5, Autumn Backyard: squirrels hop every 3 moves after a warning look; a line through one
  // chases it off (+100). Later they drop acorns and come back. The Leaf Blower pushes a row sideways.
  const W5 = [
    // <gen w5>
    ['Falling Leaves', 0, 100, ['.......S', E, E, E, '.....#..', '...##...', E, '..#.....'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0}, note: 'Squirrels' }],
    ['Squirrel Spotted', 0, 100, [E, '......S.', E, E, E, '..#..#..', '..#.....', '......#.'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Bird Feeder', 0, 100, ['.....S..', E, E, E, E, '#......#', '#......#', E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Garden Gnome', 0, 100, [E, 'S.......', E, E, '.#......', E, E, '##....##'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Leaf Pile', 0, 'dig', [E, E, '......S.', E, '#......#', E, '.......#', '#......#'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Pumpkin Patch', 0, 100, [E, E, E, '......S.', E, '..#..#..', '##.....#', E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Tree Swing', 0, 100, ['..S.....', E, E, E, '......#.', '.#.##.#.', E, E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Sandbox', 0, 100, [E, E, E, '#.#.S#.#', E, '.......#', E, E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Hammock', 0, 100, [E, '.......S', E, E, E, '.##..##.', E, '#......#'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Back Porch', 0, 'dig', [E, E, E, 'S.......', '##...##.', '.#....#.', E, E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: false, returns: 0} }],
    ['Acorn Drop', 0, 115, [E, '..S.....', E, E, '..#..#..', E, '...##...', '.#....#.'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0}, note: 'Acorns' }],
    ['Rake Lines', 0, 115, ['..S.....', E, E, '#.#..#.#', '#......#', E, E, E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Apple Tree', 0, 115, [E, E, E, '.....S..', '#......#', E, '..####..', E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Garden Hose', 0, 115, [E, '.S......', '...##...', '...#....', '.#......', '.#.#....', '...#....', E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Treehouse', 0, 'dig', ['..S.....', E, E, '.#....##', '..#..#..', '..#..#..', E, E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Compost Heap', 0, 115, ['....S...', E, E, E, '...##...', '....#...', '...##...', '..##....'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Fence Run', 0, 115, ['......S.', E, E, E, '...##...', '#......#', E, '#.....##'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Scarecrow', 0, 115, ['.S......', E, E, E, E, E, '...##...', '.##.###.'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Windy Day', 0, 115, ['.....S..', E, E, E, '##....##', '...##...', '...##...', E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['First Gust', 0, 'dig', [E, '...S....', E, '...CC...', '#..CC#..', '..#..#..', '..#..##.', '#.......'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0}, blower: {every: 4}, gift: 'ziggy', note: 'Leaf Blower' }],
    ['Two Squirrels', 0, 130, [E, E, E, '..S..S..', '#......#', 'ii...#i#', '.#.....#', '#......#'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Frosty Morning', 0, 130, [E, E, 'i.S.....', 'i.....Si', '..#..#..', '...##...', '...#.#..', '...##...'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Wheelbarrow', 0, 130, ['...S....', E, '.i.S..ii', '##....##', '......#.', '.......#', '#......#', '.......#'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Hay Bales', 0, 130, [E, 'S......S', E, '.#....#.', '..#..#..', '..#i.#..', 'i...#.#i', '.#......'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Harvest', 0, 'dig', [E, 'S......S', E, '###...##', 'i......i', '..#..#..', '.#....#i', E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Mud Kitchen', 0, 130, ['..i..i..', E, '#......#', '#.S..S.#', '..##.#..', '..i..i..', E, '...##...'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Bird Bath', 0, 130, [E, E, E, 'iiS..Sii', '.....#..', '...##...', '#......#', '##....##'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Woodpile', 0, 130, ['.....S..', E, '.......S', 'i......i', E, '..#..##.', '..#.i#..', '.####i#.'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Lantern Night', 0, 130, [E, '..ii.i..', '...SS...', '..#..#..', '..#..#i.', '.##..##.', '...##...', E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['Cider Press', 0, 'dig', [E, E, '..S..S..', '..#.##..', '...#....', '#.#..###', '..i..i#.', '..i..i..'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 0} }],
    ['They\'re Back', 0, 145, [E, E, '...S...S', 'i....#.i', '..#..#.#', '#.#....#', 'ii###...', E], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6}, note: 'Squirrels come back' }],
    ['Squirrel Gang', 0, 145, ['.....S..', '.......S', '..i..i..', '.i#.....', E, '..#..#..', '..#..#.#', 'i.####..'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6} }],
    ['Chipmunk Run', 0, 145, ['S......S', E, '...ii...', '...##...', '..#..#..', 'i.#..#.i', '..#.##..', '...##...'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6} }],
    ['Gutter Leaves', 0, 145, [E, '.......S', E, '#.i..S.#', '..#..#.#', '###....#', '.i#..#i.', '..i.....'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6} }],
    ['Nut Heist', 0, 'dig', [E, '...SS...', E, '..i#.i..', '..i..i..', '.#.....#', '##..#.#.', '#.###...'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6} }],
    ['Cold Front', 0, 145, ['S......S', '.i....i.', '.i....i.', E, '##....#i', '#.......', '#..###.#', '..#..#..'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6} }],
    ['Storm Clouds', 0, 145, ['.i....i.', E, '...SS...', '.i####i.', '..##.#.i', E, '....#...', '##.....#'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6} }],
    ['Last Leaves', 0, 145, ['S.i..i.S', E, '...ii...', '.####.i.', '.....#..', '.##..##.', '......#.', '#......#'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6} }],
    ['Calm Before', 0, 145, ['.i....i.', '.i....i.', E, '#.S...S#', E, '#.#.##..', '..#..#..', '##i...##'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6} }],
    ['The Leaf Blower', 0, 'dig', [E, '....S...', '.......i', '.iiCCii.', '#..CC#.#', '#..##..#', '..#.##..', '#......#'], { helpers: HELP_BOTH, squirrels: {every: 3, acorns: true, returns: 6}, blower: {every: 3}, gift: 'dj', note: 'Finale' }],
    // </gen w5>
  ];

  function buildWorld(id, name, rows, extra) {
    return {
      id, name, unlockAfter: null, ...extra,
      levels: rows.map(([lname, target, reward, start, extra], k) => Object.assign({
        id: `${id}-${String(k + 1).padStart(2, '0')}`,
        world: id, n: k + 1, name: lname, target, start,
        reward: reward === 'dig' ? { type: 'dig' } : { type: 'bones', amount: reward },
        helpers: null, gift: null,
      }, extra || {})).map((l) => (Tuning[l.id] ? Object.assign(l, { target: Tuning[l.id][0], stars: Tuning[l.id] }) : l)),
    };
  }

  const WORLDS = [
    buildWorld('w1', 'Living Room', W1),
    buildWorld('w2', 'Dog Park', W2, { unlockAfter: 'w1-30' }),
    buildWorld('w3', 'Beach', W3, { unlockAfter: 'w2-30' }),
    buildWorld('w4', 'Snowy Hill', W4, { unlockAfter: 'w3-30' }),
    buildWorld('w5', 'Autumn Backyard', W5, { unlockAfter: 'w4-30' }),
  ];
  const LEVELS = WORLDS.flatMap((w) => w.levels);
  const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

  function next(level) {
    const w = WORLDS.find((x) => x.id === level.world);
    return w.levels[level.n] || null;
  }

  const Levels = { WORLDS, LEVELS, BY_ID, STAR_BANDS, starsFor, starsForScore, next };

  root.PB = root.PB || {};
  root.PB.Levels = Levels;
  if (typeof module !== 'undefined' && module.exports) module.exports = Levels;
})(typeof globalThis !== 'undefined' ? globalThis : this);
