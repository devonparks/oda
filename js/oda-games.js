/* ============================================
   ODA Games Registry — single source of truth
   Used by both student.js and teacher.html
   ============================================ */
window.ODA_GAMES=[
// Multiplayer
{id:'connect4',emoji:'\u{1F534}',title:'Connect 4',desc:'Drop 4 in a row to win!',file:'arcade/connect4/index.html',cat:'multiplayer',colors:['#ef4444','#fbbf24'],categories:['Multiplayer','Strategy']},
{id:'tictactoe',emoji:'\u274C',title:'Tic Tac Toe',desc:'Classic X vs O strategy',file:'arcade/tictactoe/index.html',cat:'multiplayer',colors:['#ef476f','#118ab2'],categories:['Multiplayer']},
{id:'rps',emoji:'\u270A',title:'Rock Paper Scissors',desc:'Best of 3 — read your opponent!',file:'arcade/rps/index.html',cat:'multiplayer',colors:['#06d6a0','#ffd166'],categories:['Multiplayer']},
{id:'chess',emoji:'\u265A',title:'Chess',desc:'The ultimate strategy game',file:'arcade/chess/index.html',cat:'strategy',colors:['#1a1a2e','#e2d5b7'],categories:['Multiplayer','Strategy']},
{id:'checkers',emoji:'\u26C0',title:'Checkers',desc:'Jump, capture, king your pieces!',file:'arcade/checkers/index.html',cat:'strategy',colors:['#dc2626','#111827'],categories:['Multiplayer','Strategy']},
{id:'battleship',emoji:'\u{1F6A2}',title:'Battleship',desc:'Find and sink the fleet!',file:'arcade/battleship/index.html',cat:'multiplayer',colors:['#1e3a5f','#22d3ee'],categories:['Multiplayer','Strategy']},
{id:'uno',emoji:'\u{1F3B4}',title:'Uno',desc:'Match colors, empty your hand!',file:'arcade/uno/index.html',cat:'multiplayer',colors:['#ef4444','#fbbf24'],categories:['Multiplayer']},
{id:'dominoes',emoji:'\u{1F3B2}',title:'Dominoes',desc:'Match tiles, outsmart your opponent',file:'arcade/dominoes/index.html',cat:'multiplayer',colors:['#f5f0e8','#1a1a2e'],categories:['Multiplayer','Strategy']},
{id:'penaltykick',emoji:'\u26BD',title:'Penalty Kick',desc:'Aim, shoot, save — score goals!',file:'arcade/penaltykick/index.html',cat:'multiplayer',colors:['#16a34a','#fafafa'],categories:['Multiplayer','Sports']},
{id:'pingpong',emoji:'\u{1F3D3}',title:'Ping Pong',desc:'Classic pong — beat the AI!',file:'arcade/pingpong/index.html',cat:'multiplayer',colors:['#1e293b','#06d6a0'],categories:['Multiplayer','Sports']},
{id:'war',emoji:'\u{1F0CF}',title:'War',desc:'Flip cards — highest wins!',file:'arcade/war/index.html',cat:'multiplayer',colors:['#1e3a5f','#dc2626'],categories:['Multiplayer']},
// Arcade
{id:'snake',emoji:'\u{1F40D}',title:'Snake',desc:'Eat, grow, survive!',file:'arcade/snake/index.html',cat:'arcade',colors:['#06d6a0','#0a0e1a'],categories:['Action']},
{id:'flappy',emoji:'\u{1F426}',title:'Floppy Bird',desc:'Tap to fly, dodge the pipes!',file:'arcade/flappy/index.html',cat:'arcade',colors:['#fbbf24','#1e3a5f'],categories:['Action']},
{id:'fruitninja',emoji:'\u{1F52A}',title:'Fruit Ninja',desc:'Slash fruits, get combos!',file:'arcade/fruitninja/index.html',cat:'arcade',colors:['#ef4444','#16a34a'],categories:['Action']},
{id:'brickbreaker',emoji:'\u{1F9F1}',title:'Brick Breaker',desc:'Smash bricks, earn power-ups!',file:'arcade/brickbreaker/index.html',cat:'arcade',colors:['#ef4444','#3b82f6'],categories:['Action']},
{id:'whackamole',emoji:'\u{1F439}',title:'Whack-a-Mole',desc:'Whack moles before they hide!',file:'arcade/whackamole/index.html',cat:'arcade',colors:['#854d0e','#16a34a'],categories:['Action']},
{id:'aimtrainer',emoji:'\u{1F3AF}',title:'Aim Trainer',desc:'Test your reflexes!',file:'arcade/aimtrainer/index.html',cat:'arcade',colors:['#dc2626','#fafafa'],categories:['Action']},
{id:'coinminer',emoji:'\u{1FA99}',title:'Coin Miner',desc:'Tap to mine, buy upgrades!',file:'arcade/coinminer/index.html',cat:'arcade',colors:['#fbbf24','#7c3aed'],categories:['Action']},
{id:'reaction',emoji:'\u26A1',title:'Reaction Time',desc:'How fast can you click?',file:'arcade/reaction/index.html',cat:'arcade',colors:['#ef4444','#06d6a0'],categories:['Action']},
{id:'helicopter',emoji:'\u{1F681}',title:'Helicopter',desc:'Fly through the cave!',file:'arcade/helicopter/index.html',cat:'arcade',colors:['#3b82f6','#374151'],categories:['Action']},
{id:'doodlejump',emoji:'\u{1F438}',title:'Doodle Jump',desc:'Bounce higher and higher!',file:'arcade/doodlejump/index.html',cat:'arcade',colors:['#4ade80','#1a1a2e'],categories:['Action']},
{id:'colormatch',emoji:'\u{1F3A8}',title:'Color Match',desc:'Read the color, not the word!',file:'arcade/colormatch/index.html',cat:'arcade',colors:['#ef4444','#3b82f6'],categories:['Action','Puzzle']},
{id:'mathsprint',emoji:'\u2795',title:'Math Sprint',desc:'Rapid fire math — solve fast!',file:'arcade/mathsprint/index.html',cat:'arcade',colors:['#3b82f6','#fbbf24'],categories:['Action','Puzzle']},
{id:'stacktower',emoji:'\u{1F3D7}',title:'Stack Tower',desc:'Time your drops, build high!',file:'arcade/stacktower/index.html',cat:'arcade',colors:['#f97316','#8b5cf6'],categories:['Action']},
{id:'dodgeball',emoji:'\u{1F3C3}',title:'Dodge Ball',desc:'Dodge falling objects, collect coins!',file:'arcade/dodgeball/index.html',cat:'arcade',colors:['#06d6a0','#ef4444'],categories:['Action']},
// Puzzle
{id:'2048',emoji:'\u{1F522}',title:'2048',desc:'Slide and merge to 2048!',file:'arcade/2048/index.html',cat:'puzzle',colors:['#f59e0b','#1a1a2e'],categories:['Puzzle']},
{id:'solitaire',emoji:'\u{1F0CF}',title:'Solitaire',desc:'Classic card game!',file:'arcade/solitaire/index.html',cat:'puzzle',colors:['#16a34a','#dc2626'],categories:['Puzzle']},
{id:'blockblast',emoji:'\u{1F9F1}',title:'Block Blast',desc:'Place blocks, clear lines!',file:'arcade/blockblast/index.html',cat:'puzzle',colors:['#3b82f6','#ec4899'],categories:['Puzzle']},
{id:'suika',emoji:'\u{1F349}',title:'Suika Game',desc:'Drop & merge fruits!',file:'arcade/suika/index.html',cat:'puzzle',colors:['#16a34a','#ef4444'],categories:['Puzzle']},
{id:'simonsays',emoji:'\u{1F3B5}',title:'Simon Says',desc:'Watch, listen, repeat!',file:'arcade/simonsays/index.html',cat:'puzzle',colors:['#ef4444','#3b82f6'],categories:['Puzzle']},
{id:'memory',emoji:'\u{1F9E0}',title:'Memory Match',desc:'Find matching pairs!',file:'arcade/memory/index.html',cat:'puzzle',colors:['#8b5cf6','#06d6a0'],categories:['Puzzle']},
{id:'lightsout',emoji:'\u{1F4A1}',title:'Lights Out',desc:'Toggle lights, solve the puzzle!',file:'arcade/lightsout/index.html',cat:'puzzle',colors:['#06d6a0','#0a0e1a'],categories:['Puzzle']},
{id:'numbermemory',emoji:'\u{1F522}',title:'Number Memory',desc:'How many digits can you remember?',file:'arcade/numbermemory/index.html',cat:'puzzle',colors:['#6366f1','#06d6a0'],categories:['Puzzle']},
{id:'slidingpuzzle',emoji:'\u{1F9E9}',title:'Sliding Puzzle',desc:'Slide tiles into order!',file:'arcade/slidingpuzzle/index.html',cat:'puzzle',colors:['#1e3a5f','#06d6a0'],categories:['Puzzle']},
{id:'minesweeper',emoji:'\u{1F4A3}',title:'Minesweeper',desc:'Find safe cells, avoid mines!',file:'arcade/minesweeper/index.html',cat:'puzzle',colors:['#6b7280','#ef4444'],categories:['Puzzle','Strategy']},
{id:'floodfill',emoji:'\u{1F3A8}',title:'Flood Fill',desc:'Fill the board in fewest moves!',file:'arcade/floodfill/index.html',cat:'puzzle',colors:['#3b82f6','#06d6a0'],categories:['Puzzle','Strategy']},
{id:'sudoku',emoji:'\u{1F9E9}',title:'Sudoku',desc:'Fill every row, column & box!',file:'arcade/sudoku/index.html',cat:'puzzle',colors:['#3b82f6','#06d6a0'],categories:['Puzzle','Strategy']},
// Word
{id:'wordle',emoji:'\u{1F4DD}',title:'Wordle',desc:'Guess the word in 6 tries!',file:'arcade/wordle/index.html',cat:'word',colors:['#16a34a','#fbbf24'],categories:['Puzzle','Word']},
{id:'hangman',emoji:'\u{1F634}',title:'Hangman',desc:'Guess the word in time!',file:'arcade/hangman/index.html',cat:'word',colors:['#6366f1','#f59e0b'],categories:['Puzzle','Word']},
{id:'trivia',emoji:'\u{1F3C1}',title:'Trivia Race',desc:'Race to answer questions!',file:'arcade/trivia/index.html',cat:'word',colors:['#dc2626','#fbbf24'],categories:['Word']},
{id:'typing',emoji:'\u2328\uFE0F',title:'Typing Race',desc:'Type fast, race classmates!',file:'arcade/typing/index.html',cat:'word',colors:['#06d6a0','#1e293b'],categories:['Word']},
{id:'keyboard',emoji:'\u{1F3AE}',title:'Keyboard Warriors',desc:'Type to defeat enemies!',file:'keyboard.html',cat:'word',colors:['#7c3aed','#ef4444'],categories:['Word']},
{id:'wordscramble',emoji:'\u{1F50E}',title:'Word Scramble',desc:'Unscramble the letters!',file:'arcade/wordscramble/index.html',cat:'word',colors:['#3b82f6','#fbbf24'],categories:['Puzzle','Word']},
];
