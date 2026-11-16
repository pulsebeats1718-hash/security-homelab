# Writing Situations

Situations are short comic-strip conversations. The player's character chats with another
character in one of the island's places, and at two or three moments picks the most natural
thing to say from three expressions in the game. They teach *when* to use an expression,
which is what sounding natural really means.

Files: `src/data/situations/<place>.js`, one per place (`home`, `london`, `newyork`,
`sydney`), each a default-exported array. Check them with:

```bash
node scripts/check-situations.mjs                   # validate every situation
node scripts/check-situations.mjs --find "the ice"  # find expression ids to use
```

## Schema

```js
{
  id: 'london-bakery',           // unique, kebab-case, starts with the place id
  place: 'london',               // home | london | newyork | sydney (the file's place)
  title: 'The bakery queue',     // ≤ 32 characters, Sentence case
  scene: 'A busy Saturday morning at a little bakery.', // ≤ 80 characters
  with: 'chef',                  // the other speaker: a character id (list below)
  level: 1,                      // 1 easy · 2 medium · 3 harder
  lines: [
    { say: 'Morning! What can I get you?' },          // the other character speaks (≤ 90)
    {
      ask: 'Order a milky coffee.',                    // what the player wants to say (≤ 70)
      options: [                                       // exactly three, exactly one right
        { id: 'a-flat-white-please', right: true,
          line: 'A flat white, please.',               // what the player says (≤ 110), uses the expression
          note: 'Spot on: the usual polite way to order a milky coffee.' },  // ≤ 120
        { id: 'i-owe-you-one', note: '“I owe you one” thanks someone for a favour; it is not an order.' },
        { id: 'cheerio', note: '“Cheerio” means goodbye, so it would end the chat before it starts.' },
      ],
    },
    { say: 'Coming right up. Anything else?' },
    { you: 'That’s all, thanks.' },                    // optional fixed player line (≤ 90)
    // …
  ],
}
```

- **5–10 lines**, of which **2 or 3 are choices**. Start with `say`. End with a `say` that
  wraps the scene up warmly.
- **Options are expressions from the game, by id.** The buttons show each expression's
  text; the right one then appears in the player's bubble as `line`, a natural sentence that
  contains the expression (inflected if needed: "We **picked up** a bit of French").
- **One option clearly fits; the other two clearly don't**: a different meaning, the wrong
  situation, or the wrong register. Never a near-synonym that would also be fine here.
  Wrong options must still be real, well-known expressions, so the player learns from them too.
- **The buttons show each expression's full text, sense hint included** ("put on (sun cream)").
  So no two options may show the same words (two "put on"s told apart only by their hints), and
  the right option's hint must not repeat the prompt and give the answer away. The validator
  checks both.
- **Notes**: for the right option, why it fits (≤ 120); for each wrong one, what it actually
  means and why it doesn't fit here. Put expressions in curly quotes: “break the ice”.
- Prefer level 1–2 expressions in level 1 situations; level 3 situations can use harder ones.
- Write the player's lines and options in **British English**. The other character may speak
  in their own style but keep it plain, friendly English a learner can follow.

## Tone and content

- Friendly, warm and suitable for all ages. Everyday life: shops, travel, food, weather,
  neighbours, school, hobbies, small problems solved kindly. Light humour is welcome.
- No brands, trademarks, real people or real businesses. Famous places by their common name
  are fine (the Thames, a ferry across the harbour), but no copies of trademarked things.
- No stereotypes. Characters are the game's toy characters; they can be themselves (the
  chef cooks, the diver dives) without jokes at anyone's expense.

## Places and who lives there

| Place | Feel | Good partners |
| --- | --- | --- |
| `home` | Home Island: a small, friendly island village, gardens, a little harbour, the village fête, a rainy afternoon | bear (Bramble), hedgehog (Conker), bunny (Clover), owl (Professor Hoot), duck (Puddle), cat (Biscuit), frog (Prince Pip) |
| `london` | London: a bakery, the Underground, a street market, a museum, a bus stop in the rain, a theatre interval, a picnic in the park | bobby (Constable Cobb), guard (Corporal Crumpet), crier (Bellamy), chef (Pippa), corgi (Rupert), cricketer (Archie), detective (Inspector Finch), bulldog (Barnaby) |
| `newyork` | New York: a deli counter, the subway, a rooftop, a taxi, a big park, a museum, a bagel shop. The player is a British visitor | superhero (Lexi Lightning), scientist (Dr Ada Sparks), robot (Bolt), astronaut (Captain Luna), boxer (Duke), lion (Rory), footballer (Rio), alien (Zib) |
| `sydney` | Sydney: the beach, a harbour ferry, a barbecue, a café, sun safety, wildlife, a surf lesson | diver (Ollie), mermaid (Marina), pirate (Captain Marlow), penguin (Pebble), panda (Bao), tiger (Raja), unicorn (Stardust), dragon (Ember) |

Every character: alien Zib, astronaut Captain Luna, bear Bramble, bobby Constable Cobb, boxer
Duke, bulldog Barnaby, bunny Clover, cat Biscuit, chef Pippa, corgi Rupert, cricketer Archie,
crier Bellamy, detective Inspector Finch, diver Ollie, dragon Ember, duck Puddle, footballer
Rio, fox Maple, frog Prince Pip, ghost Wisp, guard Corporal Crumpet, hedgehog Conker, jester
Jinks, knight Sir Clank, lion Rory, mermaid Marina, nessie Nessie, ninja Kage, owl Professor
Hoot, panda Bao, penguin Pebble, phoenix Cinder, pirate Captain Marlow, robot Bolt, scientist
Dr Ada Sparks, superhero Lexi Lightning, tiger Raja, unicorn Stardust, wizard Merriweather.
