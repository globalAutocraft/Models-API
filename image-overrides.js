// Fallback image URLs for models whose "Image" cell is empty in the Google Sheet.
// Used by scripts/sync-from-sheet.js only when the sheet has no image for that model,
// so filling the cell in the sheet always wins.

const IMAGES = {
  apacheRtr160: "https://cdn.bikedekho.com/processedimages/tvs/apache-rtr-160/source/apache-rtr-1606aad371bc5385.jpg",
  starCityPlus: "https://cdn.bikedekho.com/processedimages/tvs/tvs-star-city-plus/source/tvs-star-city-plus68db9fd509079.jpg",
  scootyPepPlus: "https://cdn.bikedekho.com/processedimages/tvs/tvs-scooty/source/tvs-scooty60069d82e1217.jpg",
  scootyZest: "https://cdn.bikedekho.com/processedimages/tvs/tvs-scooty-zest/source/tvs-scooty-zest68d3de4860aff.jpg",
  wego: "https://cdn.bikedekho.com/processedimages/tvs/tvs-wego/source/m_wego_61539842493.jpg",
  victor: "https://cdn.bikedekho.com/processedimages/tvs/tvs-victor/source/m_victor_61539846543.jpg",
  tvsX: "https://cdn.bikedekho.com/processedimages/tvs/creon/source/creon690ae90f7a501.jpg",
  // Wikimedia Commons, CC licensed: https://commons.wikimedia.org/wiki/File:TVS_Scooty_Streak.jpg
  scootyStreak: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/TVS_Scooty_Streak.jpg/960px-TVS_Scooty_Streak.jpg",
};

// Keyed by the exact model name in the sheet
module.exports = {
  "TVS APACHE RTR 160-OBDIIB 2V DC ABS": IMAGES.apacheRtr160,
  "APACHE 160 FD 2V ABS-U327B": IMAGES.apacheRtr160,
  "STAR CITY + ES MAG WHL TL": IMAGES.starCityPlus,
  "StarCity + ES MAG WHL": IMAGES.starCityPlus,
  "SCOOTY PEP+": IMAGES.scootyPepPlus,
  "SCOOTY PEP+ - BSVI": IMAGES.scootyPepPlus,
  "SCOOTY PEP+ BSIV": IMAGES.scootyPepPlus,
  "SCOOTY ZEST MATTE SERIES - OBDIIB": IMAGES.scootyZest,
  "SCOOTY ZEST MATTE SERIES - BSVI": IMAGES.scootyZest,
  "Scooty Zest - OBDIIB": IMAGES.scootyZest,
  "SCOOTY ZEST MATTE SERIES-SBT": IMAGES.scootyZest,
  "Zest SXC Drum OBDIIB": IMAGES.scootyZest,
  "WEGO": IMAGES.wego,
  "WEGO BASIC REFRESH": IMAGES.wego,
  "TVS WEGO BSIV": IMAGES.wego,
  "WEGO Refresh": IMAGES.wego,
  "NEW VICTOR 110 DISC": IMAGES.victor,
  "Streak Fashion": IMAGES.scootyStreak,
  "TVS X": IMAGES.tvsX,
};
