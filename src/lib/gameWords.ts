export const SIMPLE_WORDS = [
  "Apple", "Banana", "Orange", "Watermelon", "Strawberry", "Grape", "Pineapple", "Coconut",
  "Guitar", "Piano", "Violin", "Drums", "Flute", "Trumpet", "Microphone", "Headphones",
  "Computer", "Laptop", "Television", "Telephone", "Camera", "Watch", "Clock", "Calculator",
  "Hammer", "Screwdriver", "Scissors", "Ruler", "Paintbrush", "Pencil", "Eraser", "Notebook",
  "Bicycle", "Motorcycle", "Car", "Airplane", "Train", "Submarine", "Rocket", "Helicopter",
  "Chair", "Table", "Bed", "Sofa", "Desk", "Mirror", "Lamp", "Wardrobe",
  "Window", "Door", "Key", "Lock", "Wallet", "Backpack", "Umbrella", "Suitcase",
  "Toothbrush", "Soap", "Shampoo", "Comb", "Towel", "Hairdryer", "Razor", "Perfume",
  "Coffee", "Teapot", "Cup", "Plate", "Spoon", "Fork", "Knife", "Pan",
  "Pizza", "Hamburger", "Spaghetti", "Cookie", "Cake", "Sandwich", "Ice Cream", "Soup",
  "Doctor", "Teacher", "Chef", "Pilot", "Firefighter", "Police Officer", "Astronaut", "Dentist",
  "Farmer", "Painter", "Scientist", "Builder", "Actor", "Singer", "Writer", "Nurse",
  "Cat", "Dog", "Elephant", "Lion", "Tiger", "Bear", "Monkey", "Giraffe",
  "Penguin", "Dinosaur", "Spider", "Bee", "Butterfly", "Fish", "Shark", "Dolphin",
  "Sun", "Moon", "Star", "Cloud", "Rainbow", "Mountain", "River", "Ocean",
  "Forest", "Desert", "Volcano", "Island", "Cave", "Waterfall", "Beach", "Garden",
  "Soccer Ball", "Basketball", "Tennis Racket", "Skateboard", "Surfboard", "Snowboard", "Helmet", "Bicycle",
  "Compass", "Map", "Telescope", "Microscope", "Magnifying Glass", "Globe", "Binoculars", "Lantern",
  "Crown", "Sword", "Shield", "Ring", "Necklace", "Glasses", "Sunglasses", "Hat",
  "Shoes", "Socks", "Jacket", "T-shirt", "Jeans", "Gloves", "Scarf", "Belt",
  "Book", "Newspaper", "Letter", "Envelope", "Stamp", "Pen", "Pencilcase", "Clipboard",
  "Flag", "Balloon", "Present", "Candle", "Pumpkin", "Snowman", "Christmas Tree", "Santa Claus",
  "Witch", "Ghost", "Monster", "Alien", "Robot", "Superhero", "Princess", "Pirate",
  "Castle", "Bridge", "Lighthouse", "Windmill", "Pyramid", "Eiffel Tower", "Statue of Liberty", "Tent"
];

export function getRandomWord(): string {
  const idx = Math.floor(Math.random() * SIMPLE_WORDS.length);
  return SIMPLE_WORDS[idx];
}
