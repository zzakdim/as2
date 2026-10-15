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
