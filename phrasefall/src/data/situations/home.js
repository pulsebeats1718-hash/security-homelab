/** Situations on Home Island. Schema and style: dev/SITUATIONS_GUIDE.md */
export default [
  {
    id: 'home-rainy-fete',
    place: 'home',
    title: 'Rain at the village fête',
    scene: 'Puddle is setting up a cake stall when the clouds roll in.',
    with: 'duck',
    level: 1,
    lines: [
      { say: 'Oh dear, look at those clouds! The fête starts in ten minutes.' },
      {
        ask: 'Say how hard it is raining now.',
        options: [
          { id: 'rain-cats-and-dogs', right: true, line: 'Too late, it’s raining cats and dogs!', note: '“Raining cats and dogs” means raining very heavily: just right for a downpour.' },
          { id: 'under-the-weather', note: '“Under the weather” means feeling a bit ill. It is not about rain.' },
          { id: 'cheer-up', note: '“Cheer up” tells someone to be happier. It says nothing about the weather.' },
        ],
      },
      { say: 'My cakes will get soggy! Could you help me move the stall under the tree?' },
      {
        ask: 'Offer to help.',
        options: [
          { id: 'lend-a-hand', right: true, line: 'Of course, I’ll lend a hand. You take that end!', note: '“Lend a hand” means help with a job: a friendly yes.' },
          { id: 'call-it-a-day', note: '“Call it a day” means stop working for now: the opposite of helping.' },
          { id: 'help-yourself', note: '“Help yourself” invites someone to take food or drink. It is not an offer of help.' },
        ],
      },
      { say: 'Phew, thank you! The sun might come out later.' },
      {
        ask: 'Hope for better weather.',
        options: [
          { id: 'fingers-crossed', right: true, line: 'Fingers crossed! Then everyone can come.', note: '“Fingers crossed” means let’s hope for good luck: perfect here.' },
          { id: 'never-mind', note: '“Never mind” means it is not important, so forget it. It is not a hope.' },
          { id: 'how-embarrassing', note: '“How embarrassing” is for an awkward moment, not for hoping.' },
        ],
      },
      { say: 'Have a slice of lemon cake for your trouble. You’re a star!' },
    ],
  },
  {
    id: 'home-tea-at-brambles',
    place: 'home',
    title: 'Tea at Bramble’s',
    scene: 'After a long walk, you knock on the door of Bramble’s cosy cottage.',
    with: 'bear',
    level: 1,
    lines: [
      { say: 'Hello! Come in, come in. Did you really walk all the way round the island?' },
      {
        ask: 'Say how tired you are.',
        options: [
          { id: 'im-shattered', right: true, line: 'I did, and I’m shattered! My legs feel like jelly.', note: '“I’m shattered” means you are completely exhausted: just right after a long walk.' },
          { id: 'im-skint', note: '“I’m skint” means you have no money right now. It has nothing to do with being tired.' },
          { id: 'im-stuffed', note: '“I’m stuffed” means you are too full to eat any more. That comes after a big meal!' },
        ],
      },
      { say: 'Then sit down and put your feet up. Fancy a cuppa?' },
      {
        ask: 'Say yes to a cup of tea.',
        options: [
          { id: 'i-wouldn-t-say-no', right: true, line: 'Ooh, I wouldn’t say no!', note: '“I wouldn’t say no” is a friendly, understated yes: perfect when someone offers you a cuppa.' },
          { id: 'id-rather-not', note: '“I’d rather not” is a polite no, so you would miss out on your tea!' },
          { id: 'suit-yourself', note: '“Suit yourself” means do what you like, often said a bit huffily. It would sound rude here.' },
        ],
      },
      { say: 'Here you are: a nice cup of tea and a big slice of honey cake.' },
      { you: 'Mmm, delicious! Thank you, Bramble.' },
      { say: 'Goodness, look out of the window. The sun’s going down already!' },
      {
        ask: 'Say politely that it’s time for you to go home.',
        options: [
          { id: 'id-better-be-off', right: true, line: 'Then I’d better be off before it gets dark. Thanks for the tea!', note: '“I’d better be off” is a friendly, polite way to say it’s time for you to leave.' },
          { id: 'make-yourself-at-home', note: '“Make yourself at home” is what a host says to a guest who has just arrived, not a goodbye.' },
          { id: 'pleased-to-meet-you', note: '“Pleased to meet you” is for meeting someone for the first time, not for leaving.' },
        ],
      },
      { say: 'Mind how you go! And do pop round again soon.' },
    ],
  },
  {
    id: 'home-shooting-stars',
    place: 'home',
    title: 'Shooting stars at midnight',
    scene: 'Professor Hoot has set up a telescope on the hill above the harbour.',
    with: 'owl',
    level: 2,
    lines: [
      { say: 'Welcome! The shooting stars should start any minute now. Not too sleepy, I hope?' },
      {
        ask: 'Explain that you always get up very early.',
        options: [
          { id: 'up-with-the-lark', right: true, line: 'A bit! I’m normally in bed by nine and up with the lark.', note: '“Up with the lark” means awake very early in the morning: no wonder midnight feels late!' },
          { id: 'a-night-owl', note: '“A night owl” is someone who loves staying up late. That’s Professor Hoot, not you!' },
          { id: 'count-sheep', note: '“Count sheep” means try to fall asleep with a mental trick. It isn’t about getting up early.' },
        ],
      },
      { say: 'Ha! I’m a night owl myself, of course. Oh, look! There goes one!' },
      {
        ask: 'Say you hardly ever get to see one.',
        options: [
          { id: 'once-in-a-blue-moon', right: true, line: 'Wow! I only see one of those once in a blue moon.', note: '“Once in a blue moon” means very rarely: just right for a shooting star.' },
          { id: 'time-after-time', note: '“Time after time” means again and again, which is the opposite of rarely.' },
          { id: 'in-the-blink-of-an-eye', note: '“In the blink of an eye” means extremely quickly. It’s about speed, not how often.' },
        ],
      },
      { say: 'That’s twenty-three! Goodness, it’s two o’clock, and you’re yawning again.' },
      {
        ask: 'Suggest stopping and going to bed.',
        options: [
          { id: 'call-it-a-night', right: true, line: 'Shall we call it a night? I can hardly keep my eyes open.', note: '“Call it a night” means stop for the evening and go home or to bed: perfect at two in the morning.' },
          { id: 'burn-the-midnight-oil', note: '“Burn the midnight oil” means work or study late into the night, not go to bed.' },
          { id: 'rise-and-shine', note: '“Rise and shine” is a cheerful call to wake up in the morning: the wrong end of the night!' },
        ],
      },
      { say: 'Good idea. Sleep well, and thank you for keeping an old owl company!' },
    ],
  },
  {
    id: 'home-harbour-fishing',
    place: 'home',
    title: 'Fishing off the harbour wall',
    scene: 'It’s a sunny morning, and Conker is fishing at the little harbour.',
    with: 'hedgehog',
    level: 2,
    lines: [
      { say: 'Morning! I’ve been fishing for an hour and caught nothing. Do you want a turn?' },
      {
        ask: 'Say yes, you’ll give it a try.',
        options: [
          { id: 'have-a-bash', right: true, line: 'Ooh, yes please. I’ll have a bash!', note: '“Have a bash” is a breezy British way to say you’ll give something a try.' },
          { id: 'chicken-out', note: '“Chicken out” means decide not to do something because you’re scared. That’s a no!' },
          { id: 'rather-you-than-me', note: '“Rather you than me” means you’re glad you don’t have to do it. Here, it means no thanks!' },
        ],
      },
      { say: 'Hold the rod like this, and cast. Wow, you’ve caught one already! How?' },
      {
        ask: 'Say it was just luck, as it’s your first time.',
        options: [
          { id: 'beginners-luck', right: true, line: 'I’ve no idea. It must be beginner’s luck!', note: '“Beginner’s luck” is a newcomer’s success by chance: a modest, friendly answer.' },
          { id: 'just-my-luck', note: '“Just my luck” is a grumble when something bad happens to you again. Your luck was good!' },
          { id: 'push-your-luck', note: '“Push your luck” means take a risk by asking for too much. It doesn’t explain a lucky catch.' },
        ],
      },
      { say: 'My turn. Oh, a bite! Oh no, it got away! It was as big as a whale!' },
      {
        ask: 'Say kindly that you don’t believe him.',
        options: [
          { id: 'you-re-pulling-my-leg', right: true, line: 'As big as a whale? You’re pulling my leg!', note: '“You’re pulling my leg” is a friendly way to say you don’t believe someone’s story.' },
          { id: 'break-a-leg', note: '“Break a leg” wishes a performer good luck before a show. Conker isn’t on stage!' },
          { id: 'cost-an-arm-and-a-leg', note: '“Cost an arm and a leg” means be very expensive. It isn’t about whether a story is true.' },
        ],
      },
      { say: 'Well, maybe as big as a teapot. Come on, let’s cook your fish for lunch!' },
    ],
  },
  {
    id: 'home-secret-party',
    place: 'home',
    title: 'Planning a secret party',
    scene: 'Biscuit is secretly planning a birthday party for Bramble.',
    with: 'cat',
    level: 3,
    lines: [
      { say: 'Psst! I’m planning a surprise party for Bramble’s birthday. Can you keep a secret?' },
      {
        ask: 'Promise to keep the secret.',
        options: [
          { id: 'mums-the-word', right: true, line: 'Of course. Mum’s the word!', note: '“Mum’s the word” is a light-hearted promise to say nothing: perfect for a surprise.' },
          { id: 'spill-the-beans', note: '“Spill the beans” means tell people a secret: the very thing you mustn’t do!' },
          { id: 'a-little-bird-told-me', note: '“A little bird told me” means you heard some news from someone you won’t name. It’s no promise.' },
        ],
      },
      { say: 'Purr-fect. Shall we keep it small, or invite the whole village and have a band?' },
      {
        ask: 'Say you should make it a really big celebration.',
        options: [
          { id: 'push-the-boat-out', right: true, line: 'It’s his birthday! Let’s push the boat out and invite everyone.', note: '“Push the boat out” means spend generously to celebrate: just right for a big party.' },
          { id: 'rock-the-boat', note: '“Rock the boat” means cause trouble when things are calm. Not very party-like!' },
          { id: 'miss-the-boat', note: '“Miss the boat” means be too late to take a chance. It says nothing about a big party.' },
        ],
      },
      { say: 'Hooray! And look, I’ve baked the cake already. Isn’t it the finest you’ve ever seen?' },
      {
        ask: 'Tease Biscuit for looking so pleased with herself.',
        options: [
          { id: 'like-the-cat-that-got-the-cream', right: true, line: 'It’s lovely! But you look like the cat that got the cream.', note: '“Like the cat that got the cream” means looking very pleased with yourself: a gentle tease.' },
          { id: 'curiosity-killed-the-cat', note: '“Curiosity killed the cat” warns someone not to ask too many questions. It isn’t a tease about pride.' },
          { id: 'a-scaredy-cat', note: '“A scaredy-cat” is someone who is easily frightened. Biscuit is proud, not scared!' },
        ],
      },
      { say: 'Well, I am rather proud of it. Bramble is going to love it!' },
    ],
  },
  {
    id: 'home-prize-carrots',
    place: 'home',
    title: 'Clover’s prize carrots',
    scene: 'Clover is picking vegetables for tomorrow’s village show.',
    with: 'bunny',
    level: 3,
    lines: [
      { say: 'Look at these carrots! They’re the biggest I’ve ever grown.' },
      {
        ask: 'Praise Clover’s gardening skills.',
        options: [
          { id: 'have-green-fingers', right: true, line: 'They’re enormous! You really have green fingers.', note: '“Have green fingers” means be good at growing plants: the perfect praise for Clover.' },
          { id: 'as-green-as-grass', note: '“As green as grass” means new and without experience. Clover is no beginner!' },
          { id: 'give-the-green-light', note: '“Give the green light” means officially allow something to start. It isn’t a compliment.' },
        ],
      },
      { say: 'Aw, thank you! Do you think they could win first prize tomorrow?' },
      {
        ask: 'Say you’re sure they will win.',
        options: [
          { id: 'a-dead-cert', right: true, line: 'First prize? They’re a dead cert!', note: '“A dead cert” is something sure to happen: you’re certain they’ll win.' },
          { id: 'a-long-shot', note: '“A long shot” is something unlikely to succeed: the opposite of what you mean.' },
          { id: 'a-dark-horse', note: '“A dark horse” is someone with surprising hidden talents, not a sure winner.' },
        ],
      },
      { say: 'Ooh, I hope so! Here, take a bag home with you. I grew far too many.' },
      {
        ask: 'Thank Clover for the surprise present.',
        options: [
          { id: 'you-shouldnt-have', right: true, line: 'Oh, Clover, you shouldn’t have! Thank you.', note: '“You shouldn’t have” is a polite, grateful reply when someone gives you a present.' },
          { id: 'dont-go-to-any-trouble', note: '“Don’t go to any trouble” asks someone not to make a special effort for you. It isn’t a thank-you.' },
          { id: 'my-treat', note: '“My treat” means I’m paying for you. The giver says it, not the person who receives.' },
        ],
      },
      { say: 'Don’t be silly. Friends share their carrots! See you at the show.' },
    ],
  },
];
