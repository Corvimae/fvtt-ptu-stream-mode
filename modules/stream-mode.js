import { calculateLevel, calculateMaxHP, calculatePercentageToNextLevel, normalizePokemonName } from "./utils/calculate.js";
import { TYPE_COLORS, TYPE_ICONS } from "./utils/types.js";

function displayHiddenCardAlert(message) {
  if (!game.settings.get('streamMode', 'displayCards')) {
    ui.notifications.info(message);
  }
}

function parseChatArguments(messageText) {
  const match = [...messageText.matchAll(new RegExp('([^=& ?]+)=([^=& ?]+)', 'g'))];

  return match.reduce((acc, [_item, key, value]) => ({ ...acc, [key]: value }), {});
}

async function displayReferenceCard(type, messageText, formatData = x => x, template = '/modules/stream-mode/templates/reference.html') {
  const referenceResponse = await fetch(`https://pokemon.maybreak.com/api/v1/reference/${type}?query=${messageText}`);
  
  const response = await referenceResponse.json();
  
  if (response.length === 0) {
    ui.notifications.warn(`No results match the query ${messageText}`);

    return;
  }

  if (response.length > 1) {
    ui.notifications.warn(`More than one result matches the query ${messageText}`);

    return;
  }

  displayHiddenCardAlert(`Displaying reference card for ${response[0].name} (type: ${type})`);

  const content = await renderTemplate(template, {
    ...formatData(response[0]),
  });

  await ChatMessage.create({
    content,
    flags: {
      'streamMode.classNames': ['stream-card', 'reference-card', 'hide-header', 'contains-header', 'no-background'],
    },
    speaker: ChatMessage.getSpeaker(),
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
  });
}

Hooks.once('init', async () => {
 console.info('[Stream Mode] Stream mode enabled.');

  await loadTemplates([
    'modules/stream-mode/templates/bio.html',
    'modules/stream-mode/templates/reference.html',
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
      const referenceResponse = await fetch(`https://pokemon.maybreak.com/api/v1/pokemon/${messageText}`);
  
      const response = await referenceResponse.json();
      
      if (response.error) {
        ui.notifications.warn(response.error);
    
        return;
      }

      displayHiddenCardAlert(`Displaying reference card for Pokemon: ${response.pokemon.name} (ID: ${response.pokemon.id})`);

      let genderIcon = 'fa-minus';
      let genderIconColor = '#999';

      if (response.pokemon.gender === 'male') {
        genderIcon = 'fa-mars'
        genderIconColor = '#00f';
      }

      if (response.pokemon.gender === 'female') {
        genderIcon = 'fa-venus'
        genderIconColor = '#f00';
      }
    
      const currentHealth = response.pokemon.currentHealth;
      const totalHealth = calculateMaxHP(response.pokemon);
      const level = calculateLevel(response.pokemon);

      const content = await renderTemplate('/modules/stream-mode/templates/pokemon.html', {
        ...response.pokemon,
        genderIcon,
        genderIconColor,
        currentHealth,
        totalHealth,
        level,
        healthPercentage: currentHealth * 100 / totalHealth,
        icon: `modules/pokemon-manager-data/assets/sprites/${normalizePokemonName(response.pokemon.species.name, response.pokemon.species.dexNumber)}.png`,
      });
    
      await ChatMessage.create({
        content,
        flags: {
          'streamMode.classNames': ['stream-card', 'pokemon-card', 'hide-header', 'no-background'],
        },
        speaker: ChatMessage.getSpeaker(),
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      });
    },
    shouldDisplayToChat: false,
    description: 'Display a Pokemon reference card.',
  }));

  chatCommands.registerCommand(chatCommands.createCommandFromData({
    commandKey: '/status',
    invokeOnCommand: async (_chatLog, messageText, _chatdata) => {
      const referenceResponse = await fetch(`https://pokemon.maybreak.com/api/v1/pokemon/${messageText}`);
  
      const response = await referenceResponse.json();
      
      if (response.error) {
        ui.notifications.warn(response.error);
    
        return;
      }

      displayHiddenCardAlert(`Displaying combat status card for Pokemon: ${response.pokemon.name} (ID: ${response.pokemon.id})`);

      let genderIcon = 'fa-minus';
      let genderIconColor = '#999';

      if (response.pokemon.gender === 'male') {
        genderIcon = 'fa-mars'
        genderIconColor = '#00f';
      }

      if (response.pokemon.gender === 'female') {
        genderIcon = 'fa-venus'
        genderIconColor = '#f00';
      }
    
      const currentHealth = response.pokemon.currentHealth;
      const totalHealth = calculateMaxHP(response.pokemon);
      const level = calculateLevel(response.pokemon);
      const experienceToNextLevel = calculatePercentageToNextLevel(response.pokemon.experience);

      const combatStageData = [
        ['attack', 'Attack'],
        ['defense', 'Defense'],
        ['spAttack', 'Sp. Attack'],
        ['spDefense', 'Sp. Defense'],
        ['speed', 'Speed'],
      ].reduce((acc, [stat, label]) => {
        const stages = response.pokemon[`${stat}CombatStages`];

        return [
          ...acc,
          {
            stat,
            label,
            isNegative: stages < 0,
            isPositive: stages > 0,
            stages: [...Array(Math.abs(stages))].map(x => 0),
            remainingPips: [...Array(6 - Math.abs(stages))].map(x => 0),
          } 
        ]
      }, []);

      console.log(combatStageData);

      const content = await renderTemplate('/modules/stream-mode/templates/status.html', {
        ...response.pokemon,
        genderIcon,
        genderIconColor,
        currentHealth,
        totalHealth,
        type1Name: response.pokemon.type1[0].toUpperCase() + response.pokemon.type1.slice(1),
        type2Name: response.pokemon.type2[0].toUpperCase() + response.pokemon.type2.slice(1),
        type1Color: TYPE_COLORS[response.pokemon.type1.toLowerCase()],
        type2Color: TYPE_COLORS[response.pokemon.type2.toLowerCase()],
        type1Icon: TYPE_ICONS[response.pokemon.type1.toLowerCase()],
        type2Icon: TYPE_ICONS[response.pokemon.type2.toLowerCase()],
        hasType2: response.pokemon.type2 !== 'none',
        level,
        abilityNames: response.pokemon.abilities.map(ability => ability.name).join(', ') || 'None',
        heldItemNames: response.pokemon.heldItems.map(heldItem => heldItem.name).join(', ') || 'None',
        experienceToNextLevel,
        healthPercentage: currentHealth * 100 / totalHealth,
        combatStageData,
        icon: `modules/pokemon-manager-data/assets/sprites/${normalizePokemonName(response.pokemon.species.name, response.pokemon.species.dexNumber)}.png`,
        moves: response.pokemon.moves.map(move => {
          return {
            ...move,
            typeColor: TYPE_COLORS[move.type.toLowerCase()],
            typeIcon: TYPE_ICONS[move.type.toLowerCase()],
          };
        })
      });
    
      await ChatMessage.create({
        content,
        flags: {
          'streamMode.classNames': ['stream-card', 'status-card', 'hide-header', 'no-background'],
        },
        speaker: ChatMessage.getSpeaker(),
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      });
    },
    shouldDisplayToChat: false,
    description: 'Display a Pokemon status card.',
  }));
});