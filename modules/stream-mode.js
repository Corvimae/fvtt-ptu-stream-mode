import { displayHiddenCardAlert, displayPokemonCard, displayPokemonStatusCard, displayReferenceCard } from './cards.js';


function parseChatArguments(messageText) {
  const match = [...messageText.matchAll(new RegExp('([^=& ?]+)=([^=& ?]+)', 'g'))];

  return match.reduce((acc, [_item, key, value]) => ({ ...acc, [key]: value }), {});
}


Hooks.once('init', async () => {
 console.info('[Stream Mode] Stream mode enabled.');

  await loadTemplates([
    'modules/stream-mode/templates/bio.html',
    'modules/stream-mode/templates/reference.html',
    'modules/stream-mode/templates/macroCard.html',
    'modules/stream-mode/templates/pokemon.html',
    'modules/stream-mode/templates/status.html',
  ]);

  Handlebars.registerHelper('capitalize', str => {
    if (typeof str !== 'string') return '';

    return str[0].toUpperCase() + str.slice(1);
  });
 
 game.settings.register('streamMode', 'enabled', {
    name: 'Enable Stream Mode',
    hint: 'Display contents for the stream dedicated observer.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
    onChange(enabled) {
      if (enabled) {
        document.body.classList.add('stream-mode');
      } else {
        document.body.classList.remove('stream-mode');
      }
    },
  });
 
 game.settings.register('streamMode', 'displayCards', {
    name: 'Display Stream Mode Cards',
    hint: 'Display Stream Mode cards even when not the stream dedicated observer.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
    onChange(enabled) {
      if (enabled) {
        document.body.classList.add('show-stream-mode-cards');
      } else {
        document.body.classList.remove('show-stream-mode-cards');
      }
    },
  });
 
 game.settings.register('streamMode', 'hideMacros', {
    name: 'Hide Macros in Stream Mode',
    hint: 'Hide the Macro bar when in Stream Mode.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
    onChange(enabled) {
      if (enabled) {
        document.body.classList.add('hide-macros');
      } else {
        document.body.classList.remove('hide-macros');
      }
    },
  });

  game.streamMode = {
    async showCard(header, data, description) {
      displayHiddenCardAlert(`Displaying card (${header})`);

      const content = await renderTemplate('/modules/stream-mode/templates/macroCard.html', {
        header,
        data,
        description,
        type: data?.type ?? '',
      });
    
      await ChatMessage.create({
        content,
        flags: {
          'streamMode.classNames': ['stream-card', 'macro-card', 'hide-header', 'contains-header', 'no-background'],
        },
        speaker: ChatMessage.getSpeaker(),
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      });
    }
  };

  const getActorEntryContextOptionsOriginal = ActorDirectory.prototype._getEntryContextOptions;
  ActorDirectory.prototype._getEntryContextOptions = function () {
    const cxtOptions = getActorEntryContextOptionsOriginal.call(this);

    return [
      ...cxtOptions,
      {
        name: 'stream-mode.ACTOR.ShowPokemonCard',
        icon: '<i class="fa fa-id-card"></i>',
        condition(li) {
          const actor = game.actors.get(li.data('entityId'));

          return actor.data.type === 'pokemon';
        },
        callback(li) {
          const actor = game.actors.get(li.data('entityId'));

          if (!actor.data.data.sheetID) {
            ui.notifications.warn('Pokemon does not have an attached sheet.');
    
            return;
          }
          
          displayPokemonCard(actor.data.data.sheetID);
        }
      },
      {
        name: 'stream-mode.ACTOR.ShowPokemonStatusCard',
        icon: '<i class="fa fa-clipboard-list"></i>',
        condition(li) {
          const actor = game.actors.get(li.data('entityId'));

          return actor.data.type === 'pokemon';
        },
        callback(li) {
          const actor = game.actors.get(li.data('entityId'));

          if (!actor.data.data.sheetID) {
            ui.notifications.warn('Pokemon does not have an attached sheet.');
    
            return;
          }
          
          displayPokemonStatusCard(actor.data.data.sheetID);
        }
      }
    ]
  }
});

Hooks.once('ready', function() {
  if (game.settings.get('streamMode', 'enabled')) {
    document.body.classList.add('stream-mode');
  } else {
    document.body.classList.remove('stream-mode');
  }

  if (game.settings.get('streamMode', 'hideMacros')) {
    document.body.classList.add('hide-macros');
  } else {
    document.body.classList.remove('hide-macros');
  }
  
  if (game.settings.get('streamMode', 'displayCards')) {
    document.body.classList.add('show-stream-mode-cards');
  } else {
    document.body.classList.remove('show-stream-mode-cards');
  }
});


Hooks.on('renderChatMessage', (_app, html, options) => {
  if(options.message.flags.streamMode?.classNames) {
    html[0].closest('.message').classList.add(...options.message.flags.streamMode?.classNames);
  }

  if(options.message.flags.ptu?.messageType === 'move') {
    html[0].closest('.message').classList.add('ptu-move-message');
    html[0].querySelector('.pokemon-move-name').classList.add('typed-header', options.message.flags.ptu.moveOptions?.type);
  }    
});

Hooks.on('chatCommandsReady', chatCommands => {
  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/bio',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => {
      const templateData = parseChatArguments(messageText);

      if (!templateData.name) {
        ui.notifications.warn('name parameter is required for /bio');

        return;
      }

      const content = await renderTemplate('/modules/stream-mode/templates/bio.html', {
        ...templateData,
        showTwitter: templateData.twitter?.length > 0 ?? false,
        showTwitch: templateData.twitch?.length > 0 ?? false,
      });

      displayHiddenCardAlert(`Displaying biography card for ${templateData.name}`);

      await ChatMessage.create({
        content,
        flags: {
          'streamMode.classNames': ['stream-card', 'bio-card', 'hide-header', 'contains-header', 'no-background', 'full-width-content'],
        },
        speaker: ChatMessage.getSpeaker(),
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      });
    },
    shouldDisplayToChat: false,
    description: 'Display a biography card.',
  }));
  
  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/helditem',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => displayReferenceCard('heldItems', messageText),
    shouldDisplayToChat: false,
    description: 'Display a held item reference card.',
  }));
  
  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/ability',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => displayReferenceCard('abilities', messageText),
    shouldDisplayToChat: false,
    description: 'Display an ability reference card.',
  }));
  
  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/capability',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => displayReferenceCard('capabilities', messageText, data => {
      if (data.name === 'Power') {
        return {
          ...data,
          effect: 'Power represents a Pokemon\'s physical strength. It determines how much weight a Pokemon can bear.',
        };
      }

      return data;
    }),
    shouldDisplayToChat: false,
    description: 'Display a capability reference card.',
  }));

  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/skill',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => displayReferenceCard('skills', messageText),
    shouldDisplayToChat: false,
    description: 'Display a skill reference card.',
  }));

  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/edge',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => displayReferenceCard('edges', messageText),
    shouldDisplayToChat: false,
    description: 'Display a edge reference card.',
  }));

  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/move',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => displayReferenceCard('moves', messageText),
    shouldDisplayToChat: false,
    description: 'Display a edge reference card.',
  }));

  
  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/pokemon',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => {
      await displayPokemonCard(messageText);
    },
    shouldDisplayToChat: false,
    description: 'Display a Pokemon reference card.',
  }));

  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/status',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => {
      await displayPokemonStatusCard(messageText);
    },
    shouldDisplayToChat: false,
    description: 'Display a Pokemon status card.',
  }));
});