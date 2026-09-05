console.log(
  new Date(Date.now() + 5 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", ""),
);
