export const themeData = [
  {
    id: "nature",
    label: "Nature",
    description: "Landscapes and outdoor scenes including mountains, forests, and coastlines.",
    accentClass: "bg-emerald-100 text-emerald-800",
    images: [
      {
        id: "gallery-nature-1",
        title: "Mountain Reflection",
        subtitle: "Alpine peak and lake at sunrise",
        url: "/images/themes/nature-mountain.jpg",
        comment: "",
      },
      {
        id: "gallery-nature-2",
        title: "Forest Trail",
        subtitle: "Tree-lined path in dense woodland",
        url: "/images/themes/nature-forest.jpg",
        comment: "",
      },
      {
        id: "gallery-nature-3",
        title: "Coastal Cliff",
        subtitle: "Rocky coastline overlooking open water",
        url: "/images/themes/nature-coast.jpg",
        comment: "",
      },
      {
        id: "gallery-nature-4",
        title: "Desert Dunes",
        subtitle: "Wind-shaped sand dunes at golden hour",
        url: "/images/themes/nature-desert.jpg",
        comment: "",
      },
    ],
  },
  {
    id: "city",
    label: "City",
    description: "Urban skylines, architecture, public transit, and downtown street scenes.",
    accentClass: "bg-sky-100 text-sky-800",
    images: [
      {
        id: "gallery-city-1",
        title: "Night Skyline",
        subtitle: "City towers illuminated after sunset",
        url: "/images/themes/city-skyline.jpg",
        comment: "",
      },
      {
        id: "gallery-city-2",
        title: "Metro Street",
        subtitle: "Downtown road scene with active city movement",
        url: "/images/themes/city-street.jpg",
        comment: "",
      },
      {
        id: "gallery-city-3",
        title: "Modern Facade",
        subtitle: "Contemporary glass-and-steel architecture",
        url: "/images/themes/city-architecture.jpg",
        comment: "",
      },
      {
        id: "gallery-city-4",
        title: "Historic District",
        subtitle: "Old-town streets with heritage buildings",
        url: "/images/themes/city-oldtown.jpg",
        comment: "",
      },
    ],
  },
  {
    id: "food",
    label: "Food",
    description: "Meals, ingredients, and plated dishes for culinary browsing.",
    accentClass: "bg-amber-100 text-amber-800",
    images: [
      {
        id: "gallery-food-1",
        title: "Brunch Table",
        subtitle: "Breakfast spread with fruit and coffee",
        url: "/images/themes/food-brunch.jpg",
        comment: "",
      },
      {
        id: "gallery-food-2",
        title: "Street Tacos",
        subtitle: "Fresh tacos with market-style toppings",
        url: "/images/themes/food-tacos.jpg",
        comment: "",
      },
      {
        id: "gallery-food-3",
        title: "Pasta Night",
        subtitle: "Pasta served with a prepared meat dish and sauce",
        url: "/images/themes/food-pasta.jpg",
        comment: "",
      },
      {
        id: "gallery-food-4",
        title: "Dessert Studio",
        subtitle: "Pastry dessert styled in a minimal setup",
        url: "/images/themes/food-dessert.jpg",
        comment: "",
      },
    ],
  },
  {
    id: "animals",
    label: "Animals",
    description: "Wildlife and marine life portraits across natural habitats.",
    accentClass: "bg-violet-100 text-violet-800",
    images: [
      {
        id: "gallery-animals-1",
        title: "Curious Fox",
        subtitle: "Red fox in a woodland environment",
        url: "/images/themes/animals-fox.jpg",
        comment: "",
      },
      {
        id: "gallery-animals-2",
        title: "Savannah Walk",
        subtitle: "Elephants crossing open grassland",
        url: "/images/themes/animals-elephant.jpg",
        comment: "",
      },
      {
        id: "gallery-animals-3",
        title: "Ocean Companion",
        subtitle: "Dolphin surfacing above coastal waters",
        url: "/images/themes/animals-dolphin.jpg",
        comment: "",
      },
      {
        id: "gallery-animals-4",
        title: "Arctic Pause",
        subtitle: "Polar bear in an icy environment",
        url: "/images/themes/animals-polarbear.jpg",
        comment: "",
      },
    ],
  },
];

export const themeById = Object.fromEntries(
  themeData.map((theme) => [theme.id, theme])
);

export const allThemeImages = themeData.flatMap((theme) =>
  theme.images.map((image) => ({
    ...image,
    themeId: theme.id,
    themeLabel: theme.label,
  }))
);
