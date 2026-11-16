/** Situations in London. Schema and style: dev/SITUATIONS_GUIDE.md */
export default [
  {
    id: 'london-bus-stop',
    place: 'london',
    title: 'Waiting for the bus',
    scene: 'Constable Cobb is sheltering from the rain at a bus stop.',
    with: 'bobby',
    level: 1,
    lines: [
      { say: 'Afternoon! Bit chilly today, isn’t it?' },
      {
        ask: 'Say how cold it really is.',
        options: [
          { id: 'its-freezing', right: true, line: 'Chilly? It’s freezing! I can’t feel my toes.', note: '“It’s freezing” means it is extremely cold: much more than chilly!' },
          { id: 'its-boiling', note: '“It’s boiling” means it is extremely hot: the opposite!' },
          { id: 'its-lovely-out', note: '“It’s lovely out” means the weather is pleasant and sunny. Not today!' },
        ],
      },
      { say: 'Brr. And still no sign of the bus. Have you been waiting long?' },
      {
        ask: 'Say you’ve been waiting a very long time.',
        options: [
          { id: 'ive-been-waiting-for-ages', right: true, line: 'Yes, I’ve been waiting for ages!', note: '“I’ve been waiting for ages” is the usual friendly grumble about a long wait.' },
          { id: 'long-time-no-see', note: '“Long time no see” greets a friend you haven’t met for ages. It isn’t about waiting.' },
          { id: 'take-your-time', note: '“Take your time” tells someone there’s no need to hurry. It isn’t about your long wait.' },
        ],
      },
      { say: 'Aha, here it comes at last! Twenty minutes late, though.' },
      {
        ask: 'Say something cheerful about the late bus.',
        options: [
          { id: 'better-late-than-never', right: true, line: 'Oh well, better late than never!', note: '“Better late than never” cheerfully says it’s good that something happens, even if it’s late.' },
          { id: 'on-the-dot', note: '“On the dot” means at exactly the right time. This bus is twenty minutes late!' },
          { id: 'time-flies', note: '“Time flies” means hours pass quickly. Not when you’re waiting for a bus!' },
        ],
      },
      { say: 'Ha, very true! After you, and stay dry!' },
    ],
  },
  {
    id: 'london-bakery-buns',
    place: 'london',
    title: 'Pippa’s new buns',
    scene: 'Pippa wants you to taste her new cinnamon buns at the bakery.',
    with: 'chef',
    level: 1,
    lines: [
      { say: 'Morning! Try my new cinnamon bun, still warm from the oven. What do you think?' },
      {
        ask: 'Say the bun is wonderfully soft and tasty.',
        options: [
          { id: 'melt-in-your-mouth', right: true, line: 'Mmm! It just melts in your mouth.', note: '“Melt in your mouth” means taste wonderfully soft and delicious: top praise for a baker!' },
          { id: 'an-acquired-taste', note: '“An acquired taste” is something you only learn to like over time. Not much of a compliment!' },
          { id: 'not-my-cup-of-tea', note: '“Not my cup of tea” is a polite way to say you don’t like something. Pippa would be sad!' },
        ],
      },
      { say: 'Oh, I’m so glad! They’re just a pound each today.' },
      {
        ask: 'Say that’s a very good price.',
        options: [
          { id: 'its-a-bargain', right: true, line: 'Only a pound? It’s a bargain!', note: '“It’s a bargain” means it’s much cheaper than it’s worth: a happy remark about a price.' },
          { id: 'its-a-rip-off', note: '“It’s a rip-off” means it costs far more than it’s worth: the opposite!' },
          { id: 'on-the-house', note: '“On the house” means free, paid for by the shop. These buns cost a pound.' },
        ],
      },
      { say: 'Oh no, can you smell burning? My next batch! I forgot the timer.' },
      {
        ask: 'Comfort Pippa: it isn’t a disaster.',
        options: [
          { id: 'its-not-the-end-of-the-world', right: true, line: 'Don’t worry, it’s not the end of the world. You can bake some more!', note: '“It’s not the end of the world” kindly says a setback isn’t a disaster.' },
          { id: 'what-a-relief', note: '“What a relief” means you’re glad a worry is over. Pippa’s worry has only just started!' },
          { id: 'i-told-you-so', note: '“I told you so” is a smug reply when your warning came true. Unkind, and you never warned her!' },
        ],
      },
      { say: 'You’re right. Here, have another bun, on the house!' },
    ],
  },
  {
    id: 'london-underground',
    place: 'london',
    title: 'Rupert rides the Underground',
    scene: 'Rupert the corgi is riding the Underground for the very first time.',
    with: 'corgi',
    level: 2,
    lines: [
      { say: 'Woof! Here comes the train! I’m so excited, I’m going to leap straight on!' },
      {
        ask: 'Warn Rupert about the space by the platform edge.',
        options: [
          { id: 'mind-the-gap', right: true, line: 'Careful, Rupert! Mind the gap!', note: '“Mind the gap” warns you to watch the space by the platform edge: London’s famous warning.' },
          { id: 'mind-your-head', note: '“Mind your head” warns about a low ceiling, not a gap by the platform.' },
          { id: 'mind-how-you-go', note: '“Mind how you go” is a kind goodbye, not a warning about a gap.' },
        ],
      },
      { say: 'Phew, made it! Oof, it’s so crowded in here, I can’t even wag my tail.' },
      {
        ask: 'Say how crowded the train is.',
        options: [
          { id: 'packed-like-sardines', right: true, line: 'I know! We’re packed like sardines.', note: '“Packed like sardines” means squeezed together in a tiny space, just like on a busy train.' },
          { id: 'a-fish-out-of-water', note: '“A fish out of water” is someone who feels they don’t belong somewhere. It isn’t about a crowded train.' },
          { id: 'like-two-peas-in-a-pod', note: '“Like two peas in a pod” means very alike, not squashed together.' },
        ],
      },
      { say: 'This is our stop! I’ll race up the escalator and find the park!' },
      {
        ask: 'Tell Rupert to wait and not rush off.',
        options: [
          { id: 'hold-your-horses', right: true, line: 'Hold your horses, Rupert! Let’s stay together.', note: '“Hold your horses” tells someone to wait a moment and not rush: just right for an excited corgi.' },
          { id: 'get-your-skates-on', note: '“Get your skates on” means hurry up: the opposite!' },
          { id: 'let-sleeping-dogs-lie', note: '“Let sleeping dogs lie” means don’t bring up an old problem. Rupert is wide awake!' },
        ],
      },
      { say: 'Sorry! I’m just so excited. Lead the way, and I’ll stay right by your side.' },
    ],
  },
  {
    id: 'london-theatre-interval',
    place: 'london',
    title: 'Ice cream at the interval',
    scene: 'Bellamy the town crier has bought ice creams for the theatre interval.',
    with: 'crier',
    level: 2,
    lines: [
      { say: 'Here’s your ice cream! What a twist: the kind old butler was a ghost all along!' },
      {
        ask: 'Say the twist took you completely by surprise.',
        options: [
          { id: 'i-didnt-see-that-coming', right: true, line: 'I know! I didn’t see that coming at all.', note: '“I didn’t see that coming” means it was a complete surprise: perfect for a twist.' },
          { id: 'i-knew-it', note: '“I knew it” means you expected it all along: the opposite of a surprise.' },
          { id: 'i-didnt-catch-that', note: '“I didn’t catch that” means you didn’t hear what someone said. You heard Bellamy just fine!' },
        ],
      },
      { say: 'And that little dancing dog! The whole audience went wild for him.' },
      {
        ask: 'Say the dog was the star of the evening.',
        options: [
          { id: 'steal-the-show', right: true, line: 'He was brilliant. He stole the show!', note: '“Steal the show” means get the most attention and praise: exactly what the dog did.' },
          { id: 'stage-fright', note: '“Stage fright” is feeling nervous before performing. That dog was fearless!' },
          { id: 'a-drama-queen', note: '“A drama queen” is someone who makes a big fuss about small things. The dog just danced!' },
        ],
      },
      { say: 'There’s the bell! OYEZ, OYEZ! THE SECOND HALF IS STARTING!' },
      {
        ask: 'Ask Bellamy, politely, to be a bit quieter.',
        options: [
          { id: 'keep-the-noise-down', right: true, line: 'Shh, Bellamy! Could you keep the noise down a bit?', note: '“Keep the noise down” asks someone to be quieter. With “could you”, it’s polite.' },
          { id: 'could-you-speak-up-a-bit', note: '“Could you speak up a bit?” asks someone to talk louder. Bellamy is loud enough!' },
          { id: 'put-a-sock-in-it', note: '“Put a sock in it” is a rude way to tell someone to stop talking. Not polite at all!' },
        ],
      },
      { say: 'Oops, sorry! Old town crier’s habit. Come on, back to our seats.' },
    ],
  },
  {
    id: 'london-market-meeting',
    place: 'london',
    title: 'A chance meeting at the market',
    scene: 'You bump into your friend Inspector Finch at a busy street market.',
    with: 'detective',
    level: 3,
    lines: [
      { say: 'Well, well! If it isn’t my old friend!' },
      {
        ask: 'Say hello, surprised to meet him here by chance.',
        options: [
          { id: 'fancy-seeing-you-here', right: true, line: 'Inspector Finch! Fancy seeing you here!', note: '“Fancy seeing you here” is a surprised, friendly hello when you meet someone by chance.' },
          { id: 'how-do-you-do', note: '“How do you do?” is a formal greeting for meeting someone for the very first time. Finch is an old friend!' },
          { id: 'nice-to-put-a-face-to-a-name', note: '“Nice to put a face to a name” is for finally meeting someone you had only heard of. You know Finch!' },
        ],
      },
      { say: 'I’m off duty today, just doing my shopping. And how are you keeping?' },
      {
        ask: 'Say modestly that things are fine.',
        options: [
          { id: 'mustnt-grumble', right: true, line: 'Oh, mustn’t grumble, thanks. And you?', note: '“Mustn’t grumble” is a modest, very British way to say things are fine really.' },
          { id: 'im-fed-up', note: '“I’m fed up” means you’re sick of how things are: the opposite of fine.' },
          { id: 'im-not-fussed', note: '“I’m not fussed” means you don’t mind which one. It answers a choice, not a question about you.' },
        ],
      },
      { say: 'Very well! I’m on the trail of the finest cheese stall in London. Is it far?' },
      {
        ask: 'Say it’s very close.',
        options: [
          { id: 'a-stones-throw', right: true, line: 'Not at all. It’s just a stone’s throw from here, by the flower stall.', note: '“A stone’s throw” means a very short distance away: just what Finch hoped to hear.' },
          { id: 'as-the-crow-flies', note: '“As the crow flies” means measured in a straight line. It doesn’t say how near something is.' },
          { id: 'in-the-middle-of-nowhere', note: '“In the middle of nowhere” means very far from anywhere: the opposite!' },
        ],
      },
      { say: 'Splendid! Case closed. Thank you, and enjoy your shopping!' },
    ],
  },
  {
    id: 'london-park-cricket',
    place: 'london',
    title: 'Cricket in the park',
    scene: 'Archie has brought a bat and ball to your picnic in the park.',
    with: 'cricketer',
    level: 3,
    lines: [
      { say: 'Lovely day for a picnic! Fancy a quick game of cricket first? Here, catch!' },
      {
        ask: 'You drop the ball. Say sorry for being so clumsy.',
        options: [
          { id: 'be-all-fingers-and-thumbs', right: true, line: 'Oops! Sorry, I’m all fingers and thumbs today.', note: '“All fingers and thumbs” means clumsy with your hands: just right for a dropped catch.' },
          { id: 'put-your-foot-in-it', note: '“Put your foot in it” means say something embarrassing by mistake. You dropped a ball!' },
          { id: 'get-cold-feet', note: '“Get cold feet” means suddenly become too nervous to do something. You were brave enough to try!' },
        ],
      },
      { say: 'Never mind! Your turn to bat. What a hit! Oh dear, our only ball is in the pond.' },
      {
        ask: 'Say you’re in a tricky spot now.',
        options: [
          { id: 'a-sticky-wicket', right: true, line: 'Oh no! We’re on a sticky wicket now.', note: '“On a sticky wicket” means in a difficult position. It comes from cricket, too!' },
          { id: 'a-piece-of-cake', note: '“A piece of cake” means something very easy. Getting a ball out of a pond isn’t!' },
          { id: 'the-ball-is-in-your-court', note: '“The ball is in your court” means it’s your turn to act or decide, not that things are tricky.' },
        ],
      },
      { say: 'Wait, look! That duck is pushing our ball back to the bank!' },
      {
        ask: 'Say the duck has rescued your game.',
        options: [
          { id: 'save-the-day', right: true, line: 'Hooray! That duck has saved the day!', note: '“Save the day” means rescue a bad situation at the last moment. Well done, duck!' },
          { id: 'a-sitting-duck', note: '“A sitting duck” is an easy target. It isn’t about rescuing anything.' },
          { id: 'a-dead-duck', note: '“A dead duck” is a plan with no chance of success. This duck is a hero!' },
        ],
      },
      { say: 'Three cheers for the duck! Now, who’s ready for the picnic?' },
    ],
  },
];
