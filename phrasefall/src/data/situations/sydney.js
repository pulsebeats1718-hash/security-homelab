/** Situations in Sydney. Schema and style: dev/SITUATIONS_GUIDE.md */
export default [
  {
    id: 'sydney-sunny-beach',
    place: 'sydney',
    title: 'A hot day at the beach',
    scene: 'A bright summer morning at the beach. Ollie is getting ready for a dive.',
    with: 'diver',
    level: 1,
    lines: [
      { say: 'Morning! Perfect day for a swim, isn’t it?' },
      {
        ask: 'Say it is very hot.',
        options: [
          { id: 'its-boiling', right: true, line: 'It’s boiling already, and it’s only nine o’clock!', note: '“It’s boiling” means it is extremely hot: just right for a summer morning in Sydney.' },
          { id: 'its-freezing', note: '“It’s freezing” means it is extremely cold: the opposite!' },
          { id: 'its-drizzling', note: '“It’s drizzling” means light rain is falling. There isn’t a cloud in the sky.' },
        ],
      },
      { say: 'The sun here is very strong, even in the morning. You can get sunburnt fast.' },
      {
        ask: 'Say you’ll protect your skin before you swim.',
        options: [
          { id: 'put-on-sun-cream', right: true, line: 'Then I’ll put on some sun cream first.', note: '“Put on sun cream” means spread it on your skin: the first thing to do under a strong sun.' },
          { id: 'soak-up', note: '“Soak up the sun” means relax and enjoy the sunshine. It won’t protect your skin!' },
          { id: 'put-on-the-heating', note: '“Put on the heating” means switch the heating on. On a boiling day? No, thanks!' },
        ],
      },
      { say: 'Good thinking! A hat and a T-shirt help too.' },
      {
        ask: 'Agree that it’s wise to be careful.',
        options: [
          { id: 'better-safe-than-sorry', right: true, line: 'Good idea. Better safe than sorry!', note: '“Better safe than sorry” means it’s wise to be careful now rather than regret it later.' },
          { id: 'play-with-fire', note: '“Play with fire” means do something risky: the opposite of being careful.' },
          { id: 'rather-you-than-me', note: '“Rather you than me” means you’re glad you don’t have to do something. It isn’t agreeing.' },
        ],
      },
      { say: 'Exactly! Right, let’s go and say hello to the fish.' },
    ],
  },
  {
    id: 'sydney-cafe-breakfast',
    place: 'sydney',
    title: 'Late for breakfast',
    scene: 'A sunny café by the harbour. Bao arrives, a little out of breath.',
    with: 'panda',
    level: 1,
    lines: [
      { say: 'Sorry I’m late! The ferry was really slow this morning.' },
      {
        ask: 'Say it doesn’t matter.',
        options: [
          { id: 'no-worries', right: true, line: 'No worries! I’ve been enjoying the view.', note: '“No worries” is a friendly reply to an apology: it means that’s fine.' },
          { id: 'no-thanks', note: '“No thanks” politely turns down an offer. Bao didn’t offer you anything.' },
          { id: 'no-chance', note: '“No chance” means something will definitely not happen. It would sound unfriendly here.' },
        ],
      },
      { say: 'Phew! After breakfast, do you want to walk along the cliffs to the next beach?' },
      {
        ask: 'Accept the invitation warmly.',
        options: [
          { id: 'id-love-to', right: true, line: 'I’d love to! I’ve heard the views are amazing.', note: '“I’d love to” is a warm, polite way to say yes to an invitation.' },
          { id: 'i-d-love-to-but', note: '“I’d love to, but…” is a polite way to say no. The “but” changes everything!' },
          { id: 'i-doubt-it', note: '“I doubt it” means you don’t think something is true. It doesn’t answer an invitation.' },
        ],
      },
      { say: 'Great! Oh, here comes the bill.' },
      {
        ask: 'Offer to pay for both of you.',
        options: [
          { id: 'my-treat', right: true, line: 'Put your money away. Breakfast is my treat!', note: '“My treat” means you are paying for someone else: a kind offer between friends.' },
          { id: 'lets-split-the-bill', note: '“Let’s split the bill” means you share the cost. You wanted to pay for both!' },
          { id: 'im-skint', note: '“I’m skint” means you have no money: not a great way to offer to pay!' },
        ],
      },
      { say: 'Aw, thank you! Then the ice creams are on me later.' },
    ],
  },
  {
    id: 'sydney-harbour-ferry',
    place: 'sydney',
    title: 'Across the harbour',
    scene: 'Captain Marlow’s ferry is crossing the harbour on a bright, breezy day.',
    with: 'pirate',
    level: 2,
    lines: [
      { say: 'Ahoy there! Welcome aboard. Would you like to help me steer?' },
      {
        ask: 'Say yes, but ask her to teach you first.',
        options: [
          { id: 'show-someone-the-ropes', right: true, line: 'Yes, please! But you’ll have to show me the ropes.', note: '“Show someone the ropes” means teach them how something works: perfect for your first go.' },
          { id: 'rock-the-boat', note: '“Rock the boat” means cause trouble when things are calm. Not what a captain wants to hear!' },
          { id: 'jump-ship', note: '“Jump ship” means suddenly leave a job or team. You want to stay and learn!' },
        ],
      },
      { say: 'Easy! Hold the wheel like this, and keep her nice and straight.' },
      {
        ask: 'Say it’s easier than you expected.',
        options: [
          { id: 'plain-sailing', right: true, line: 'Oh, this is plain sailing! I could do this all day.', note: '“Plain sailing” means easy and trouble-free: a perfect fit out on the water.' },
          { id: 'all-at-sea', note: '“All at sea” means confused and not knowing what to do: the opposite of how you feel.' },
          { id: 'in-deep-water', note: '“In deep water” means in serious trouble. Luckily, you’re not!' },
        ],
      },
      { say: 'Ha! Spoken like a true sailor. Look over there: dolphins!' },
      {
        ask: 'Say you’ll watch carefully for more.',
        options: [
          { id: 'keep-your-eyes-peeled', right: true, line: 'Amazing! I’ll keep my eyes peeled for more.', note: '“Keep your eyes peeled” means watch carefully for something: just right for spotting dolphins.' },
          { id: 'turn-a-blind-eye', note: '“Turn a blind eye” means pretend not to notice something wrong. You want to see everything!' },
          { id: 'see-eye-to-eye', note: '“See eye to eye” means agree with someone. It isn’t about watching.' },
        ],
      },
      { say: 'You’ve got sharp eyes! And look, there’s the Harbour Bridge.' },
    ],
  },
  {
    id: 'sydney-sizzling-barbecue',
    place: 'sydney',
    title: 'A sizzling barbecue',
    scene: 'A sunny park by the water. You arrive just as Ember lights the barbecue…',
    with: 'dragon',
    level: 2,
    lines: [
      { say: 'Oh no, I puffed too hard! The sausages are burnt to a crisp. I’m so sorry!' },
      {
        ask: 'Comfort him: it’s only a small accident.',
        options: [
          { id: 'these-things-happen', right: true, line: 'Don’t worry, these things happen! There are plenty more.', note: '“These things happen” gently says a small accident is normal: just what Ember needs to hear.' },
          { id: 'what-a-nightmare', note: '“What a nightmare” says something is awful and stressful. It would make Ember feel even worse.' },
          { id: 'it-serves-you-right', note: '“It serves you right” says someone deserves their bad luck. Very unkind to poor Ember!' },
        ],
      },
      { say: 'Phew, thanks! I’ve got burgers and fish too. Which would you like?' },
      {
        ask: 'Say you’re happy with either.',
        options: [
          { id: 'im-not-fussed', right: true, line: 'I’m not fussed. They both smell delicious!', note: '“I’m not fussed” is a relaxed British way to say you don’t mind which.' },
          { id: 'im-not-keen', note: '“I’m not keen” means you don’t really like something. Ember might think you want neither!' },
          { id: 'whatever', note: '“Whatever” shows you don’t care, and it often sounds rude. Not kind to your host!' },
        ],
      },
      { say: 'Then you get one of each! Enjoy.' },
      { you: 'Mmm, that was lovely. Thank you!' },
      { say: 'My pleasure! Now, who has room for some pavlova?' },
      {
        ask: 'Say you’re very full already.',
        options: [
          { id: 'im-stuffed', right: true, line: 'I’m stuffed! But there’s always room for pavlova.', note: '“I’m stuffed” means you’re too full to eat any more. Well, almost!' },
          { id: 'im-gutted', note: '“I’m gutted” means very disappointed. It has nothing to do with your tummy!' },
          { id: 'im-chuffed', note: '“I’m chuffed” means very pleased. It sounds like “stuffed”, but it isn’t about food.' },
        ],
      },
      { say: 'Ha! That’s the spirit. I’ll cut you a big slice.' },
    ],
  },
  {
    id: 'sydney-surf-lesson',
    place: 'sydney',
    title: 'Your first surf lesson',
    scene: 'Big blue waves roll onto the beach. Marina is ready to teach you to surf.',
    with: 'mermaid',
    level: 3,
    lines: [
      { say: 'Welcome to your first surf lesson! The waves are perfect today.' },
      {
        ask: 'Admit that the waves look too hard for you.',
        options: [
          { id: 'out-of-your-depth', right: true, line: 'They look huge! I feel a bit out of my depth.', note: '“Out of your depth” means facing something too hard for you: an honest way to admit nerves.' },
          { id: 'out-of-the-woods', note: '“Out of the woods” means no longer in danger. You haven’t even started yet!' },
          { id: 'be-out-of-sorts', note: '“Out of sorts” means a bit unwell or grumpy. You’re just nervous about the waves.' },
        ],
      },
      { say: 'Don’t worry, we’ll start where it’s shallow. Paddle, then jump up when a wave comes!' },
      { you: 'Here goes… whoa! Splash! And again… splash!' },
      { say: 'Two tumbles! That’s normal. Want to try once more?' },
      {
        ask: 'Say you hope the next try will work.',
        options: [
          { id: 'third-time-lucky', right: true, line: 'Yes! Third time lucky!', note: '“Third time lucky” hopes your next try will work after two that didn’t: perfect timing.' },
          { id: 'once-bitten-twice-shy', note: '“Once bitten, twice shy” means a bad experience makes you careful. It sounds as if you’ll give up!' },
          { id: 'a-third-wheel', note: '“A third wheel” is an extra person who feels in the way, like on a date. It isn’t about tries.' },
        ],
      },
      { say: 'Paddle, paddle… now stand! Look at you, you’re surfing!' },
      {
        ask: 'Say you are extremely happy.',
        options: [
          { id: 'on-cloud-nine', right: true, line: 'I’m doing it! I’m on cloud nine!', note: '“On cloud nine” means extremely happy: exactly how your first wave feels.' },
          { id: 'have-your-head-in-the-clouds', note: '“Have your head in the clouds” means be dreamy and not practical. It isn’t about joy.' },
          { id: 'under-a-cloud', note: '“Under a cloud” means in disgrace or under suspicion. Not after a ride like that!' },
        ],
      },
      { say: 'Great surfing! Same time tomorrow?' },
    ],
  },
  {
    id: 'sydney-little-penguins',
    place: 'sydney',
    title: 'Penguins at sunset',
    scene: 'Sunset on a quiet beach. Pebble is waiting for some very special visitors.',
    with: 'penguin',
    level: 3,
    lines: [
      { say: 'Shh! At sunset, my little cousins swim home to their nests. We must be very quiet.' },
      {
        ask: 'Promise to make no noise at all.',
        options: [
          { id: 'as-quiet-as-a-mouse', right: true, line: 'Don’t worry, I’ll be as quiet as a mouse.', note: '“As quiet as a mouse” means making almost no noise: a lovely promise here.' },
          { id: 'as-busy-as-a-bee', note: '“As busy as a bee” means always hard at work. It says nothing about being quiet.' },
          { id: 'as-blind-as-a-bat', note: '“As blind as a bat” means you can’t see well. You’ll want to see the penguins!' },
        ],
      },
      { say: 'Look, here comes the first one, waddling out of the waves!' },
      {
        ask: 'React to how sweet it looks.',
        options: [
          { id: 'bless', right: true, line: 'Aww, bless! Look at its tiny flippers.', note: '“Bless” is a warm British reaction to something sweet, like a child, a pet or a tiny penguin.' },
          { id: 'how-rude', note: '“How rude” reacts to bad manners. The penguin is only going home!' },
          { id: 'what-a-pain', note: '“What a pain” means how annoying. There’s nothing annoying about this little penguin!' },
        ],
      },
      { say: 'She’s bringing dinner home for her chicks. Oh! Did you hear that screech?' },
      {
        ask: 'Say the noise gave you a big fright.',
        options: [
          { id: 'jump-out-of-your-skin', right: true, line: 'I did! I nearly jumped out of my skin!', note: '“Jump out of your skin” means get a sudden, big fright: just right for a surprise screech.' },
          { id: 'get-under-your-skin', note: '“Get under your skin” means annoy you and stay with you. It isn’t a sudden fright.' },
          { id: 'have-a-thick-skin', note: '“Have a thick skin” means you aren’t hurt by unkind words. It isn’t about being scared.' },
        ],
      },
      { say: 'Ha! It’s only a possum in the tree. Noisy, but harmless. Goodnight, little cousins!' },
    ],
  },
];
