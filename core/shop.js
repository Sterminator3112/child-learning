/* The shop at #/shop: spend coins (from daily challenges and trophies, see core/daily.js) on looks for the
   sports games. What you own is in store.owned, what you use is in store.equip, and a game asks
     Hub.cosmetic("bowlBall")  ->  the item in use: { id, name, colors: [...] }  */
(function(){
  "use strict";
  const store = Hub.store;
  const SHOP = [
    { slot: "poolFelt", title: "Pool table", icon: "🎱", game: "pool", items: [
      { id: "green", name: "Classic green", price: 0, colors: ["#2fbf71", "#177a43"] },
      { id: "blue", name: "Ocean blue", price: 60, colors: ["#2f8ff0", "#1b5fae"] },
      { id: "purple", name: "Royal purple", price: 100, colors: ["#8b5cf6", "#5b34b8"] },
      { id: "red", name: "Lava red", price: 150, colors: ["#e8423a", "#9e2620"] },
      { id: "galaxy", name: "Galaxy", price: 250, colors: ["#2a1d6e", "#0c0826"] } ] },
    { slot: "bowlBall", title: "Bowling ball", icon: "🎳", game: "bowling", items: [
      { id: "blue", name: "Blue sparkle", price: 0, colors: ["#2f7bff"] },
      { id: "purple", name: "Purple storm", price: 60, colors: ["#8b3dff"] },
      { id: "fire", name: "Fireball", price: 100, colors: ["#ff6a00"] },
      { id: "mint", name: "Mint ice", price: 150, colors: ["#18d6a0"] },
      { id: "gold", name: "Solid gold", price: 250, colors: ["#ffc400"] } ] },
    { slot: "golfBall", title: "Golf ball", icon: "⛳", game: "minigolf", items: [
      { id: "white", name: "Classic white", price: 0, colors: ["#ffffff", "#c9d2e3"] },
      { id: "pink", name: "Bubblegum", price: 60, colors: ["#ffd1ec", "#ff5fb8"] },
      { id: "neon", name: "Neon green", price: 100, colors: ["#eaffd0", "#6fe82a"] },
      { id: "blue", name: "Sky blue", price: 150, colors: ["#d6ecff", "#3a8dff"] },
      { id: "gold", name: "Golden", price: 250, colors: ["#fff2b3", "#ffbf00"] } ] }
  ];
  const owns = (slot, id) => id === SHOP.find(s => s.slot === slot).items[0].id || !!(store.owned && store.owned[slot + ":" + id]);
  function cosmetic(slot){
    const s = SHOP.find(x => x.slot === slot), id = store.equip && store.equip[slot];
    return s.items.find(i => i.id === id && owns(slot, i.id)) || s.items[0];
  }
  const swatch = item => item.colors.length > 1 ? `radial-gradient(circle at 35% 30%, ${item.colors[0]}, ${item.colors[1]})` : `radial-gradient(circle at 35% 30%, #ffffff, ${item.colors[0]} 45%, #140a30)`;

  Hub.page("shop", {
    title: "Shop",
    mount(host){
      host.innerHTML = `
      <div class="wrap shop">
        <header class="hub-head">
          <a class="back-link" href="#/">← Home</a>
          <h1>🛍️ Shop</h1>
          <p class="tagline">Spend your coins on new looks. Earn coins with the daily challenges (+30 each, +50 for all three), new trophies (+20 each) and study stars from Learning.</p>
          <p class="shop-coins" id="shopCoins"></p>
        </header>
        <div id="shopList"></div>
      </div>`;
      const listEl = host.querySelector("#shopList"), coinsEl = host.querySelector("#shopCoins");
      // study stars from Learning can be swapped for coins, and buy Race Off's star-only car and paint
      const STAR_COINS = 20;
      function starsCard(){
        const st = Study.balance(), boost = Study.boost();
        return `<section class="shop-group shop-stars">
          <h2>⭐ Study stars <span class="shop-try">${st} to spend</span></h2>
          <p class="gu-note">Earn a ⭐ for every ${Study.PER_STAR} right answers in Learning and for every typing lesson passed. ${boost ? "📚 Study boost is on today: x1.5 coins in Race Off!" : `Get ${Study.BOOST_AT} answers right today (${Study.todayRight()} so far) to turn on the 📚 study boost: x1.5 coins in Race Off.`}</p>
          <div class="shop-row">
            <button class="btn small" type="button" data-stars="1" ${st < 1 ? "disabled" : ""}>Swap ⭐ 1 for 🪙 ${STAR_COINS}</button>
            <button class="btn small" type="button" data-stars="5" ${st < 5 ? "disabled" : ""}>Swap ⭐ 5 for 🪙 ${STAR_COINS * 5}</button>
            <a class="shop-try" href="#/games/raceoff">Star-only in Race Off: 🧠 Brainiac car and 🌌 Galaxy paint →</a>
          </div>
        </section>`;
      }
      function render(){
        coinsEl.textContent = `🪙 ${store.coins || 0} coins · ⭐ ${Study.balance()} study stars`;
        listEl.innerHTML = starsCard() + SHOP.map(s => `
          <section class="shop-group">
            <h2>${s.icon} ${s.title} <a class="shop-try" href="#/games/${s.game}">Play →</a></h2>
            <div class="shop-grid">${s.items.map(i => {
              const own = owns(s.slot, i.id), on = cosmetic(s.slot).id === i.id;
              const label = on ? "✓ Using" : own ? "Use" : `Buy 🪙 ${i.price}`;
              return `<div class="shop-item${on ? " on" : ""}">
                <span class="shop-swatch" style="background:${swatch(i)}"></span>
                <span class="shop-name">${i.name}</span>
                <button class="btn small${own ? " ghost" : ""}" type="button" data-slot="${s.slot}" data-id="${i.id}" ${on || (!own && (store.coins || 0) < i.price) ? "disabled" : ""}>${label}</button>
              </div>`; }).join("")}</div>
          </section>`).join("");
      }
      listEl.addEventListener("click", e => {
        const sb = e.target.closest("button[data-stars]");
        if (sb) { const n = +sb.dataset.stars; if (Study.spend(n)) { store.coins = (store.coins || 0) + n * STAR_COINS; Hub.saveStore(); if (window.Fun) Fun.sfx.coin(); Hub.confettiBurst(sb); render(); } return; }
        const b = e.target.closest("button[data-slot]"); if (!b) return;
        const slot = b.dataset.slot, item = SHOP.find(s => s.slot === slot).items.find(i => i.id === b.dataset.id);
        if (!owns(slot, item.id)) {
          if ((store.coins || 0) < item.price) return;
          store.coins -= item.price;
          store.owned = Object.assign(store.owned || {}, { [slot + ":" + item.id]: true });
          if (window.Fun) Fun.sfx.coin();
          Hub.confettiBurst(b);
        } else if (window.Fun) Fun.sfx.pop();
        store.equip = Object.assign(store.equip || {}, { [slot]: item.id });
        Hub.saveStore(); render();
      });
      return { open(){ if (window.Daily) Daily.check(); render(); }, close(){} };
    }
  });

  Hub.cosmetic = cosmetic;
})();
