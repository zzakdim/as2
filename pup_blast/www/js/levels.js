// Worlds and levels. Every level is plain data, so adding level 41 is one more entry here.
// start: 8 rows of 8 ('.' empty, '#' block, 'b' block with a bone treat, 'C' crate holding a gift pup).
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

  function buildWorld(id, name, rows) {
    return {
      id, name,
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
    { id: 'w2', name: 'Dog Park', levels: [], soon: 'Fence posts and shaped boards' },
    { id: 'w3', name: 'Beach', levels: [], soon: 'Buried bones and puddles' },
    { id: 'w4', name: 'Snowy Hill', levels: [], soon: 'Ice, mud and smaller boards' },
    { id: 'w5', name: 'Autumn Backyard', levels: [], soon: 'Squirrels and the Leaf Blower' },
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
