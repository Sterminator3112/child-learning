/* Study stars: learning pays for fun. Every 10 right answers in any Learning subject and every typing lesson
   passed earns a ⭐ study star. Stars buy things in the shop (coins, and Race Off's Brainiac car and Galaxy
   paint), and a day with 10 or more right answers turns on the 📚 study boost: x1.5 coins in Race Off.
   The stars earned are counted from the progress the subjects already save, so nothing has to be wired into
   them; only the stars spent are stored (store.starsSpent).
     Study.earned(), Study.balance(), Study.spend(n) -> true if there were enough
     Study.todayRight()   right answers today, all subjects together
     Study.boost()        true once today's right answers reach BOOST_AT */
(function(){
  "use strict";
  const store = Hub.store, PER_STAR = 10, BOOST_AT = 10;
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const subjects = () => (window.Notebook && Notebook.subjects) || [];
  const rightAnswers = () => subjects().reduce((n, s) => n + Object.values((s.data && s.data.topics) || {}).reduce((m, t) => m + (t.correct || 0), 0), 0);
  const lessonsPassed = () => Object.keys((store.typing && store.typing.best) || {}).length;
  const earned = () => Math.floor(rightAnswers() / PER_STAR) + lessonsPassed();
  const balance = () => Math.max(0, earned() - (store.starsSpent || 0));
  function spend(n){
    if (balance() < n) return false;
    store.starsSpent = (store.starsSpent || 0) + n; Hub.saveStore();
    return true;
  }
  const todayRight = () => subjects().reduce((n, s) => n + (((s.data && s.data.log) || {})[today()] || { c: 0 }).c, 0);
  const boost = () => todayRight() >= BOOST_AT;
  window.Study = { earned, balance, spend, todayRight, boost, PER_STAR, BOOST_AT };
})();
