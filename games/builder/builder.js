/* Dream Builder: a big flat land that's all yours to build on, seen through your own eyes like Block World.
   Press B (or 🏡 on a phone) and pick a ready-made building: a house, a tower with stairs inside, a castle,
   a tree house, a pyramid with a secret room, a fountain or a rocket. It pops up right in front of you,
   facing you. Don't like it? Z (or ↩️) takes it back. Then dig, build and decorate with your own blocks,
   fly up high (F) to see your town from the sky, and press 🎲 for a surprise building.
   The game itself is Block World's (games/blocks/blocks.js); this file brings the flat land and the
   buildings. Your town is saved in store.builder, apart from your Block World. */
(function(){
  "use strict";
  const store = Hub.store;
  const BW = window.BlockWorld;
  const { ID } = BW;
  const data = () => store.builder || (store.builder = {});

  /* ---------------- little helpers for drawing a building out of blocks ---------------- */
  // fill a whole box with one block
  const box = (put, x0, y0, z0, x1, y1, z1, id) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(x, y, z, id);
  };
  // just the four walls of a box (no floor or ceiling)
  const walls = (put, x0, y0, z0, x1, y1, z1, id) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
      if (x === x0 || x === x1 || z === z0 || z === z1) put(x, y, z, id);
  };

  /* ---------------- the buildings ----------------
     x goes from left to right across the front, y goes up (-1 is the ground), z goes back from the front.
     Each one says how big its box is (w wide, d deep, h tall). */
  const BUILDS = [
    { icon: "🏠", name: "House", w: 9, d: 8, h: 8, make(put){
      box(put, 1, -1, 1, 7, -1, 6, ID.PLANKS);                  // a wooden floor
      walls(put, 1, 0, 1, 7, 3, 6, ID.PLANKS);
      [[1, 1], [7, 1], [1, 6], [7, 6]].forEach(([x, z]) => box(put, x, 0, z, x, 3, z, ID.LOG));   // logs at the corners
      box(put, 4, 0, 1, 4, 1, 1, 0);                             // the door
      [[2, 1], [6, 1], [3, 6], [4, 6], [5, 6]].forEach(([x, z]) => box(put, x, 1, z, x, 2, z, ID.GLASS));   // windows
      [[1, 3], [1, 4], [7, 3], [7, 4]].forEach(([x, z]) => box(put, x, 1, z, x, 2, z, ID.GLASS));
      // a stepped brick roof that hangs over the walls a little
      box(put, 0, 4, 0, 8, 4, 7, ID.BRICK);
      box(put, 1, 5, 1, 7, 5, 6, ID.BRICK);
      box(put, 2, 6, 2, 6, 6, 5, ID.BRICK);
      box(put, 3, 7, 3, 5, 7, 4, ID.BRICK);
      put(4, 4, 3, ID.GLOWSTONE);                                // a lamp in the ceiling
      put(6, 0, 5, ID.CRAFTING);
      put(4, -1, 0, ID.COBBLE);                                  // a step up to the door, and flowers
      put(2, 0, 0, ID.POPPY); put(6, 0, 0, ID.DANDELION);
    } },
    { icon: "🗼", name: "Tower", w: 5, d: 5, h: 15, make(put){
      box(put, 0, -1, 0, 4, -1, 4, ID.COBBLE);
      walls(put, 0, 0, 0, 4, 11, 4, ID.COBBLE);
      box(put, 2, 0, 0, 2, 1, 0, 0);                             // the door
      [4, 8].forEach(y => { put(2, y, 0, ID.GLASS); put(2, y, 4, ID.GLASS); put(0, y, 2, ID.GLASS); put(4, y, 2, ID.GLASS); });
      box(put, 0, 12, 0, 4, 12, 4, ID.COBBLE);                   // the top, with bumps all round the edge
      [[0, 0], [2, 0], [4, 0], [0, 2], [4, 2], [0, 4], [2, 4], [4, 4]].forEach(([x, z]) => put(x, 13, z, ID.COBBLE));
      put(2, 13, 2, ID.GLOWSTONE);
      // stairs that wind round a log in the middle, all the way up to the top
      box(put, 2, 0, 2, 2, 11, 2, ID.LOG);
      const ring = [[2, 1], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [1, 2], [1, 1]];
      for (let k = 0; k <= 11; k++) put(ring[k % 8][0], k, ring[k % 8][1], ID.PLANKS);
      put(3, 12, 2, 0); put(3, 12, 3, 0);                        // the hole you climb out of at the top
    } },
    { icon: "🏰", name: "Castle", w: 15, d: 15, h: 9, make(put){
      walls(put, 0, 0, 0, 14, 4, 14, ID.COBBLE);
      for (let x = 0; x <= 14; x++) for (let z = 0; z <= 14; z++)   // bumps along the top of the walls
        if ((x === 0 || x === 14 || z === 0 || z === 14) && (x + z) % 2 === 0) put(x, 5, z, ID.COBBLE);
      // a tower in every corner
      [[0, 0], [12, 0], [0, 12], [12, 12]].forEach(([x, z]) => {
        box(put, x, 0, z, x + 2, 6, z + 2, ID.COBBLE);
        [[0, 0], [2, 0], [0, 2], [2, 2]].forEach(([a, b]) => put(x + a, 7, z + b, ID.COBBLE));
        put(x + 1, 7, z + 1, ID.TORCH);
      });
      box(put, 6, 0, 0, 8, 2, 0, 0);                             // the gate
      put(5, 5, 0, ID.TORCH); put(9, 5, 0, ID.TORCH);
      box(put, 6, -1, 0, 8, -1, 8, ID.COBBLE);                   // a path to a well in the middle
      walls(put, 6, 0, 6, 8, 0, 8, ID.COBBLE);
      put(7, -1, 7, ID.WATER);
      put(12, 0, 3, ID.CRAFTING);
    } },
    { icon: "🌳", name: "Tree House", w: 9, d: 9, h: 14, make(put){
      // leaves first, so the house and the trunk are drawn over them
      for (let y = 10; y <= 13; y++) for (let z = 0; z <= 8; z++) for (let x = 0; x <= 8; x++)
        if ((x - 4) ** 2 + (z - 4) ** 2 + ((y - 10.5) * 1.4) ** 2 <= 17) put(x, y, z, ID.LEAVES);
      box(put, 4, 0, 4, 4, 9, 4, ID.LOG);                        // the trunk
      // steps round the trunk up to the platform
      const ring = [[4, 3], [5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [3, 4], [3, 3]];
      for (let k = 0; k <= 5; k++) put(ring[k][0], k, ring[k][1], ID.PLANKS);
      box(put, 1, 6, 1, 7, 6, 7, ID.PLANKS);                     // the platform...
      put(4, 6, 4, ID.LOG); put(4, 6, 5, 0); put(3, 6, 5, 0);    // ...with a hole where the steps come up
      walls(put, 2, 7, 2, 6, 9, 6, ID.PLANKS);                   // the little house on top
      [[2, 2], [6, 2], [2, 6], [6, 6]].forEach(([x, z]) => box(put, x, 7, z, x, 9, z, ID.LOG));
      box(put, 4, 7, 2, 4, 8, 2, 0);                             // its door
      put(2, 8, 4, ID.GLASS); put(6, 8, 4, ID.GLASS); put(4, 8, 6, ID.GLASS);
      box(put, 2, 10, 2, 6, 10, 6, ID.PLANKS);                   // its roof
      put(4, 10, 4, ID.GLOWSTONE);
    } },
    { icon: "🔺", name: "Pyramid", w: 11, d: 11, h: 7, make(put){
      for (let k = 0; k <= 5; k++) box(put, k, k, k, 10 - k, k, 10 - k, ID.SAND);
      put(5, 6, 5, ID.GLOWSTONE);                                // a shiny tip
      box(put, 5, 0, 0, 5, 1, 3, 0);                             // a tunnel...
      box(put, 4, 0, 4, 6, 1, 6, 0);                             // ...to a secret room
      put(5, 0, 6, ID.TORCH);
      put(4, -1, 6, ID.GLOWSTONE); put(6, -1, 6, ID.GLOWSTONE);  // treasure!
    } },
    { icon: "⛲", name: "Fountain", w: 9, d: 9, h: 4, make(put){
      box(put, 0, -1, 0, 8, -1, 8, ID.COBBLE);                   // a stone square
      walls(put, 1, 0, 1, 7, 0, 7, ID.COBBLE);
      box(put, 2, 0, 2, 6, 0, 6, ID.WATER);
      box(put, 4, 0, 4, 4, 2, 4, ID.COBBLE);
      put(4, 3, 4, ID.WATER);                                    // the water on top of the pillar
      [[0, 0], [8, 0], [0, 8], [8, 8]].forEach(([x, z], i) => put(x, 0, z, i % 2 ? ID.POPPY : ID.DANDELION));
    } },
    { icon: "🚀", name: "Rocket", w: 5, d: 5, h: 16, make(put){
      const corner = (x, z) => (x === 0 || x === 4) && (z === 0 || z === 4);
      for (let y = 2; y <= 12; y++) for (let z = 0; z <= 4; z++) for (let x = 0; x <= 4; x++)
        if (!corner(x, z)) put(x, y, z, y === 6 || y === 10 ? ID.BRICK : ID.STONE);
      put(2, 8, 0, ID.GLASS); put(2, 9, 0, ID.GLASS);            // a window to wave from
      [[0, 0], [4, 0], [0, 4], [4, 4]].forEach(([x, z]) => box(put, x, 0, z, x, 4, z, ID.BRICK));   // the fins
      box(put, 1, 0, 1, 3, 1, 3, ID.GLOWSTONE);                  // the engine, glowing
      box(put, 1, 13, 1, 3, 13, 3, ID.BRICK);                    // the pointy nose
      put(2, 14, 2, ID.BRICK);
      put(2, 15, 2, ID.GLOWSTONE);
    } }
  ];

  Hub.register({
    id: "builder", section: "build", title: "Dream Builder", icon: "🏡",
    blurb: "Pop up houses, castles, towers and rockets in a world all your own, then build on them!",
    stat: () => data().buildsMade ? "Made " + data().buildsMade + " buildings" : "",
    badges: [
      { id: "builderFirst", icon: "🏡", name: "Architect",      desc: "Make your first ready-made building", test: () => (data().buildsMade || 0) >= 1 },
      { id: "builderTown",  icon: "🏘️", name: "Town Planner",   desc: "Make 10 buildings in Dream Builder",  test: () => (data().buildsMade || 0) >= 10 },
      { id: "builderHand",  icon: "🧱", name: "Master Builder", desc: "Place 100 blocks by hand in Dream Builder", test: () => (data().blocksPlaced || 0) >= 100 }
    ],
    mount: BW.makeGame({
      id: "builder", prefix: "dr", title: "Dream Builder", icon: "🏡", data, flat: true, builds: BUILDS,
      intro: "A big flat land, all yours! Press B (or 🏡) to pick a house, a castle, a rocket and more, and it pops up right in front of you. Z (or ↩️) takes it back. Then dig, build and decorate with your own blocks, and press F to fly up and see your town from the sky."
    })
  });
})();
