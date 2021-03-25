import { calculateLevel, calculateMaxHP, calculatePercentageToNextLevel, normalizePokemonName } from "./utils/calculate.js";
import { TYPE_COLORS, TYPE_ICONS } from "./utils/types.js";

export function displayHiddenCardAlert(message) {
  if (!game.settings.get('streamMode', 'displayCards')) {
    ui.notifications.info(message);
  }
}

export async function displayPokemonStatusCard(id) {
  const referenceResponse = await fetch(`https://pokemon.maybreak.com/api/v1/pokemon/${id}`);

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
  const level = calculateLevel(response.pokemon.experience);
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
}

export async function displayPokemonCard(id) {
  const referenceResponse = await fetch(`https://pokemon.maybreak.com/api/v1/pokemon/${id}`);
  
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
  const level = calculateLevel(response.pokemon.experience);

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
}

export async function displayReferenceCard(type, messageText, formatData = x => x, template = '/modules/stream-mode/templates/reference.html') {
  const referenceResponse = await fetch(`https://pokemon.maybreak.com/api/v1/reference/${type}?query=${messageText}`);
  
  const response = await referenceResponse.json();
  
  if (response.length === 0) {
    ui.notifications.warn(`No results match the query ${messageText}`);

    return;
  }

  const exactMatch = response.find(x => x.name === messageText);

  if (response.length > 1 && !exactMatch) {
    ui.notifications.warn(`More than one result matches the query ${messageText}`);

    return;
  }

  const referenceData = exactMatch ?? response[0];

  displayHiddenCardAlert(`Displaying reference card for ${referenceData.name} (type: ${type})`);

  const content = await renderTemplate(template, {
    ...formatData(referenceData),
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
