function shuffleArray(a) {
  try {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  } catch (err) {
    console.log(a);
    console.log(err);
  }
}

module.exports = shuffleArray;
