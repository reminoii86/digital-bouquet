// Everything personal lives in this file. Edit freely; nothing else needs touching.

export const CONFIG = {
  fromName: 'Pipip',
  toName: 'Kyla', // appears only on the little tag hanging from the ribbon
  pageTitle: 'a gift for you ♡',

  landing: {
    title: 'You have received a gift from {name}.',
    question: 'Would you like to accept the gift?',
    afterBurn: "that wasn't really an option ^^",
    yes: 'Yes',
    no: 'No',
  },

  ui: {
    giftHint: 'tap to help it open',
    plantHint: 'tap to add a flower',
    chip: 'a letter for you',
    chipMeta: 'tap to open',
    reply: 'send a heart back',
    save: 'save my bouquet',
    again: 'watch it again',
  },

  letter: {
    message:
      "Hii my loveee, I would love to apologize deeply for having you need to ask a lot for a simple as a bouquet of flowers, I know this physically isn't one, but I hope that you would love and be happy with this little project I have made specially for you! ^^ ♡",
    signature: 'Pipip ♡',
  },

  // The "send a heart back" button.
  //   app: 'whatsapp' | 'imessage' | 'instagram'
  //   to:  WhatsApp needs the country code and digits only (0823... becomes 62823...)
  reply: { app: 'whatsapp', to: '6282316165567', text: 'I got my flowers ♡' },

  // The ASCII flowers are written with this phrase.
  glyphPhrase: 'iloveyou',

  // Starts when the first flower grows. A missing file means sound effects only.
  music: { src: 'assets/music.mp3', volume: 0.7 },

  saveCaption: 'a bouquet from Pipip ♡',
};
