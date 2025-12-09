const getAbout = (req, res) => {
  // Randăm layout-ul principal și injectăm conținutul paginii 'about'
  res.render("pages/about", {
    title: res.__("nav.about") || "Despre Noi", // Titlul tab-ului (tradus)
    user: req.user || null, // Trimitem user-ul dacă este logat (pentru navbar)
  });
};

module.exports = {getAbout,};
