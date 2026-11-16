/** Situations in New York. Schema and style: dev/SITUATIONS_GUIDE.md */
export default [
  {
    id: 'newyork-bagel-shop',
    place: 'newyork',
    title: 'Breakfast at the bagel shop',
    scene: 'Early morning at a busy bagel shop. Rory is behind the counter.',
    with: 'lion',
    level: 1,
    lines: [
      { say: 'Morning! How’s it going?' },
      {
        ask: 'Answer the friendly greeting.',
        options: [
          { id: 'not-too-bad', right: true, line: 'Not too bad, thanks! How about you?', note: '“Not too bad” is a modest, very British way to say you’re fine.' },
          { id: 'long-time-no-see', note: '“Long time no see” greets a friend you haven’t seen for ages. You’ve only just met Rory!' },
          { id: 'good-night', note: '“Good night” is a goodbye late in the evening or at bedtime. It’s breakfast time!' },
        ],
      },
      { say: 'Great, thanks! So, what can I get you?' },
      {
        ask: 'Say you are very hungry.',
        options: [
          { id: 'im-starving', right: true, line: 'I’m starving! A sesame bagel with cream cheese, please.', note: '“I’m starving” means you are extremely hungry: just right before breakfast.' },
          { id: 'im-stuffed', note: '“I’m stuffed” means you are too full to eat any more: the opposite!' },
          { id: 'im-parched', note: '“I’m parched” means you are very thirsty, not hungry.' },
        ],
      },
      { say: 'One sesame bagel, coming right up! That’s four dollars fifty.' },
      {
        ask: 'Pay with five dollars and give Rory the extra as a tip.',
        options: [
          { id: 'keep-the-change', right: true, line: 'Here’s five dollars. Keep the change!', note: '“Keep the change” lets someone keep the extra money as a small tip: kind and natural.' },
          { id: 'have-you-got-any-change', note: '“Have you got any change?” asks someone for coins. You want Rory to keep the money!' },
          { id: 'its-a-rip-off', note: '“It’s a rip-off” complains that something costs far too much. That would sound rude here.' },
        ],
      },
      { say: 'Thanks, that’s kind of you! Enjoy your bagel, and enjoy New York!' },
    ],
  },
  {
    id: 'newyork-subway-seat',
    place: 'newyork',
    title: 'A seat on the subway',
    scene: 'A busy subway train. There’s one empty seat next to Duke.',
    with: 'boxer',
    level: 1,
    lines: [
      { say: 'Hey there! Busy train today, huh?' },
      {
        ask: 'Ask politely if you can sit in the empty seat.',
        options: [
          { id: 'is-this-seat-taken', right: true, line: 'It really is! Excuse me, is this seat taken?', note: '“Is this seat taken?” is the polite way to ask if you can sit in an empty seat.' },
          { id: 'take-a-seat', note: '“Take a seat” invites someone else to sit down. That’s what Duke might say to you!' },
          { id: 'whos-next', note: '“Who’s next?” asks whose turn it is in a queue, not whether a seat is free.' },
        ],
      },
      { say: 'Nope, it’s all yours. Where are you heading?' },
      { you: 'To the big museum by the park. It’s my first time in New York!' },
      {
        ask: 'Ask about the journey time.',
        options: [
          { id: 'how-long-does-it-take', right: true, line: 'How long does it take to get there?', note: '“How long does it take?” asks how much time a journey needs: just what you want to know.' },
          { id: 'whats-the-time', note: '“What’s the time?” asks the hour of the day, not the length of the journey.' },
          { id: 'how-much-is-that', note: '“How much is that?” asks the price of something, not the time it takes.' },
        ],
      },
      { say: 'About twenty minutes. Don’t worry, I’ll tell you when to get off.' },
      {
        ask: 'Thank him.',
        options: [
          { id: 'cheers', right: true, line: 'Cheers! That’s really kind of you.', note: '“Cheers” is an everyday British way to say thanks for a small favour.' },
          { id: 'youre-welcome', note: '“You’re welcome” is the reply when someone thanks you. Here, you’re the one saying thanks.' },
          { id: 'cheerio', note: '“Cheerio” means goodbye, but you and Duke are still on the train together.' },
        ],
      },
      { say: 'No problem! You’re going to love that museum.' },
    ],
  },
  {
    id: 'newyork-dinosaur-bones',
    place: 'newyork',
    title: 'Bones at the museum',
    scene: 'Dr Ada Sparks shows you a giant dinosaur skeleton at the museum.',
    with: 'scientist',
    level: 2,
    lines: [
      { say: 'Meet my favourite dinosaur! Can you guess how old these bones are?' },
      {
        ask: 'Say you have no idea at all.',
        options: [
          { id: 'not-have-the-foggiest', right: true, line: 'I haven’t the foggiest! A thousand years?', note: '“I haven’t the foggiest” means you have no idea at all: perfect before a wild guess.' },
          { id: 'i-don-t-get-it', note: '“I don’t get it” means you don’t understand. You understood the question; you just don’t know.' },
          { id: 'i-couldnt-care-less', note: '“I couldn’t care less” means you don’t care at all. That would sound very rude to Ada!' },
        ],
      },
      { say: 'Much older! About sixty-six million years. It lived long before people did.' },
      {
        ask: 'Show that you are amazed.',
        options: [
          { id: 'goodness-me', right: true, line: 'Goodness me! That’s older than I can even imagine.', note: '“Goodness me” is a gentle cry of surprise: just right for an amazing fact.' },
          { id: 'oh-well', note: '“Oh well” calmly accepts a small disappointment. It doesn’t show amazement.' },
          { id: 'oh-dear', note: '“Oh dear” is a gentle reaction to something unfortunate, not to an amazing fact.' },
        ],
      },
      { say: 'Would you like to hear how we found it? It’s quite a story!' },
      {
        ask: 'Say you are keen to hear it.',
        options: [
          { id: 'i-m-all-ears', right: true, line: 'Yes, please! I’m all ears.', note: '“I’m all ears” means you are ready and keen to listen: a warm way to ask for the story.' },
          { id: 'in-one-ear-and-out-the-other', note: '“In one ear and out the other” means heard, then forgotten at once. Not kind to a storyteller!' },
          { id: 'play-it-by-ear', note: '“Play it by ear” means decide what to do as things happen. It isn’t about listening.' },
        ],
      },
      { say: 'Wonderful! It all began when a little girl found one tiny bone on a walk…' },
    ],
  },
  {
    id: 'newyork-ice-rink',
    place: 'newyork',
    title: 'Skating in the park',
    scene: 'An ice rink in the big park. Zib glides over to say hello.',
    with: 'alien',
    level: 2,
    lines: [
      { say: 'Hello, friend! Come and skate with me. Have you ever tried it?' },
      {
        ask: 'Say you’ll try, even though you might fall.',
        options: [
          { id: 'have-a-go', right: true, line: 'Never! But I’ll have a go.', note: '“Have a go” means try something, even if you might fail: a brave yes.' },
          { id: 'break-the-ice', note: '“Break the ice” means help people relax when they first meet. It has nothing to do with real ice!' },
          { id: 'chicken-out', note: '“Chicken out” means decide not to do something because you’re scared: the opposite!' },
        ],
      },
      { say: 'Great! Hold my hand and push with one foot. Look, you’re moving!' },
      {
        ask: 'Say you are slowly learning how to do it.',
        options: [
          { id: 'get-the-hang-of', right: true, line: 'Whoa! I think I’m getting the hang of it.', note: '“Get the hang of it” means learn how to do something with practice. Well done!' },
          { id: 'hang-in-there', note: '“Hang in there” encourages someone through a hard time. You say it to others, not about learning.' },
          { id: 'get-out-of-hand', note: '“Get out of hand” means become impossible to control. Let’s hope not!' },
        ],
      },
      { say: 'You’re a natural! Want to stop for a hot chocolate?' },
      {
        ask: 'Accept the offer politely.',
        options: [
          { id: 'i-wouldn-t-mind', right: true, line: 'Ooh, I wouldn’t mind! My legs feel like jelly.', note: '“I wouldn’t mind” is a polite British way to say you would like something.' },
          { id: 'never-mind', note: '“Never mind” means something isn’t important, so forget it. It isn’t a yes.' },
          { id: 'mind-your-head', note: '“Mind your head” warns someone about a low ceiling. There’s nothing to bump into out here!' },
        ],
      },
      { say: 'Two hot chocolates with marshmallows, coming up! You’ve earned them.' },
    ],
  },
  {
    id: 'newyork-rooftop-sunset',
    place: 'newyork',
    title: 'Sunset on the rooftop',
    scene: 'A rooftop garden high above the city. Lexi Lightning waves hello.',
    with: 'superhero',
    level: 3,
    lines: [
      { say: 'Welcome to my rooftop! This is where I keep watch over the whole city.' },
      {
        ask: 'Say you can see everything from up here.',
        options: [
          { id: 'a-birds-eye-view', right: true, line: 'Wow! You really get a bird’s-eye view from up here.', note: '“A bird’s-eye view” is a view of everything from high above: perfect on a rooftop.' },
          { id: 'a-fly-on-the-wall', note: '“A fly on the wall” is someone who watches without being seen. It isn’t a view from up high.' },
          { id: 'in-the-public-eye', note: '“In the public eye” means famous and often in the news. It has nothing to do with the view.' },
        ],
      },
      { say: 'Where’s your hotel? I can fly you back there later!' },
      {
        ask: 'Accept, and say how far it is in a straight line.',
        options: [
          { id: 'as-the-crow-flies', right: true, line: 'Yes, please! It’s about two miles away, as the crow flies.', note: '“As the crow flies” means in a straight line: just right when your friend can fly!' },
          { id: 'fly-the-nest', note: '“Fly the nest” means leave your parents’ home for good. It isn’t about distance.' },
          { id: 'off-the-beaten-track', note: '“Off the beaten track” means far from the busy tourist areas. It doesn’t say how far.' },
        ],
      },
      { say: 'Two miles? That’s two seconds for me! Oh, my watch is flashing. Someone needs help!' },
      {
        ask: 'Tell her politely that she should go.',
        options: [
          { id: 'i-wont-keep-you', right: true, line: 'Of course, off you go! I won’t keep you.', note: '“I won’t keep you” politely ends a chat so the other person can go. Kind when duty calls!' },
          { id: 'hang-on-a-sec', note: '“Hang on a sec” asks someone to wait. Lexi needs to go right now!' },
          { id: 'keep-your-hair-on', note: '“Keep your hair on” tells someone to calm down and not get angry. Lexi isn’t angry, just busy.' },
        ],
      },
      { say: 'Thanks! Enjoy the sunset. I’ll be back in a flash!' },
    ],
  },
  {
    id: 'newyork-taxi-dash',
    place: 'newyork',
    title: 'A race to the theatre',
    scene: 'Rush hour. You jump into a taxi, and Bolt is driving.',
    with: 'robot',
    level: 3,
    lines: [
      { say: 'Beep! Hello! Where can I take you this evening?' },
      { you: 'To the theatre on Broadway, please. My show starts in fifteen minutes!' },
      { say: 'Calculating… Oh dear, the traffic is rather heavy. It might take twenty.' },
      {
        ask: 'Say you are very short of time.',
        options: [
          { id: 'against-the-clock', right: true, line: 'Oh no! We’re really racing against the clock.', note: '“Against the clock” means with very little time to do something: exactly your problem!' },
          { id: 'around-the-clock', note: '“Around the clock” means all day and all night without stopping. It isn’t about hurrying.' },
          { id: 'turn-back-the-clock', note: '“Turn back the clock” means go back to how things were in the past. Even Bolt can’t do that!' },
        ],
      },
      { say: 'Don’t worry, I know a shortcut. Hold on tight… and here we are! Fourteen minutes.' },
      {
        ask: 'Say you only just made it in time.',
        options: [
          { id: 'by-the-skin-of-your-teeth', right: true, line: 'Phew! We made it by the skin of our teeth.', note: '“By the skin of your teeth” means only just, by a tiny margin: one minute to spare!' },
          { id: 'on-the-cards', note: '“On the cards” means likely to happen soon. It doesn’t describe a close finish.' },
          { id: 'at-the-drop-of-a-hat', note: '“At the drop of a hat” means immediately, without thinking twice. It isn’t about nearly being late.' },
        ],
      },
      { say: 'Beep! A new record. Hurry, the doors are closing!' },
      {
        ask: 'Thank Bolt warmly for the help.',
        options: [
          { id: 'you-re-a-legend', right: true, line: 'Thank you so much. You’re a legend!', note: '“You’re a legend” is warm, friendly praise for someone who has really helped you.' },
          { id: 'youre-having-a-laugh', note: '“You’re having a laugh” means you can’t believe someone is serious. It isn’t a thank-you.' },
          { id: 'you-re-not-wrong', note: '“You’re not wrong” means you agree with what someone just said. It isn’t a thank-you either.' },
        ],
      },
      { say: 'Beep beep! You’re welcome. Enjoy the show!' },
    ],
  },
];
