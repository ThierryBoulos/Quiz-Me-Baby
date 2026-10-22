/* IMAD, THE HOST — his lines, word for word from Classic (index.html,
   HOST_LINES). Text only: he speaks in a bubble on the TV, never out loud.
   Placeholders: {team} {other} {captain} {othercap}: the team the moment is
   about, the other one, and their captains; {leader} {trailer} {gap}: the
   scoreboard; {theme} {n} {N}: the round; {pts}: a mini-game prize. */
export const HOST_LINES: Record<string, string[]> = {
  "start": [
    "Are you ready to QUIZ ME BABYYYY?!",
    "Welcome, welcome, welcome! Phones down, brains on, egos at the door.",
    "Tonight: {team} versus {other}. Only one leaves with dignity.",
    "Ladies and gentlemen… and whoever brought the hummus… let's QUIZ!",
    "Captains, you speak for your team. Everyone else, you speak for nobody.",
    "I've seen the questions. Some of you are not ready.",
    "Yalla! Let's see who actually paid attention at school.",
    "Friendships may end tonight. That's fine. That's the game."
  ],
  "round": [
    "Round {n}! Theme: {theme}. Who's feeling confident? Wrong answer, nobody should be.",
    "Round {n}. {theme}. Somebody in this room is about to pretend they knew that.",
    "Next up: {theme}. {captain}, I believe in you. Slightly.",
    "{theme}! I can already hear the arguing.",
    "Round {n}. Deep breaths. Shallow knowledge.",
    "Here comes {theme}. Captains, the floor is yours. The floor is also sticky.",
    "Round {n} of {N}. Still anybody's game. Mostly.",
    "{theme}. Let's go. No pressure. A little pressure."
  ],
  "correct": [
    "YES! {team}, take a bow!",
    "Correct! Somebody's been reading.",
    "That's right! {captain}, you absolute genius.",
    "Nailed it. Frame that answer.",
    "Correct! {other}, are you taking notes?",
    "Ding ding ding! Point to {team}!",
    "Look at {team}, flexing on everyone.",
    "Correct. I'm honestly a bit emotional.",
    "That's the one! Smooth. Very smooth.",
    "Correct! Mama would be proud.",
    "Yes! And with that, {team} becomes slightly more unbearable.",
    "Right answer. {captain}, take the rest of the night off. Actually don't."
  ],
  "wrong": [
    "Ohhhh no. No no no.",
    "Wrong! But said with such confidence.",
    "That's… a choice.",
    "Incorrect. I'll allow you a moment of silence.",
    "Nope! Bold of you, though.",
    "Wrong. {other} are smiling. I'd be worried.",
    "So close! Actually, not close at all.",
    "Wrong. Let's never speak of this again.",
    "Incorrect. Somebody's teacher is crying somewhere.",
    "Hmm. No. Hard no.",
    "Wrong! {captain}, who told you that?",
    "Not quite. Not even the same continent."
  ],
  "timeup": [
    "Time! The clock waits for no one. Especially not you.",
    "Too slow! The answer left without you.",
    "And… time. Thinking is great. Answering is better.",
    "Out of time! That silence was beautiful though.",
    "Buzzer! You had the whole time and used it all to panic.",
    "Time's up. Somewhere, a snail is laughing."
  ],
  "steal": [
    "{other}, it's yours to steal!",
    "Steal time! {other}, eat their lunch.",
    "The door is open, {other}. Walk right in.",
    "{other}, here's your chance to be terrible to your friends.",
    "Steal! {othercap}, look them in the eye and take it.",
    "Up for grabs! {other}, don't make me regret this."
  ],
  "stolen": [
    "STOLEN! Daylight robbery!",
    "{team} just walked out with your point and didn't even say thank you.",
    "Stolen! That's going to sting for a while.",
    "Thief! Brilliant, brilliant thief.",
    "Stolen! {other}, I'd lock up your valuables.",
    "And they take it! Ruthless. I love it."
  ],
  "nosteal": [
    "Nobody gets it! Everybody loses! Wonderful!",
    "Missed the steal. The point floats away into the night.",
    "No steal. Both teams, equally lost.",
    "Wrong again! It's a festival of wrong.",
    "Nobody. Not a single soul. Beautiful."
  ],
  "ll_dbl": [
    "Double points! Big risk, big swagger.",
    "Doubling up? Brave. Or foolish. We'll see.",
    "{team} going double. I respect the chaos."
  ],
  "ll_dip": [
    "Double Dip! Two shots at glory.",
    "Two answers? Greedy. I like it.",
    "Dipping twice. Make them both count."
  ],
  "ll_friend": [
    "Calling a friend! Hope they pick up.",
    "Phone a friend! The friend has no idea what's coming.",
    "Let's hope your friend is smarter than you."
  ],
  "lead": [
    "LEAD CHANGE! {leader} take over!",
    "And just like that, {leader} are on top!",
    "Oh, the tables have turned! {leader} in front!",
    "New leaders! {trailer}, how does it feel?",
    "{leader} go ahead! This is getting spicy.",
    "Plot twist! {leader} now lead!"
  ],
  "big": [
    "{leader} are running away with this. {trailer}, wake up!",
    "{gap} points in it. {trailer}, now would be a great time to be smart.",
    "{leader} cruising. {trailer}, still time… technically.",
    "That's a {gap} point lead. {trailer}, I'm starting a support group.",
    "{trailer}, don't panic. Okay, panic a little."
  ],
  "close": [
    "It's tight! Nobody breathe.",
    "Neck and neck! My heart can't take this.",
    "One point in it. Every answer counts now.",
    "This is closer than my last haircut."
  ],
  "level": [
    "All square! Who wants it more?",
    "Dead level. Back to square one, everybody.",
    "Tied up. It's anybody's night.",
    "Nothing in it. Somebody break the deadlock, please."
  ],
  "mini_closest": [
    "Closest To Wins! Numbers time. Guess big, guess wisely.",
    "Closest To Wins. Nobody needs to be right, just less wrong."
  ],
  "mini_auction": [
    "The Auction! How many can you REALLY name?",
    "The Auction. Bid high, deliver, or be humiliated. Simple."
  ],
  "mini_saysame": [
    "Don't Say the Same as Me! Think different. Think weird.",
    "Great minds think alike. Don't be a great mind."
  ],
  "mini_map": [
    "Guess the Map! Time to find out who paid attention in geography.",
    "Colours, dots, mystery. What on earth is this map?"
  ],
  "mini_flag": [
    "Guess the Flag! Rectangles of national pride.",
    "Flags! Is it Chad? It's always Chad. Or Romania."
  ],
  "mini_pin": [
    "Drop the Pin! Somewhere on this planet. Good luck.",
    "Drop the Pin. Zoom in, captains: every kilometre counts."
  ],
  "mini_airport": [
    "Guess the Airport! Read the board, follow the planes.",
    "Departures! Where are we flying from tonight?"
  ],
  "mini_dish": [
    "Guess the Cocktail or Dish! I hope you ate before this.",
    "Ingredients incoming. First captain to buzz and name it wins. Easy, chef."
  ],
  "mini_battle": [
    "Battle of the Captains! Everyone else, zip it.",
    "Captains only. Teams, sit on your hands."
  ],
  "miniwin": [
    "{team} take the mini-game! {pts} sweet points!",
    "Mini-game to {team}! Did that hurt, {other}?",
    "And {team} win it! Grab those {pts} points.",
    "{team} walk away with it. Classy.",
    "That's {pts} points to {team}. The scoreboard shakes."
  ],
  "sudden": [
    "SUDDEN DEATH! One question. One winner. One very sad team.",
    "It's a tie! We go to sudden death. I love this part.",
    "Sudden death! Captains, step forward. Hands steady.",
    "Tied! First right answer wins it all. No pressure. All the pressure."
  ],
  "final": [
    "And the winner is… {leader}! Quiz me, baby!",
    "{leader} WIN! Champions! Unbearable! Champions!",
    "It's over! {leader} take the night! {trailer}, there's always next time.",
    "Congratulations {leader}! You may now be smug for one week.",
    "{leader} win! {trailer}, you were great. Not good enough, but great.",
    "Victory to {leader}! Somebody tell the neighbours."
  ],
  "finaltie": [
    "A draw! Everybody wins! Nobody wins! Philosophy!",
    "Tied at the end. Fine. Rematch. Now.",
    "Dead level! You're all equally brilliant. Or equally lost."
  ]
};
