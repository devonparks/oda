/**
 * AMG Hub — Built-in Starter Content Packs
 * =========================================
 * These make every learning game playable by a kid with ZERO adult setup —
 * the core requirement of the Learn & Earn pivot. Each tool merges its packs
 * into its normal content browser (marked builtIn:true, never written to
 * Firestore). Guardian-created content always appears alongside.
 *
 * Ages 9–13. All content original.
 */
window.AMG_PACKS = {

  // ── Quiz Show (jeopardy.html) ──────────────────────────────────────
  quizShow: [
    {
      id: 'amg_qs_brainmix',
      builtIn: true,
      title: 'Brain Mix Challenge',
      description: 'A little bit of everything — the classic starter board.',
      categories: [
        { name: 'Animal Kingdom', questions: [
          { points: 100, q: 'This black-and-white bird cannot fly but is an amazing swimmer.', a: 'What is a penguin?' },
          { points: 200, q: 'The fastest land animal, it can run about 70 mph.', a: 'What is a cheetah?' },
          { points: 300, q: 'This animal is the largest that has EVER lived — bigger than any dinosaur.', a: 'What is the blue whale?' },
          { points: 400, q: 'An octopus has this many arms.', a: 'What is eight?' },
          { points: 500, q: 'This insect society has a queen, workers, and drones, and makes honey.', a: 'What are bees?' },
        ]},
        { name: 'Number Crunch', questions: [
          { points: 100, q: '7 × 8', a: 'What is 56?' },
          { points: 200, q: 'The number of degrees in a right angle.', a: 'What is 90?' },
          { points: 300, q: 'If a pizza has 8 slices and you eat 2, this fraction is left.', a: 'What is 6/8 (or 3/4)?' },
          { points: 400, q: '12 × 12', a: 'What is 144?' },
          { points: 500, q: 'The next prime number after 7.', a: 'What is 11?' },
        ]},
        { name: 'Planet Earth', questions: [
          { points: 100, q: 'The largest ocean on Earth.', a: 'What is the Pacific Ocean?' },
          { points: 200, q: 'This continent is home to the Sahara Desert.', a: 'What is Africa?' },
          { points: 300, q: 'Hot melted rock that erupts from a volcano.', a: 'What is lava?' },
          { points: 400, q: 'The longest river in the world (most say), flowing through Egypt.', a: 'What is the Nile?' },
          { points: 500, q: 'The imaginary line around the middle of the Earth.', a: 'What is the equator?' },
        ]},
        { name: 'Word Power', questions: [
          { points: 100, q: 'The opposite of "ancient".', a: 'What is modern (or new)?' },
          { points: 200, q: 'A word that sounds the same as another but is spelled differently, like "there" and "their".', a: 'What is a homophone?' },
          { points: 300, q: 'The name for a word like "quickly" that describes HOW something is done.', a: 'What is an adverb?' },
          { points: 400, q: '"The wind whispered through the trees" is this figure of speech.', a: 'What is personification?' },
          { points: 500, q: 'A word spelled the same forwards and backwards, like "level".', a: 'What is a palindrome?' },
        ]},
        { name: 'Game Zone', questions: [
          { points: 100, q: 'In chess, this piece can only move diagonally.', a: 'What is the bishop?' },
          { points: 200, q: 'The number of squares on a checkers or chess board.', a: 'What is 64?' },
          { points: 300, q: 'In basketball, a shot from beyond the arc is worth this many points.', a: 'What is 3?' },
          { points: 400, q: 'This classic puzzle has you slide numbered tiles to merge them into 2048.', a: 'What is 2048?' },
          { points: 500, q: 'In soccer, only this player may use their hands during play.', a: 'What is the goalkeeper (goalie)?' },
        ]},
      ],
      finalRound: { category: 'Space', clue: 'This planet is famous for its beautiful rings.', answer: 'What is Saturn?' },
    },
    {
      id: 'amg_qs_science',
      builtIn: true,
      title: 'Science Lab',
      description: 'Space, the body, and wild experiments.',
      categories: [
        { name: 'Outer Space', questions: [
          { points: 100, q: 'The star at the center of our solar system.', a: 'What is the Sun?' },
          { points: 200, q: 'The red planet.', a: 'What is Mars?' },
          { points: 300, q: 'The galaxy we live in.', a: 'What is the Milky Way?' },
          { points: 400, q: 'The force that keeps planets orbiting the Sun.', a: 'What is gravity?' },
          { points: 500, q: 'The first person to walk on the Moon.', a: 'Who is Neil Armstrong?' },
        ]},
        { name: 'Your Body', questions: [
          { points: 100, q: 'The organ that pumps blood through your body.', a: 'What is the heart?' },
          { points: 200, q: 'You have 206 of these in your adult body.', a: 'What are bones?' },
          { points: 300, q: 'The body organ that controls thinking, memory, and movement.', a: 'What is the brain?' },
          { points: 400, q: 'These tiny air sacs in your lungs move oxygen into your blood.', a: 'What are alveoli?' },
          { points: 500, q: 'The body system that fights off germs and infections.', a: 'What is the immune system?' },
        ]},
        { name: 'Weather Watch', questions: [
          { points: 100, q: 'Frozen rain that falls as balls of ice.', a: 'What is hail?' },
          { points: 200, q: 'A spinning column of air that touches the ground.', a: 'What is a tornado?' },
          { points: 300, q: 'The instrument that measures temperature.', a: 'What is a thermometer?' },
          { points: 400, q: 'Clouds form when water vapor does this — turning from gas back to liquid.', a: 'What is condensation?' },
          { points: 500, q: 'The scale (named after a person) used to rate hurricane strength 1-5.', a: 'What is the Saffir-Simpson scale?' },
        ]},
        { name: 'Wild Chemistry', questions: [
          { points: 100, q: 'H2O is the chemical formula for this.', a: 'What is water?' },
          { points: 200, q: 'The three states of matter you learn first: solid, liquid, and this.', a: 'What is gas?' },
          { points: 300, q: 'Mixing baking soda and vinegar makes this gas that fizzes.', a: 'What is carbon dioxide?' },
          { points: 400, q: 'The chart that organizes all the chemical elements.', a: 'What is the periodic table?' },
          { points: 500, q: 'Au is the chemical symbol for this precious metal.', a: 'What is gold?' },
        ]},
        { name: 'Tech Time', questions: [
          { points: 100, q: 'The "brain" of a computer, abbreviated CPU.', a: 'What is the central processing unit (processor)?' },
          { points: 200, q: 'Instructions written for a computer to follow are called this.', a: 'What is code (a program)?' },
          { points: 300, q: 'This "www" system lets you browse pages on the internet.', a: 'What is the World Wide Web?' },
          { points: 400, q: 'A machine that can be programmed to do tasks, often shaped like a person or arm.', a: 'What is a robot?' },
          { points: 500, q: 'Binary code uses only these two digits.', a: 'What are 0 and 1?' },
        ]},
      ],
      finalRound: { category: 'Inventions', clue: 'Thomas Edison is most famous for perfecting this device that lights up rooms.', answer: 'What is the light bulb?' },
    },
  ],

  // ── Quiz Blitz (kahoot.html) — solo practice quizzes ───────────────
  quizBlitz: [
    {
      id: 'amg_qb_mathrush',
      builtIn: true,
      title: 'Math Rush',
      description: 'Quick-fire arithmetic. Speed counts!',
      questions: [
        { q: '9 × 6', options: ['54', '56', '52', '48'], correct: 0, time: 15 },
        { q: '144 ÷ 12', options: ['14', '11', '12', '10'], correct: 2, time: 15 },
        { q: 'What is 25% of 80?', options: ['15', '20', '25', '40'], correct: 1, time: 20 },
        { q: '13 + 28', options: ['41', '39', '42', '31'], correct: 0, time: 15 },
        { q: 'Which is the largest?', options: ['0.5', '0.45', '0.099', '0.405'], correct: 0, time: 20 },
        { q: '7 squared (7²)', options: ['14', '77', '49', '63'], correct: 2, time: 15 },
        { q: 'A triangle has how many degrees total?', options: ['90', '180', '270', '360'], correct: 1, time: 20 },
        { q: '100 - 37', options: ['73', '77', '63', '67'], correct: 2, time: 15 },
        { q: 'What is half of 250?', options: ['150', '125', '100', '175'], correct: 1, time: 15 },
        { q: '8 × 12', options: ['86', '92', '104', '96'], correct: 3, time: 15 },
      ],
    },
    {
      id: 'amg_qb_worldtour',
      builtIn: true,
      title: 'World Tour',
      description: 'Countries, capitals, and cool places.',
      questions: [
        { q: 'What is the capital of France?', options: ['London', 'Paris', 'Rome', 'Berlin'], correct: 1, time: 15 },
        { q: 'Which country is shaped like a boot?', options: ['Spain', 'Greece', 'Italy', 'Portugal'], correct: 2, time: 15 },
        { q: 'The Great Wall is in which country?', options: ['Japan', 'China', 'India', 'Korea'], correct: 1, time: 15 },
        { q: 'Which continent has the most countries?', options: ['Asia', 'Europe', 'Africa', 'South America'], correct: 2, time: 20 },
        { q: 'What is the capital of Ohio?', options: ['Cleveland', 'Cincinnati', 'Columbus', 'Toledo'], correct: 2, time: 15 },
        { q: 'The pyramids of Giza are in which country?', options: ['Egypt', 'Mexico', 'Peru', 'Greece'], correct: 0, time: 15 },
        { q: 'Which ocean is between America and Europe?', options: ['Pacific', 'Indian', 'Arctic', 'Atlantic'], correct: 3, time: 15 },
        { q: 'Which country gifted the Statue of Liberty to the USA?', options: ['England', 'France', 'Spain', 'Italy'], correct: 1, time: 20 },
        { q: 'What is the largest country by land area?', options: ['China', 'USA', 'Russia', 'Canada'], correct: 2, time: 15 },
        { q: 'Mount Everest is in which mountain range?', options: ['Rockies', 'Andes', 'Alps', 'Himalayas'], correct: 3, time: 15 },
      ],
    },
    {
      id: 'amg_qb_wordwiz',
      builtIn: true,
      title: 'Word Wizard',
      description: 'Vocabulary, spelling, and grammar zingers.',
      questions: [
        { q: 'Which word is spelled correctly?', options: ['recieve', 'receive', 'receeve', 'reseive'], correct: 1, time: 20 },
        { q: 'What is the plural of "child"?', options: ['childs', 'childes', 'children', 'childrens'], correct: 2, time: 15 },
        { q: '"Enormous" means...', options: ['tiny', 'huge', 'loud', 'fast'], correct: 1, time: 15 },
        { q: 'Which is a synonym for "happy"?', options: ['gloomy', 'joyful', 'angry', 'sleepy'], correct: 1, time: 15 },
        { q: 'Which sentence is correct?', options: ['Their going home.', "They're going home.", 'There going home.', 'Theyre going home.'], correct: 1, time: 20 },
        { q: 'An antonym of "brave" is...', options: ['bold', 'cowardly', 'strong', 'daring'], correct: 1, time: 15 },
        { q: 'Which word is a verb?', options: ['quickly', 'mountain', 'jump', 'purple'], correct: 2, time: 15 },
        { q: '"The stars danced in the sky" is an example of...', options: ['simile', 'personification', 'alliteration', 'rhyme'], correct: 1, time: 20 },
        { q: 'Which word means "to make something better"?', options: ['improve', 'ignore', 'imitate', 'impress'], correct: 0, time: 15 },
        { q: 'Which is spelled correctly?', options: ['definately', 'definitely', 'definitley', 'definitly'], correct: 1, time: 20 },
      ],
    },
  ],

  // ── Flashcards (flashcards.html) ────────────────────────────────────
  flashcards: [
    {
      id: 'amg_fc_multiplication',
      builtIn: true,
      title: 'Multiplication Masters',
      description: 'The times tables everyone needs cold.',
      cards: [
        { front: '6 × 7', back: '42' }, { front: '8 × 7', back: '56' },
        { front: '9 × 8', back: '72' }, { front: '7 × 7', back: '49' },
        { front: '6 × 8', back: '48' }, { front: '9 × 6', back: '54' },
        { front: '12 × 8', back: '96' }, { front: '11 × 12', back: '132' },
        { front: '9 × 9', back: '81' }, { front: '12 × 12', back: '144' },
        { front: '7 × 12', back: '84' }, { front: '8 × 8', back: '64' },
        { front: '9 × 7', back: '63' }, { front: '6 × 12', back: '72' },
        { front: '11 × 11', back: '121' }, { front: '9 × 12', back: '108' },
      ],
    },
    {
      id: 'amg_fc_capitals',
      builtIn: true,
      title: 'State Capitals',
      description: 'US states and their capitals.',
      cards: [
        { front: 'Ohio', back: 'Columbus' }, { front: 'California', back: 'Sacramento' },
        { front: 'Texas', back: 'Austin' }, { front: 'New York', back: 'Albany' },
        { front: 'Florida', back: 'Tallahassee' }, { front: 'Illinois', back: 'Springfield' },
        { front: 'Pennsylvania', back: 'Harrisburg' }, { front: 'Michigan', back: 'Lansing' },
        { front: 'Georgia', back: 'Atlanta' }, { front: 'Washington', back: 'Olympia' },
        { front: 'Arizona', back: 'Phoenix' }, { front: 'Colorado', back: 'Denver' },
        { front: 'Nevada', back: 'Carson City' }, { front: 'Kentucky', back: 'Frankfort' },
        { front: 'Tennessee', back: 'Nashville' }, { front: 'Virginia', back: 'Richmond' },
      ],
    },
    {
      id: 'amg_fc_vocab',
      builtIn: true,
      title: 'Power Vocabulary',
      description: 'Words that make you sound brilliant.',
      cards: [
        { front: 'Abundant', back: 'More than enough; plentiful' },
        { front: 'Benevolent', back: 'Kind and generous' },
        { front: 'Candid', back: 'Truthful and straightforward' },
        { front: 'Diligent', back: 'Hard-working and careful' },
        { front: 'Eloquent', back: 'Fluent and persuasive in speaking' },
        { front: 'Frugal', back: 'Careful with money; not wasteful' },
        { front: 'Genuine', back: 'Real; authentic; sincere' },
        { front: 'Hypothesis', back: 'An idea you test with an experiment' },
        { front: 'Inevitable', back: 'Certain to happen; unavoidable' },
        { front: 'Jubilant', back: 'Feeling great joy; triumphant' },
        { front: 'Keen', back: 'Sharp; eager; enthusiastic' },
        { front: 'Luminous', back: 'Giving off light; glowing' },
        { front: 'Meticulous', back: 'Extremely careful about details' },
        { front: 'Novice', back: 'A beginner at something' },
        { front: 'Obsolete', back: 'No longer in use; out of date' },
        { front: 'Persevere', back: 'To keep trying despite difficulty' },
      ],
    },
  ],

  // ── Word Search (wordsearch.html) ───────────────────────────────────
  wordSearch: [
    { id: 'amg_ws_animals', builtIn: true, title: 'Animal Safari', words: ['ELEPHANT', 'GIRAFFE', 'PENGUIN', 'DOLPHIN', 'CHEETAH', 'GORILLA', 'OSTRICH', 'PANTHER', 'RACCOON', 'BUFFALO'] },
    { id: 'amg_ws_space', builtIn: true, title: 'Space Explorer', words: ['GALAXY', 'PLANET', 'METEOR', 'SATURN', 'ROCKET', 'ORBIT', 'COMET', 'NEBULA', 'JUPITER', 'ECLIPSE'] },
    { id: 'amg_ws_sports', builtIn: true, title: 'Game Day', words: ['BASKETBALL', 'SOCCER', 'TENNIS', 'HOCKEY', 'PITCHER', 'DEFENSE', 'REFEREE', 'STADIUM', 'TROPHY', 'CHAMPION'] },
    { id: 'amg_ws_food', builtIn: true, title: 'Snack Attack', words: ['SPAGHETTI', 'AVOCADO', 'PRETZEL', 'BURRITO', 'PANCAKE', 'BROCCOLI', 'SMOOTHIE', 'LASAGNA', 'WAFFLE', 'MANGO'] },
  ],

  // ── Crossword (crossword.html) ──────────────────────────────────────
  crossword: [
    {
      id: 'amg_cw_science', builtIn: true, title: 'Science Starter',
      entries: [
        { word: 'GRAVITY', clue: 'The force that pulls things toward Earth' },
        { word: 'OXYGEN', clue: 'The gas we breathe to stay alive' },
        { word: 'VOLCANO', clue: 'A mountain that can erupt with lava' },
        { word: 'MAGNET', clue: 'It attracts iron and has north/south poles' },
        { word: 'ENERGY', clue: 'The ability to do work; solar or electric ___' },
        { word: 'FOSSIL', clue: 'Remains of ancient life preserved in rock' },
        { word: 'ORBIT', clue: 'The path a planet takes around the sun' },
        { word: 'CELL', clue: 'The smallest unit of life' },
      ],
    },
    {
      id: 'amg_cw_geography', builtIn: true, title: 'Map Master',
      entries: [
        { word: 'EQUATOR', clue: 'Imaginary line around the middle of Earth' },
        { word: 'DESERT', clue: 'A very dry place, like the Sahara' },
        { word: 'ISLAND', clue: 'Land surrounded by water on all sides' },
        { word: 'CANYON', clue: 'A deep valley with steep sides; the Grand ___' },
        { word: 'GLACIER', clue: 'A giant slow-moving river of ice' },
        { word: 'CONTINENT', clue: 'One of seven huge land masses' },
        { word: 'PENINSULA', clue: 'Land surrounded by water on three sides' },
        { word: 'DELTA', clue: 'Where a river fans out to meet the sea' },
      ],
    },
  ],

  // ── Library (library.html) — original passages + quizzes ───────────
  library: [
    {
      id: 'amg_lib_octopus',
      builtIn: true,
      title: 'The Escape Artist of the Sea',
      category: 'Science',
      readingLevel: 'Grades 4-6',
      passage: 'If there were a talent show for ocean animals, the octopus would win almost every category. An octopus has eight arms, three hearts, and blue blood. It has no bones at all, which means a full-grown octopus can squeeze its whole body through a gap the size of a coin.\n\nAquarium workers know octopuses as escape artists. One famous octopus in New Zealand, named Inky, slipped out of his tank at night, crawled across the floor, and escaped down a drainpipe that led to the ocean. He was never seen again.\n\nOctopuses are also masters of disguise. Special cells in their skin, called chromatophores, let them change color in less than a second. They can match the color and even the texture of rocks, sand, or coral. Scientists believe octopuses are among the smartest invertebrates on Earth. They can open jars, solve mazes, and remember solutions to puzzles.\n\nThe next time you visit an aquarium, watch the octopus tank closely. The octopus is probably watching you too — and it might be planning something.',
      questions: [
        { q: 'How many hearts does an octopus have?', options: ['One', 'Two', 'Three', 'Eight'], correct: 2 },
        { q: 'Why can an octopus squeeze through tiny gaps?', options: ['It is very small', 'It has no bones', 'It has slippery skin', 'It can shrink its organs'], correct: 1 },
        { q: 'What are chromatophores?', options: ['Baby octopuses', 'Ocean plants', 'Skin cells that change color', 'A type of coral'], correct: 2 },
        { q: 'What did Inky the octopus do?', options: ['Solved a maze', 'Opened a jar', 'Escaped through a drainpipe', 'Changed colors on TV'], correct: 2 },
      ],
    },
    {
      id: 'amg_lib_cleveland',
      builtIn: true,
      title: 'The City That Rocks',
      category: 'History',
      readingLevel: 'Grades 4-6',
      passage: 'On the shore of Lake Erie sits Cleveland, Ohio — a city with a story of falling down and getting back up. In the early 1900s, Cleveland was one of the biggest cities in America. Its steel mills and factories helped build the country, and its port shipped goods across the Great Lakes.\n\nBut the city hit hard times. Factories closed, people moved away, and in 1969 the Cuyahoga River, thick with oil and pollution, actually caught fire. That fire embarrassed the city — and then it changed the country. The burning river helped inspire new laws to protect America\'s water and air, including the Clean Water Act.\n\nCleveland kept fighting. The river was cleaned up, and today fish swim where flames once burned. The city built world-class hospitals, museums, and theaters. In 1995, the Rock and Roll Hall of Fame opened downtown in a gleaming glass pyramid, celebrating the music the city helped name — a Cleveland DJ named Alan Freed made the term "rock and roll" famous in the 1950s.\n\nCleveland\'s story proves that a comeback is always possible — for a river, for a city, and maybe for anyone.',
      questions: [
        { q: 'What happened to the Cuyahoga River in 1969?', options: ['It flooded the city', 'It caught fire', 'It froze solid', 'It dried up'], correct: 1 },
        { q: 'What good thing came from the river fire?', options: ['New fishing rules', 'Laws protecting water and air', 'A new bridge', 'A famous movie'], correct: 1 },
        { q: 'Who made the term "rock and roll" famous?', options: ['A Cleveland DJ', 'A New York singer', 'A Chicago radio station', 'A famous drummer'], correct: 0 },
        { q: 'What is the main message of this passage?', options: ['Rivers are dangerous', 'Cleveland is the biggest city in Ohio', 'Comebacks are possible', 'Factories are important'], correct: 2 },
      ],
    },
    {
      id: 'amg_lib_videogames',
      builtIn: true,
      title: 'Who Invents a Video Game?',
      category: 'Technology',
      readingLevel: 'Grades 5-7',
      passage: 'Every video game you have ever played started as an idea in someone\'s head. But turning that idea into a game takes a whole team of different talents.\n\nGame designers decide the rules: What is the goal? What makes it fun? What makes it hard — but not too hard? Designers often build "paper prototypes" first, testing ideas with dice and index cards before writing any code.\n\nProgrammers bring the rules to life. They write the code that makes a character jump exactly the right height, or makes an enemy chase you but not too well. A single second of gameplay can involve thousands of calculations.\n\nArtists create everything you see — characters, backgrounds, buttons, even the little sparkle when you collect a coin. Sound designers create everything you hear, from background music to the satisfying "pop" of a bubble.\n\nFinally, testers play the game over and over, hunting for bugs — glitches where the game breaks. Finding bugs is not failure; it is the whole point. Every great game shipped with hundreds of bugs found and fixed first.\n\nThe best part? Many game creators started as kids who simply loved playing games and wondered, "How does this work?" If you have ever asked that question, you have already taken the first step.',
      questions: [
        { q: 'What does a game designer decide?', options: ['The code', 'The rules and the fun', 'The music', 'The price'], correct: 1 },
        { q: 'What is a "paper prototype"?', options: ['A paper airplane', 'Game instructions', 'A test version made with cards and dice', 'A drawing of a character'], correct: 2 },
        { q: 'According to the passage, finding bugs is...', options: ['failure', 'rare', 'the whole point of testing', 'the programmer\'s fault'], correct: 2 },
        { q: 'What is the first step to becoming a game creator?', options: ['Learning to code', 'Buying a computer', 'Going to college', 'Wondering how games work'], correct: 3 },
      ],
    },
    {
      id: 'amg_lib_money',
      builtIn: true,
      title: 'The Allowance Experiment',
      category: 'Life Skills',
      readingLevel: 'Grades 4-6',
      passage: 'Maya\'s grandmother made her an offer. "I\'ll give you $20 for the month," she said, "or I\'ll give you one penny today and double it every day for two weeks. Your choice."\n\nMaya almost laughed. A penny? She took the $20 and felt like a genius.\n\nHer cousin Jordan took the penny deal. On day one, he had one cent. On day two, two cents. By day seven, only 64 cents. Maya teased him all week.\n\nBut then something strange happened. Day eight: $1.28. Day ten: $5.12. Day twelve: $20.48 — already more than Maya\'s deal. On day fourteen, their grandmother handed Jordan $81.92.\n\n"That\'s not fair!" Maya said. Her grandmother smiled. "That, my dear, is compound growth. Money that grows on top of money. It starts slow and boring — then it explodes."\n\nMaya learned the lesson every investor knows: the pattern matters more than the starting number. Something small that keeps doubling will eventually beat something big that stays still. That is why saving early — even tiny amounts — is one of the most powerful money moves anyone can make.\n\nThe next month, Maya took the penny deal.',
      questions: [
        { q: 'How much money did Jordan have on day fourteen?', options: ['$20.48', '$40.96', '$81.92', '$100.00'], correct: 2 },
        { q: 'What is "compound growth"?', options: ['Money that grows on top of money', 'A gardening technique', 'A type of allowance', 'Money that doubles once'], correct: 0 },
        { q: 'Why did Maya think she was a genius at first?', options: ['She invested early', 'The $20 seemed obviously bigger than a penny', 'She negotiated a better deal', 'She split the money with Jordan'], correct: 1 },
        { q: 'What lesson does the story teach?', options: ['Never trust grandparents', 'Big numbers always win', 'The growth pattern matters more than the start', 'Pennies are worthless'], correct: 2 },
      ],
    },
  ],
};
