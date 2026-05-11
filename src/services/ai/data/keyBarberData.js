/**
 * Key Barber Business Knowledge & Marketing Solutions
 * Data diambil dari Price List (Playlist) dan Standar Operasional Key Barber.
 */
module.exports = {
  brandName: "Key Barber",
  services: {
    haircut: {
      name: "Quality Cut",
      price: "100.000",
      includes: ["Consultation", "Quality Cut", "Wash", "Hot Towel", "Styling"]
    },
    treatments: {
      keratin: { name: "Keratin Treatment", price: "500.000", benefit: "Solusi rambut rusak/frizzy" }
    },
    perming: {
      korean: ["Rootlift", "Down Perm", "Cold Perm", "Hot Perm", "Smooth & Shape"],
      curly: ["Curly Perm", "Wavy Perm"]
    },
    coloring: {
      fashion: ["Bleaching", "Highlight Coloring", "Full Coloring", "Custom Color"],
      basic: ["Brown", "Blue Black", "Black"]
    },
    shaving: ["Trimming", "Shaving + Hot Towel"]
  },
  marketingLogic: [
    "Jika rambut samping mengembang (jabrik), WAJIB sarankan 'Down Perm'.",
    "Jika rambut bagian atas kempes/flat, sarankan 'Rootlift' atau 'Korean Perm'.",
    "Jika rambut terlihat kering/kusam, sarankan 'Keratin Treatment' sebagai tambahan.",
    "Hubungkan gaya rambut dengan lifestyle (Professional, Streetwear, Executive)."
  ],
  technicalDictionary: [
    "Seamless Taper Fade", "Texturizing with Thinning Shears", "Over-direction technique", 
    "Weight removal", "Crispy Line-up", "Natural Flow Movement"
  ],
  recommendedProducts: {
    texture: "Texture Powder / Sea Salt Spray",
    matte: "Matte Clay / Fiber Paste",
    shine: "Classic Pomade / Styling Cream"
  }
};

