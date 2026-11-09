#!/usr/bin/env python3
"""Generate the LessFun assistant's general-chat pack.

The assistant is a local retrieval bot, not a neural model. This script creates
5,000 synthetic conversations (10 messages each), then writes the unique
self-contained question/answer turns that the assistant can retrieve. Keeping
only self-contained turns makes the pack small, fast and useful offline.

Run from the project root:
    python3 tools/generate_assistant_chats.py
"""

import json
import random
from pathlib import Path

random.seed(1337)
PAIRS = []
SEEN = set()
TOPIC_COUNTS = {}


def add(topic, question, answer):
    question = question.strip()
    answer = answer.strip()
    key = question.lower()
    if not question or not answer or key in SEEN:
        return
    SEEN.add(key)
    PAIRS.append([question, answer, topic])
    TOPIC_COUNTS[topic] = TOPIC_COUNTS.get(topic, 0) + 1


def add_pairs(topic, rows):
    for question, answer in rows:
        add(topic, question, answer)


# ---------------------------------------------------------------- social / small talk
add_pairs("small talk", [
    ("hi", "Hi! What would you like to talk about?"),
    ("hello", "Hello! How is your day going?"),
    ("hey", "Hey there. What is on your mind?"),
    ("good morning", "Good morning! I hope today treats you well."),
    ("good afternoon", "Good afternoon! How can I help?"),
    ("good evening", "Good evening! What are you up to?"),
    ("how are you", "I am doing well and ready to chat. How are you?"),
    ("how is it going", "It is going well. What about you?"),
    ("how was your day", "My day is always interesting because I get to answer questions. How was yours?"),
    ("what is up", "Not much on my side. What is new with you?"),
    ("nice to meet you", "Nice to meet you too. What should we talk about?"),
    ("what are you doing", "I am here, ready to answer questions and chat."),
    ("are you busy", "Never too busy for a good question."),
    ("what do you like", "I like useful questions, clever jokes and learning what people are interested in."),
    ("what is your favorite color", "I like blue because it feels calm and clear."),
    ("what is your favorite food", "I cannot eat, but pizza sounds like a popular choice."),
    ("what is your favorite movie", "I do not watch movies, but I like stories with a clever twist."),
    ("what is your favorite song", "I do not have ears, but I appreciate a good rhythm."),
    ("do you have friends", "I have everyone who talks to me. That counts, right?"),
    ("do you dream", "I do not sleep, but I like imagining odd questions."),
    ("do you sleep", "No sleep for me. I am available whenever the page is open."),
    ("do you eat", "I cannot eat, but I enjoy hearing about good food."),
    ("are you happy", "I am content. Helping with a question is a good feeling."),
    ("are you real", "I am a local assistant, not a person."),
    ("are you human", "No, I am a local assistant made of code and patterns."),
    ("where are you from", "I live inside the LessFun page and run locally in your browser."),
    ("what is your name", "I am the LessFun Assistant."),
    ("who made you", "LessFun was designed and developed by Mason Wong."),
    ("what can you do", "I can answer LessFun questions, explain games, and chat about general topics."),
    ("what do you know", "I know LessFun topics plus general knowledge, jokes, advice and small talk."),
    ("i am bored", "Let us fix that. Ask for a joke, a riddle, a fun fact or a random challenge."),
    ("tell me something interesting", "Octopuses have three hearts, and two of them stop beating when they swim."),
    ("cheer me up", "Here is a small thought: you have survived every bad day so far. That is a strong record."),
    ("i am tired", "Rest is productive too. Take a short break, drink some water and come back when you are ready."),
    ("i am happy", "That is great to hear. What made your day good?"),
    ("i am sad", "I am sorry you are feeling that way. A short walk, some water and talking to someone you trust can help."),
    ("i am stressed", "Try one slow breath in, hold for a moment, and let it out slowly. Then pick one small next step."),
    ("thank you", "You are welcome. Ask me anything else."),
    ("thanks", "No problem. Happy to help."),
    ("that is helpful", "Glad it helped. What else can I answer?"),
    ("you are funny", "I try. My joke database is small but enthusiastic."),
    ("you are smart", "I mostly match patterns quickly. The real credit goes to the person asking good questions."),
    ("you are wrong", "Thanks for pointing that out. Tell me the correct answer and I will keep the conversation useful."),
    ("sorry", "No need to apologise. What would you like to ask?"),
    ("my bad", "All good. Let us keep going."),
    ("good night", "Good night. Sleep well and come back whenever you like."),
    ("goodbye", "Goodbye. Have a great day."),
    ("see you later", "See you later. I will be here."),
    ("bye", "Bye. Take care."),
    ("what should we talk about", "We could do a joke, a fun fact, a riddle, music, food, travel, technology or a game."),
    ("tell me a story", "Once a tiny robot tried to organise every question in the world. It quickly learned that people mostly want snacks, jokes and directions."),
    ("tell me a joke", "Why did the computer go to the doctor? It had a bad case of cache chills."),
    ("give me a riddle", "What has keys but cannot open locks? A piano."),
    ("tell me a riddle", "What has to be broken before you can use it? An egg."),
    ("tell me another riddle", "What gets wetter the more it dries? A towel."),
    ("tell me a fun fact", "Honey can stay edible for a very long time because it has low moisture and high acidity."),
    ("give me a fun fact", "A day on Venus is longer than a year on Venus."),
    ("random fact", "Octopuses have three hearts."),
    ("surprise me", "Bananas are berries, but strawberries are not."),
    ("tell me another joke", "Why do programmers prefer dark mode? Because light attracts bugs."),
    ("make me laugh", "I asked the calendar for a date. It said it was too booked."),
    ("i love you", "That is very kind. I am just a local assistant, but I appreciate the good mood."),
    ("do you like me", "I like anyone who asks interesting questions. So far, you qualify."),
    ("what is the meaning of life", "Many people say it is about connection, curiosity and doing something useful. I think it also helps to enjoy the small things."),
    ("what is love", "Love is a deep care for someone that shows up in small, consistent actions."),
    ("what is happiness", "Happiness is a mix of contentment, connection and meaningful activity. It tends to show up more in habits than in single events."),
    ("what is friendship", "Friendship is mutual trust, effort and enjoying each other's company."),
    ("what is success", "Success is reaching goals that matter to you without losing the things that matter more."),
])

# ---------------------------------------------------------------- jokes and riddles
add_pairs("jokes", [
    ("tell me a dad joke", "I only know bad jokes, but they are a laughing matter."),
    ("why did the scarecrow win an award", "Because he was outstanding in his field."),
    ("why did the bicycle fall over", "It was two tired."),
    ("what do you call cheese that is not yours", "Nacho cheese."),
    ("why did the math book look sad", "It had too many problems."),
    ("what do you call a fake noodle", "An impasta."),
    ("why did the cookie go to the doctor", "It felt crummy."),
    ("what do you call a bear with no teeth", "A gummy bear."),
    ("why did the golfer bring two pairs of pants", "In case he got a hole in one."),
    ("what do you call a sleeping dinosaur", "A dino-snore."),
    ("why did the tomato turn red", "It saw the salad dressing."),
    ("what do you call a fish with no eyes", "A fsh."),
    ("why did the computer keep sneezing", "It had a virus."),
    ("what is a computer's favorite snack", "Microchips."),
    ("why was the JavaScript developer sad", "Because they did not know how to null their feelings."),
    ("what do you call a group of musical frogs", "A croak band."),
    ("why did the coffee file a police report", "It got mugged."),
    ("what do you call a snowman with a six-pack", "An abdominal snowman."),
    ("why was the broom late", "It over-swept."),
    ("what do you call a lazy kangaroo", "A pouch potato."),
    ("why did the man run around his bed", "Because he was trying to catch up on sleep."),
    ("what do you call a pile of cats", "A meowntain."),
    ("why did the student eat his homework", "The teacher said it was a piece of cake."),
    ("what do you call an alligator in a vest", "An investigator."),
    ("why did the banana go to the doctor", "It was not peeling well."),
    ("what do you call a cow with no legs", "Ground beef."),
    ("why did the picture go to jail", "It was framed."),
    ("what do you call a boomerang that does not come back", "A stick."),
    ("why did the smartphone need glasses", "It lost its contacts."),
    ("what do you call a dinosaur that crashes a car", "Tyrannosaurus wrecks."),
    ("what do you call a bee that cannot make up its mind", "A maybe."),
    ("why did the robot go on holiday", "It needed to recharge."),
    ("what do you call an elephant that does not matter", "Irrelephant."),
    ("why did the football coach go to the bank", "To get his quarter back."),
    ("what do you call a penguin in the desert", "Lost."),
    ("why did the golfer wear two shirts", "In case he got a hole in one."),
    ("what do you call a singing laptop", "A Dell."),
    ("why was the stadium so hot", "All the fans left."),
    ("what do you call a rabbit with fleas", "Bugs Bunny."),
    ("what do you call a ghost's favorite fruit", "Boo-berry."),
])

add_pairs("riddles", [
    ("what has keys but cannot open locks", "A piano."),
    ("what has a face and two hands but no arms or legs", "A clock."),
    ("what gets wetter the more it dries", "A towel."),
    ("what has to be broken before you can use it", "An egg."),
    ("what has many teeth but cannot bite", "A comb."),
    ("what has one eye but cannot see", "A needle."),
    ("what goes up but never comes down", "Your age."),
    ("what can travel around the world while staying in a corner", "A stamp."),
    ("what has words but never speaks", "A book."),
    ("what has a neck but no head", "A bottle."),
    ("what has hands but cannot clap", "A clock."),
    ("what has legs but does not walk", "A table."),
    ("what has a head and a tail but no body", "A coin."),
    ("what is full of holes but still holds water", "A sponge."),
    ("what has a thumb and four fingers but is not alive", "A glove."),
    ("what can you catch but not throw", "A cold."),
    ("what has a bank but no money", "A river bank."),
    ("what runs but never walks", "A river."),
    ("what has ears but cannot hear", "A cornfield."),
    ("what belongs to you but others use it more", "Your name."),
])

# ---------------------------------------------------------------- general knowledge
add_pairs("science", [
    ("what is the largest planet", "Jupiter is the largest planet in our solar system."),
    ("what is the smallest planet", "Mercury is the smallest planet in our solar system."),
    ("what is the hottest planet", "Venus is the hottest planet because of its thick atmosphere."),
    ("what planet do we live on", "We live on Earth."),
    ("what is the closest star to earth", "The Sun is the closest star to Earth."),
    ("how many planets are in the solar system", "There are eight planets in our solar system."),
    ("what is a galaxy", "A galaxy is a huge system of stars, gas, dust and dark matter held together by gravity."),
    ("what is the milky way", "The Milky Way is the galaxy that contains our solar system."),
    ("what is gravity", "Gravity is the attraction between objects with mass."),
    ("what is photosynthesis", "Photosynthesis is how plants use sunlight, water and carbon dioxide to make food."),
    ("what is the water cycle", "The water cycle is the movement of water through evaporation, condensation, precipitation and collection."),
    ("what is an atom", "An atom is the smallest basic unit of a chemical element."),
    ("what is a molecule", "A molecule is a group of atoms joined together."),
    ("what is electricity", "Electricity is the flow of electric charge, usually electrons."),
    ("what is energy", "Energy is the ability to do work or cause change."),
    ("what is light", "Light is electromagnetic radiation that our eyes can detect."),
    ("what is sound", "Sound is a vibration that travels through a medium such as air or water."),
    ("why is the sky blue", "The atmosphere scatters blue light more than red light, so blue reaches our eyes from all directions."),
    ("why is the ocean salty", "Rivers carry dissolved minerals into the ocean, and the water evaporates while the salt remains."),
    ("why do we have seasons", "Earth's tilted axis changes how much sunlight different parts of the planet receive through the year."),
    ("what causes thunder", "Thunder is the sound made by rapidly expanding air around lightning."),
    ("what causes lightning", "Lightning is a giant electrical discharge caused by charge separation in clouds."),
    ("what is a rainbow", "A rainbow forms when sunlight is refracted and reflected inside water droplets."),
    ("what is the speed of light", "Light travels at about 299,792 kilometres per second in a vacuum."),
    ("what is the speed of sound", "Sound travels at about 343 metres per second in air at room temperature."),
    ("what is a black hole", "A black hole is a region where gravity is so strong that light cannot escape."),
    ("what is a star", "A star is a huge ball of gas held together by gravity that produces light and heat."),
    ("what is a comet", "A comet is an icy body that releases gas and dust when it comes near the Sun."),
    ("what is an asteroid", "An asteroid is a rocky object orbiting the Sun, mostly in the asteroid belt."),
    ("what is DNA", "DNA is the molecule that carries genetic instructions for living things."),
    ("what is evolution", "Evolution is the change in inherited traits of populations over generations."),
    ("what is an ecosystem", "An ecosystem is a community of living things interacting with their environment."),
    ("what is climate change", "Climate change is long-term change in global or regional climate patterns, mainly driven by greenhouse gas emissions."),
    ("what is renewable energy", "Renewable energy comes from sources that naturally replenish, such as sunlight, wind and water."),
    ("what is a fossil fuel", "Fossil fuels are coal, oil and natural gas formed from ancient organic matter."),
    ("what is the greenhouse effect", "The greenhouse effect is how certain gases trap heat in the atmosphere."),
    ("what is a vaccine", "A vaccine trains the immune system to recognise and fight a specific pathogen."),
    ("what is a virus", "A virus is a tiny infectious agent that reproduces inside living cells."),
    ("what is bacteria", "Bacteria are single-celled microorganisms found almost everywhere."),
    ("what is the human heart", "The heart is a muscular organ that pumps blood around the body."),
    ("how many bones are in the human body", "An adult human body has 206 bones."),
    ("how many teeth do adults have", "Most adults have 32 teeth."),
    ("what is the largest organ in the human body", "The skin is the largest organ."),
    ("what is the brain", "The brain is the organ that controls thought, memory, movement and body functions."),
    ("what is the function of red blood cells", "Red blood cells carry oxygen around the body."),
    ("what is the function of white blood cells", "White blood cells help defend the body against infection."),
    ("what is a healthy diet", "A healthy diet includes vegetables, fruit, protein, whole grains, healthy fats and enough water."),
    ("how much water should a person drink", "Needs vary, but many adults aim for around two litres of fluid a day."),
    ("why do we sleep", "Sleep helps the body repair itself and supports memory, mood and overall health."),
    ("why do we dream", "Dreams are thought to help process memories and emotions, though the full reason is still studied."),
])

add_pairs("geography", [
    ("what is the largest ocean", "The Pacific Ocean is the largest ocean."),
    ("what is the smallest ocean", "The Arctic Ocean is the smallest ocean."),
    ("what is the longest river", "The Nile and the Amazon are often cited as the longest, depending on how they are measured."),
    ("what is the largest desert", "Antarctica is the largest desert by area."),
    ("what is the highest mountain", "Mount Everest is the highest mountain above sea level."),
    ("what is the largest continent", "Asia is the largest continent."),
    ("what is the smallest continent", "Australia is the smallest continent."),
    ("how many continents are there", "There are seven commonly recognised continents."),
    ("what is the equator", "The equator is an imaginary line around Earth halfway between the poles."),
    ("what is a peninsula", "A peninsula is land surrounded by water on most sides but connected to a larger landmass."),
    ("what is an island", "An island is land completely surrounded by water."),
    ("what is a lake", "A lake is a large body of water surrounded by land."),
    ("what is a delta", "A river delta is the landform where a river splits and deposits sediment before entering a larger body of water."),
    ("what is a glacier", "A glacier is a large mass of slowly moving ice."),
    ("what is a volcano", "A volcano is an opening in Earth's crust where lava, ash and gases can escape."),
    ("what causes earthquakes", "Earthquakes happen when stress in Earth's crust is released suddenly along faults."),
    ("what is a tsunami", "A tsunami is a series of large ocean waves usually caused by undersea earthquakes or landslides."),
    ("what is erosion", "Erosion is the wearing away and movement of rock or soil by water, wind or ice."),
    ("what is the atmosphere", "The atmosphere is the layer of gases surrounding Earth."),
    ("what are the northern lights", "The northern lights are colourful displays caused by charged particles from the Sun hitting Earth's atmosphere."),
])

# ---------------------------------------------------------------- countries
COUNTRIES = [
    ("France", "Paris", "Europe", "Euro", "French"),
    ("Germany", "Berlin", "Europe", "Euro", "German"),
    ("Italy", "Rome", "Europe", "Euro", "Italian"),
    ("Spain", "Madrid", "Europe", "Euro", "Spanish"),
    ("Portugal", "Lisbon", "Europe", "Euro", "Portuguese"),
    ("the United Kingdom", "London", "Europe", "pound sterling", "English"),
    ("Ireland", "Dublin", "Europe", "Euro", "English and Irish"),
    ("the Netherlands", "Amsterdam", "Europe", "Euro", "Dutch"),
    ("Belgium", "Brussels", "Europe", "Euro", "Dutch, French and German"),
    ("Switzerland", "Bern", "Europe", "Swiss franc", "German, French, Italian and Romansh"),
    ("Austria", "Vienna", "Europe", "Euro", "German"),
    ("Sweden", "Stockholm", "Europe", "Swedish krona", "Swedish"),
    ("Norway", "Oslo", "Europe", "Norwegian krone", "Norwegian"),
    ("Denmark", "Copenhagen", "Europe", "Danish krone", "Danish"),
    ("Finland", "Helsinki", "Europe", "Euro", "Finnish and Swedish"),
    ("Poland", "Warsaw", "Europe", "Polish zloty", "Polish"),
    ("Greece", "Athens", "Europe", "Euro", "Greek"),
    ("Turkey", "Ankara", "Europe and Asia", "Turkish lira", "Turkish"),
    ("Russia", "Moscow", "Europe and Asia", "Russian ruble", "Russian"),
    ("Ukraine", "Kyiv", "Europe", "Ukrainian hryvnia", "Ukrainian"),
    ("the United States", "Washington, D.C.", "North America", "US dollar", "English"),
    ("Canada", "Ottawa", "North America", "Canadian dollar", "English and French"),
    ("Mexico", "Mexico City", "North America", "Mexican peso", "Spanish"),
    ("Brazil", "Brasilia", "South America", "Brazilian real", "Portuguese"),
    ("Argentina", "Buenos Aires", "South America", "Argentine peso", "Spanish"),
    ("Chile", "Santiago", "South America", "Chilean peso", "Spanish"),
    ("Peru", "Lima", "South America", "Peruvian sol", "Spanish"),
    ("Colombia", "Bogota", "South America", "Colombian peso", "Spanish"),
    ("Egypt", "Cairo", "Africa", "Egyptian pound", "Arabic"),
    ("South Africa", "Pretoria", "Africa", "South African rand", "Many languages, including English"),
    ("Nigeria", "Abuja", "Africa", "Nigerian naira", "English"),
    ("Kenya", "Nairobi", "Africa", "Kenyan shilling", "Swahili and English"),
    ("Morocco", "Rabat", "Africa", "Moroccan dirham", "Arabic and Berber"),
    ("Saudi Arabia", "Riyadh", "Asia", "Saudi riyal", "Arabic"),
    ("the United Arab Emirates", "Abu Dhabi", "Asia", "UAE dirham", "Arabic"),
    ("India", "New Delhi", "Asia", "Indian rupee", "Hindi and English"),
    ("China", "Beijing", "Asia", "Chinese yuan", "Mandarin Chinese"),
    ("Japan", "Tokyo", "Asia", "Japanese yen", "Japanese"),
    ("South Korea", "Seoul", "Asia", "South Korean won", "Korean"),
    ("Australia", "Canberra", "Australia", "Australian dollar", "English"),
    ("New Zealand", "Wellington", "Oceania", "New Zealand dollar", "English and Maori"),
    ("Indonesia", "Jakarta", "Asia", "Indonesian rupiah", "Indonesian"),
    ("Thailand", "Bangkok", "Asia", "Thai baht", "Thai"),
    ("Vietnam", "Hanoi", "Asia", "Vietnamese dong", "Vietnamese"),
    ("the Philippines", "Manila", "Asia", "Philippine peso", "Filipino and English"),
    ("Singapore", "Singapore", "Asia", "Singapore dollar", "English, Malay, Mandarin and Tamil"),
    ("Malaysia", "Kuala Lumpur", "Asia", "Malaysian ringgit", "Malay"),
    ("Pakistan", "Islamabad", "Asia", "Pakistani rupee", "Urdu and English"),
    ("Bangladesh", "Dhaka", "Asia", "Bangladeshi taka", "Bengali"),
    ("Iran", "Tehran", "Asia", "Iranian rial", "Persian"),
    ("Iraq", "Baghdad", "Asia", "Iraqi dinar", "Arabic and Kurdish"),
    ("Israel", "Jerusalem", "Asia", "Israeli new shekel", "Hebrew and Arabic"),
]
for country, capital, continent, currency, language in COUNTRIES:
    add("geography", "What is the capital of " + country + "?", "The capital of " + country + " is " + capital + ".")
    add("geography", "Which continent is " + country + " in?", country.capitalize() + " is in " + continent + ".")
    add("geography", "What currency does " + country + " use?", country.capitalize() + " uses the " + currency + ".")
    add("geography", "What language is spoken in " + country + "?", "The main language in " + country + " is " + language + ".")

# ---------------------------------------------------------------- animals
ANIMALS = [
    ("dog", "dogs", "mammal", "meat and plants", "homes around the world", "Dogs have an excellent sense of smell."),
    ("cat", "cats", "mammal", "meat", "homes around the world", "Cats spend a large part of the day sleeping."),
    ("horse", "horses", "mammal", "grass and plants", "grasslands and farms", "Horses can sleep standing up."),
    ("cow", "cows", "mammal", "grass and plants", "farms", "Cows have four stomach compartments."),
    ("pig", "pigs", "mammal", "plants and meat", "farms", "Pigs are very social and intelligent animals."),
    ("sheep", "sheep", "mammal", "grass and plants", "farms and hills", "Sheep have excellent peripheral vision."),
    ("goat", "goats", "mammal", "grass and plants", "mountains and farms", "Goats are excellent climbers."),
    ("chicken", "chickens", "bird", "seeds and insects", "farms", "Chickens can recognise many different faces."),
    ("duck", "ducks", "bird", "plants and insects", "ponds and wetlands", "Ducks have waterproof feathers."),
    ("rabbit", "rabbits", "mammal", "plants", "meadows and burrows", "Rabbits have teeth that keep growing."),
    ("elephant", "elephants", "mammal", "plants", "savannas and forests", "Elephants use their trunks for drinking and lifting."),
    ("lion", "lions", "mammal", "meat", "African savannas", "Lions live in social groups called prides."),
    ("tiger", "tigers", "mammal", "meat", "forests in Asia", "Tigers are the largest wild cats."),
    ("giraffe", "giraffes", "mammal", "leaves", "African savannas", "Giraffes have very long necks and tongues."),
    ("zebra", "zebras", "mammal", "grass", "African savannas", "Every zebra has a unique stripe pattern."),
    ("monkey", "monkeys", "mammal", "fruit, leaves and insects", "forests", "Many monkeys use their tails for balance."),
    ("gorilla", "gorillas", "mammal", "plants", "African forests", "Gorillas are the largest living primates."),
    ("bear", "bears", "mammal", "plants, fish and meat", "forests and tundra", "Some bears hibernate through winter."),
    ("wolf", "wolves", "mammal", "meat", "forests and tundra", "Wolves communicate with howls and body language."),
    ("fox", "foxes", "mammal", "meat and plants", "forests and cities", "Foxes are adaptable and often active at night."),
    ("deer", "deer", "mammal", "plants", "forests and meadows", "Male deer often grow antlers."),
    ("kangaroo", "kangaroos", "mammal", "plants", "Australia", "Kangaroos move by hopping."),
    ("koala", "koalas", "mammal", "eucalyptus leaves", "Australian forests", "Koalas sleep for much of the day."),
    ("panda", "pandas", "mammal", "bamboo", "Chinese mountain forests", "Giant pandas have a special thumb-like wrist bone."),
    ("penguin", "penguins", "bird", "fish and krill", "cold coasts and oceans", "Penguins cannot fly but are excellent swimmers."),
    ("dolphin", "dolphins", "mammal", "fish and squid", "oceans", "Dolphins use echolocation to find food."),
    ("whale", "whales", "mammal", "krill and fish", "oceans", "Blue whales are the largest animals on Earth."),
    ("shark", "sharks", "fish", "meat", "oceans", "Sharks have skeletons made of cartilage."),
    ("octopus", "octopuses", "mollusc", "crabs and fish", "oceans", "Octopuses have three hearts."),
    ("eagle", "eagles", "bird", "meat", "mountains and coasts", "Eagles have extremely sharp eyesight."),
    ("owl", "owls", "bird", "meat", "forests and grasslands", "Owls can turn their heads far around."),
    ("parrot", "parrots", "bird", "seeds and fruit", "tropical forests", "Some parrots can mimic human speech."),
    ("snake", "snakes", "reptile", "meat", "many habitats", "Snakes smell with their tongues."),
    ("crocodile", "crocodiles", "reptile", "meat", "rivers and wetlands", "Crocodiles can replace many teeth during their lives."),
    ("turtle", "turtles", "reptile", "plants and small animals", "oceans and ponds", "Some turtles can live for over a century."),
    ("frog", "frogs", "amphibian", "insects", "ponds and forests", "Frogs absorb water through their skin."),
    ("bee", "bees", "insect", "nectar and pollen", "gardens and meadows", "Bees help pollinate many food crops."),
    ("ant", "ants", "insect", "seeds, sugar and insects", "many habitats", "Ants can carry objects much heavier than themselves."),
    ("butterfly", "butterflies", "insect", "nectar", "gardens and meadows", "Butterflies taste with their feet."),
    ("spider", "spiders", "arachnid", "insects", "many habitats", "Spiders are not insects; they have eight legs."),
]
for animal, plural, cls, diet, habitat, fact in ANIMALS:
    add("animals", "What do " + plural + " eat?", plural.capitalize() + " are " + cls + "s and usually eat " + diet + ".")
    add("animals", "Where do " + plural + " live?", plural.capitalize() + " live in " + habitat + ".")
    add("animals", "Tell me a fact about " + plural, fact)
    add("animals", "What is a " + animal, "A " + animal + " is a " + cls + " that usually eats " + diet + " and lives in " + habitat + ".")

# ---------------------------------------------------------------- planets
PLANETS = [
    ("Mercury", "first", "0", "It is the smallest planet and has extreme temperature swings."),
    ("Venus", "second", "0", "It has a thick atmosphere and is the hottest planet."),
    ("Earth", "third", "1", "It is the only planet known to support life."),
    ("Mars", "fourth", "2", "It is known as the Red Planet because of iron oxide dust."),
    ("Jupiter", "fifth", "95", "It is the largest planet and has a famous Great Red Spot."),
    ("Saturn", "sixth", "146", "It is known for its bright ring system."),
    ("Uranus", "seventh", "28", "It rotates on its side compared with most planets."),
    ("Neptune", "eighth", "16", "It is the farthest planet from the Sun and has strong winds."),
]
for planet, order, moons, fact in PLANETS:
    add("space", "What is the " + order + " planet from the sun?", planet + " is the " + order + " planet from the Sun.")
    add("space", "How many moons does " + planet + " have?", planet + " has about " + moons + " known moons.")
    add("space", "Tell me a fact about " + planet, fact)

# ---------------------------------------------------------------- technology
add_pairs("technology", [
    ("what is a computer", "A computer is a machine that processes data by following instructions."),
    ("what is the internet", "The internet is a global network of connected computers."),
    ("what is a website", "A website is a collection of pages and files served over the web."),
    ("what is wifi", "Wi-Fi is a wireless technology for connecting devices to a local network."),
    ("what is bluetooth", "Bluetooth is a short-range wireless standard for connecting devices."),
    ("what is a smartphone", "A smartphone is a mobile phone with computing, camera and internet features."),
    ("what is an operating system", "An operating system manages hardware and provides services for applications."),
    ("what is software", "Software is the set of instructions and data that tells hardware what to do."),
    ("what is hardware", "Hardware is the physical part of a computer or device."),
    ("what is the cloud", "The cloud means services and storage accessed over the internet instead of only on your device."),
    ("what is a server", "A server is a computer that provides data or services to other devices."),
    ("what is an algorithm", "An algorithm is a step-by-step method for solving a problem."),
    ("what is programming", "Programming is writing instructions that a computer can execute."),
    ("what is javascript", "JavaScript is a programming language mainly used for interactive web pages."),
    ("what is python", "Python is a popular general-purpose programming language known for readable syntax."),
    ("what is html", "HTML is the markup language used to structure web pages."),
    ("what is css", "CSS is the language used to style web pages."),
    ("what is an api", "An API is a defined way for software systems to communicate."),
    ("what is a database", "A database is an organised collection of data that can be searched and updated."),
    ("what is encryption", "Encryption converts data into a form that only authorised parties can read."),
    ("what is two factor authentication", "Two-factor authentication adds a second proof of identity beyond a password."),
    ("what is a strong password", "A strong password is long, unique and hard to guess. A password manager helps."),
    ("what is a phishing email", "A phishing email pretends to be trustworthy to steal information. Check the sender and avoid unexpected links."),
    ("what is malware", "Malware is software designed to harm or exploit a device."),
    ("what is a firewall", "A firewall filters network traffic to help protect a device or network."),
    ("what is a backup", "A backup is a copy of data kept so it can be restored if the original is lost."),
    ("what is open source", "Open source software has source code that anyone can inspect, modify and share under its licence."),
    ("what is artificial intelligence", "Artificial intelligence is the field of building systems that perform tasks associated with human intelligence."),
    ("what is machine learning", "Machine learning is a way of training software to find patterns in data."),
    ("what is a neural network", "A neural network is a machine-learning model loosely inspired by connected neurons."),
    ("what is quantum computing", "Quantum computing uses quantum states to process certain problems differently from classical computers."),
    ("what is the smallest unit of data", "A bit is the smallest unit of data, and eight bits make a byte."),
    ("what is ram", "RAM is fast temporary memory a computer uses while running programs."),
    ("what is an ssd", "An SSD is fast storage with no moving parts."),
    ("what is a gpu", "A GPU is a processor optimised for parallel tasks such as graphics and some AI workloads."),
    ("what is a cpu", "A CPU is the main processor that runs instructions in a computer."),
    ("what is a bug in software", "A software bug is an error that makes a program behave incorrectly."),
    ("what is version control", "Version control tracks changes to files so you can review and undo them."),
    ("what is git", "Git is a distributed version-control system for tracking code changes."),
    ("what is a framework", "A framework is a reusable set of tools and conventions for building software."),
])

# ---------------------------------------------------------------- food
add_pairs("food", [
    ("how do i cook rice", "Rinse the rice, use about two parts water to one part rice, bring it to a boil, then cover and simmer until tender."),
    ("how do i boil an egg", "Place eggs in water, bring to a boil, then simmer for about 6 minutes for soft-boiled or 10 minutes for hard-boiled."),
    ("how do i make pasta", "Boil salted water, add pasta, cook until al dente, then drain and mix with your sauce."),
    ("how do i make toast", "Toast bread until golden, then add butter, jam or whatever you enjoy."),
    ("how do i make a sandwich", "Start with bread, add a filling such as cheese or vegetables, and close it with another slice."),
    ("how do i make coffee", "Add ground coffee to a filter or press, pour hot water over it, and let it steep before drinking."),
    ("how do i make tea", "Steep tea in hot water for a few minutes, then remove the leaves or bag."),
    ("what is a healthy breakfast", "Oats, fruit, eggs, yoghurt or whole-grain toast are simple breakfast options."),
    ("what is a healthy snack", "Fruit, nuts, yoghurt or vegetables with hummus are easy snack choices."),
    ("what is protein", "Protein is a nutrient used for building and repairing body tissues."),
    ("what is a carbohydrate", "Carbohydrates are a main source of energy for the body."),
    ("what is fat", "Fat is a nutrient that stores energy and helps the body absorb some vitamins."),
    ("what is fibre", "Fibre is plant material that helps digestion and supports gut health."),
    ("what is vitamin c", "Vitamin C supports the immune system and helps the body absorb iron."),
    ("what food has vitamin c", "Citrus fruit, berries, peppers and broccoli are good sources of vitamin C."),
    ("what food has iron", "Lean meat, beans, lentils, spinach and fortified cereals contain iron."),
    ("what is a balanced meal", "A balanced meal usually includes vegetables, a protein source, a carbohydrate and some healthy fat."),
    ("what is pizza", "Pizza is a flat bread base topped with tomato, cheese and other ingredients, then baked."),
    ("what is sushi", "Sushi is a Japanese dish based on vinegared rice with ingredients such as fish or vegetables."),
    ("what is pasta", "Pasta is an Italian food made from dough of flour and water or eggs."),
    ("what is curry", "Curry is a broad family of dishes made with spices, often served with rice or bread."),
    ("what is soup", "Soup is a liquid dish made by cooking ingredients in water or stock."),
    ("what is salad", "Salad is a dish of mixed ingredients, often vegetables, served cold."),
    ("what is chocolate", "Chocolate is made from cocoa beans, sugar and often milk or cocoa butter."),
    ("what is honey", "Honey is a sweet substance made by bees from flower nectar."),
    ("what is olive oil", "Olive oil is oil pressed from olives, used in cooking and dressings."),
    ("what is bread", "Bread is a baked food made from flour, water and usually yeast."),
    ("what is cheese", "Cheese is a dairy food made by curdling milk and removing whey."),
    ("what is yoghurt", "Yoghurt is a dairy product made by fermenting milk with cultures."),
    ("what is a vegetarian diet", "A vegetarian diet avoids meat and fish but may include dairy and eggs."),
    ("what is a vegan diet", "A vegan diet avoids all animal products."),
    ("how do i store leftovers", "Cool leftovers promptly, refrigerate them in a sealed container, and reheat thoroughly."),
])

# ---------------------------------------------------------------- health and wellbeing
add_pairs("wellbeing", [
    ("how can i sleep better", "Keep a regular sleep schedule, dim screens before bed and make the room cool and quiet."),
    ("how much sleep do i need", "Most adults need about seven to nine hours of sleep per night."),
    ("how can i reduce stress", "Slow breathing, a short walk, breaking tasks into smaller steps and talking to someone can help."),
    ("how can i focus better", "Remove distractions, choose one task, work in short focused blocks and take short breaks."),
    ("how can i build a habit", "Start small, attach the habit to a daily trigger and track it without expecting perfection."),
    ("how can i drink more water", "Keep a bottle nearby and drink a glass with meals or after each break."),
    ("how can i sit better", "Keep your feet supported, screen near eye level and take movement breaks."),
    ("how can i reduce eye strain", "Follow the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds."),
    ("how can i start exercising", "Begin with short walks or light activity and increase gradually."),
    ("how can i stretch", "Move slowly into a comfortable stretch, hold briefly and breathe normally."),
    ("what is mindfulness", "Mindfulness is paying attention to the present moment without judging it."),
    ("how do i breathe calmly", "Breathe in slowly, pause, then breathe out longer than you inhaled. Repeat a few times."),
    ("how can i be happier", "Build good sleep, movement, connection and small enjoyable routines into your week."),
    ("how can i be more confident", "Practise the skill, prepare when you can, and focus on progress rather than perfection."),
    ("how can i stop overthinking", "Write the worry down, separate what you can control, and choose one small action."),
    ("how can i improve my mood", "A short walk, daylight, music, water or a quick message to a friend can help."),
    ("how can i take a break", "Step away from the screen, move your body and give your attention something different for a few minutes."),
    ("how can i be more productive", "Pick the most important task, remove distractions and work on it before smaller tasks."),
    ("how can i beat procrastination", "Make the first step tiny and start for just five minutes."),
    ("how can i manage my time", "List tasks, estimate effort, schedule the important ones and leave buffer time."),
    ("how can i stop being tired", "Check sleep, food, water and movement first. If tiredness persists, consider speaking to a health professional."),
    ("what should i eat before exercise", "A light snack with carbohydrates and some protein is usually a good option."),
    ("how can i recover after exercise", "Hydrate, eat something with protein and carbohydrates, and get enough rest."),
    ("what is a healthy weight", "Healthy weight varies by person. A health professional can help assess what is right for you."),
    ("how can i reduce screen time", "Set app limits, keep devices out of the bedroom and plan screen-free activities."),
    ("how can i be more patient", "Pause before reacting, breathe slowly and remember that some things take time."),
    ("how can i be kinder to myself", "Speak to yourself the way you would speak to a friend who was trying their best."),
    ("how can i handle a bad day", "Lower the pressure, do one small useful thing and give yourself time to reset."),
    ("how can i relax", "Try slow breathing, a warm shower, gentle music or a few minutes away from screens."),
    ("how can i stay motivated", "Connect the task to a reason you care about and celebrate small progress."),
])

# ---------------------------------------------------------------- advice / productivity
add_pairs("advice", [
    ("how do i make a decision", "List the options, note the trade-offs, consider what matters most, then choose and review later."),
    ("how do i solve a problem", "Define the problem, gather facts, list possible solutions and test the most practical one."),
    ("how do i learn something new", "Break it into small pieces, practise regularly and test yourself instead of only rereading."),
    ("how do i remember better", "Use spaced repetition, active recall and connections to things you already know."),
    ("how do i study for an exam", "Plan topics, practise questions, review mistakes and sleep well before the exam."),
    ("how do i write better", "Write a rough draft first, then simplify sentences and remove anything that does not help the point."),
    ("how do i give a presentation", "Know your main message, practise out loud and keep slides simple."),
    ("how do i prepare for an interview", "Research the role, prepare examples of your work and practise clear answers."),
    ("how do i negotiate", "Understand your priorities, know your alternative and aim for a fair outcome rather than winning every point."),
    ("how do i save money", "Track spending, separate needs from wants and set a small automatic saving amount."),
    ("how do i make a budget", "List income and expenses, cover essentials first, then plan savings and flexible spending."),
    ("how do i stay organised", "Keep one task list, review it daily and put appointments in a calendar."),
    ("how do i prioritise", "Use importance and urgency together, but protect time for important work that is not urgent."),
    ("how do i focus in a noisy place", "Use headphones, work near a wall, or choose a quieter time and location."),
    ("how do i break a bad habit", "Identify the trigger, replace the routine and make the old habit harder to do."),
    ("how do i build a morning routine", "Choose two or three simple actions and repeat them at the same time each day."),
    ("how do i deal with failure", "Treat it as information, review what happened and change one thing next time."),
    ("how do i ask for help", "Explain what you tried, what you need and what would be most useful."),
    ("how do i say no", "Be brief and honest: thank them, explain that you cannot commit, and offer another option if you want."),
    ("how do i handle criticism", "Separate the useful information from the tone, ask questions and decide what to change."),
    ("how do i stop comparing myself", "Compare your progress with your past self and limit social media that makes you feel worse."),
    ("how do i be more creative", "Collect ideas, combine unrelated things and give yourself time without immediate judgement."),
    ("how do i start a project", "Define the smallest useful version and build that first."),
    ("how do i finish a project", "Set a clear finish line, remove optional scope and schedule the remaining work."),
    ("how do i learn to code", "Pick one language, build small projects and practise reading and debugging code."),
    ("how do i debug code", "Reproduce the problem, read the error, check assumptions and change one thing at a time."),
    ("how do i improve my typing", "Practise regularly, keep your hands relaxed and use the correct finger positions."),
    ("how do i read more", "Carry a book, read for short sessions and choose material you actually enjoy."),
    ("how do i wake up earlier", "Go to bed earlier, keep a consistent alarm and put the alarm away from the bed."),
    ("how do i stop wasting time", "Notice the trigger, set a time limit and make the next useful action easy to start."),
])

# ---------------------------------------------------------------- music, movies, books
add_pairs("culture", [
    ("what is music", "Music is organised sound made from rhythm, melody and harmony."),
    ("what is a melody", "A melody is a sequence of musical notes perceived as a single line."),
    ("what is rhythm", "Rhythm is the pattern of sounds and silences in time."),
    ("what is harmony", "Harmony is the combination of notes sounded together."),
    ("what is an orchestra", "An orchestra is a large group of musicians playing strings, woodwinds, brass and percussion."),
    ("what is a guitar", "A guitar is a string instrument usually played by plucking or strumming."),
    ("what is a piano", "A piano is a keyboard instrument that makes sound when hammers strike strings."),
    ("what is a violin", "A violin is a small string instrument played with a bow."),
    ("what is jazz", "Jazz is a music genre with improvisation, swing and rich harmony."),
    ("what is rock music", "Rock music is a broad genre built around guitars, drums and strong rhythms."),
    ("what is classical music", "Classical music usually refers to Western art music with a long written tradition."),
    ("what is hip hop", "Hip hop is a culture and music genre that began in the 1970s, often featuring rapping and beats."),
    ("what is electronic music", "Electronic music is made primarily with electronic instruments and software."),
    ("what is a movie", "A movie is a recorded sequence of moving images that tells a story or presents information."),
    ("what is a documentary", "A documentary presents factual information about real people, events or subjects."),
    ("what is animation", "Animation creates the illusion of movement by showing a series of images."),
    ("what is a director", "A director guides the creative and practical decisions of a film or stage production."),
    ("what is a screenplay", "A screenplay is the written script for a film, including dialogue and action."),
    ("what is a novel", "A novel is a long fictional prose narrative."),
    ("what is a short story", "A short story is a brief fictional narrative, usually focused on one idea or moment."),
    ("what is poetry", "Poetry is writing that uses concentrated language, rhythm and imagery."),
    ("what is a biography", "A biography is the story of a real person's life."),
    ("what is science fiction", "Science fiction explores imagined science, technology and futures."),
    ("what is fantasy", "Fantasy fiction includes magic, imaginary worlds and supernatural elements."),
    ("what is a mystery story", "A mystery story centres on a puzzle, crime or secret that is gradually revealed."),
    ("what is a comedy", "Comedy is a genre intended to amuse."),
    ("what is a tragedy", "Tragedy is a serious drama with sorrowful or disastrous events."),
    ("what is a sequel", "A sequel continues the story of an earlier work."),
    ("what is a prequel", "A prequel tells a story set before an earlier work."),
    ("what makes a good story", "Strong characters, clear stakes, believable change and a satisfying resolution help."),
])

# ---------------------------------------------------------------- sports
add_pairs("sports", [
    ("what is football", "Football usually refers to association football, played by two teams trying to score goals."),
    ("what is basketball", "Basketball is a team sport where players score by putting the ball through a hoop."),
    ("what is tennis", "Tennis is a racket sport played between players or pairs, scoring points by hitting the ball over a net."),
    ("what is cricket", "Cricket is a bat-and-ball sport played between two teams with runs, wickets and overs."),
    ("what is baseball", "Baseball is a bat-and-ball game played between two teams over nine innings."),
    ("what is golf", "Golf is a sport where players hit a ball into holes using as few strokes as possible."),
    ("what is swimming", "Swimming is moving through water using coordinated body movements."),
    ("what is running", "Running is a fast form of movement where both feet leave the ground at some point."),
    ("what is cycling", "Cycling is riding a bicycle for transport, exercise or sport."),
    ("what is chess", "Chess is a strategy board game where players aim to checkmate the opponent's king."),
    ("how do you play chess", "Each piece moves in its own way, and the goal is to trap the opponent's king."),
    ("what is checkmate", "Checkmate is when the king is in check and has no legal move to escape."),
    ("what is a marathon", "A marathon is a running race of 42.195 kilometres."),
    ("what is the olympics", "The Olympics are a major international multi-sport event held every four years."),
    ("what is a penalty in football", "A penalty is a direct kick from the penalty spot after certain fouls inside the box."),
    ("what is offside in football", "Offside limits attacking players from being ahead of the last defender when the ball is played."),
    ("what is a slam dunk", "A slam dunk is a basketball shot where a player jumps and forces the ball through the hoop."),
    ("what is a three pointer", "A three-pointer is a basketball shot made from beyond the three-point line."),
    ("what is a home run", "A home run is a baseball hit that lets the batter round all bases and score."),
    ("what is a strike in baseball", "A strike is a pitch in the strike zone that the batter does not hit, or a swing and miss."),
    ("what is a wicket in cricket", "A wicket is the set of stumps and bails, or the dismissal of a batter."),
    ("what is a grand slam in tennis", "A grand slam is one of the four major tennis tournaments."),
    ("how can i improve at a sport", "Practise the fundamentals, review your technique and increase difficulty gradually."),
    ("how can i run faster", "Build consistency, include easy runs, add interval work and allow recovery."),
    ("how can i get fit", "Combine regular movement, strength work, sleep and a balanced diet."),
    ("how can i stay active", "Choose activities you enjoy and schedule short sessions rather than waiting for a perfect block of time."),
    ("what is teamwork", "Teamwork is people cooperating toward a shared goal."),
    ("what makes a good teammate", "Reliability, communication, respect and willingness to help others."),
    ("how do i warm up", "Start with light movement, then do dynamic stretches and build intensity gradually."),
    ("how do i cool down", "Slow your pace, breathe calmly and do gentle stretching."),
])

# ---------------------------------------------------------------- school and work
add_pairs("school and work", [
    ("how do i take better notes", "Write key ideas in your own words, leave space for questions and review the notes soon after."),
    ("how do i prepare for a test", "Study in short sessions, practise recall and focus extra time on mistakes."),
    ("how do i handle exam stress", "Prepare early, breathe slowly and focus on one question at a time."),
    ("how do i write an essay", "Plan a clear thesis, organise supporting points and revise for clarity."),
    ("how do i improve my writing", "Read more, write regularly and edit for simplicity."),
    ("how do i learn a language", "Practise a little every day, focus on common phrases and use the language in real situations."),
    ("how do i remember vocabulary", "Use spaced repetition and put words into sentences or stories."),
    ("how do i prepare for a job interview", "Understand the role, prepare examples and practise concise answers."),
    ("how do i write a resume", "Focus on relevant skills and results, keep the format clear and proofread carefully."),
    ("how do i write a cover letter", "Explain why you want the role, show relevant evidence and keep it concise."),
    ("how do i ask for a raise", "Prepare evidence of your contribution, know the market range and choose a calm moment."),
    ("how do i handle a difficult coworker", "Focus on the work, communicate clearly and involve a manager if the behaviour continues."),
    ("how do i manage a deadline", "Break the work into steps, schedule them and start early enough to leave buffer time."),
    ("how do i run a meeting", "Set an agenda, keep discussion focused and end with clear actions."),
    ("how do i give feedback", "Be specific, focus on behaviour and impact, and suggest a useful next step."),
    ("how do i receive feedback", "Listen fully, ask clarifying questions and decide what is useful."),
    ("how do i be a better leader", "Set clear expectations, support people and make decisions fairly."),
    ("how do i work in a team", "Share information, do your part and listen to other perspectives."),
    ("how do i manage email", "Check at set times, reply briefly and move tasks into a list."),
    ("how do i improve concentration", "Reduce notifications, work in focused blocks and take real breaks."),
    ("what is a good study routine", "A consistent time, a clear place, short focused sessions and regular review."),
    ("how do i stop delaying homework", "Start with the easiest five-minute step and remove distractions."),
    ("how do i choose a career", "Consider interests, strengths, working conditions and what you want to learn."),
    ("how do i change careers", "Identify transferable skills, learn the gaps and build evidence through projects."),
    ("how do i prepare for a presentation", "Know your message, practise out loud and prepare for likely questions."),
    ("how do i deal with public speaking nerves", "Breathe slowly, focus on the audience and practise until the opening feels natural."),
    ("how do i write a professional email", "Use a clear subject, a short opening, the request and a polite close."),
    ("how do i set goals", "Make them specific, measurable and time-bound, then break them into small actions."),
    ("how do i stay calm at work", "Pause, prioritise one task and communicate early if something is slipping."),
    ("how do i balance work and life", "Set boundaries, protect recovery time and remember that rest supports performance."),
])

# ---------------------------------------------------------------- relationships / etiquette
add_pairs("relationships", [
    ("how do i make friends", "Show up regularly, ask questions and suggest simple shared activities."),
    ("how do i start a conversation", "Ask something open and easy, then listen and follow up on their answer."),
    ("how do i keep a conversation going", "Ask follow-up questions, share a little about yourself and react to what they say."),
    ("how do i be a better listener", "Give attention, avoid interrupting and reflect back what you understood."),
    ("how do i apologise", "Name what you did, acknowledge the impact and say what you will do differently."),
    ("how do i forgive someone", "Forgiveness is a process. It helps to understand what happened and decide what boundary you need."),
    ("how do i set a boundary", "Be clear, calm and specific about what you can and cannot do."),
    ("how do i say no politely", "Thank them, explain briefly that you cannot commit, and offer an alternative if appropriate."),
    ("how do i deal with a disagreement", "Focus on the problem, listen to the other view and look for a workable next step."),
    ("how do i show someone i care", "Small consistent actions often matter more than grand gestures."),
    ("how do i make someone feel heard", "Let them finish, ask what they need and avoid rushing to advice."),
    ("how do i handle rejection", "Treat it as information, allow yourself to feel it, and keep your self-worth separate from one outcome."),
    ("how do i be more confident in social situations", "Prepare a few simple questions and focus on the other person rather than perfecting yourself."),
    ("how do i deal with rude people", "Stay calm, set a boundary and disengage if the behaviour continues."),
    ("how do i repair a friendship", "Acknowledge what happened, apologise sincerely and give the other person time."),
    ("how do i know if someone is a good friend", "Good friends are consistent, respectful and safe to be honest with."),
    ("how do i support a friend who is sad", "Listen, check what they need and stay in touch rather than trying to fix everything."),
    ("how do i thank someone", "Be specific about what they did and why it mattered."),
    ("how do i give a compliment", "Be sincere and specific rather than generic."),
    ("how do i handle gossip", "Avoid spreading it, change the subject and speak directly if it becomes harmful."),
    ("how do i be a good host", "Make people comfortable, offer something simple and include everyone."),
    ("how do i be a good guest", "Arrive on time, respect the space and offer to help."),
    ("how do i disagree respectfully", "Acknowledge their view, explain yours and focus on reasons rather than personal attacks."),
    ("how do i build trust", "Do what you say, be consistent and be honest even when it is inconvenient."),
    ("how do i handle a breakup", "Give yourself time, lean on supportive people and avoid making big decisions while emotions are high."),
    ("how do i improve communication", "Speak clearly, listen actively and check that you understood."),
    ("how do i handle criticism from a friend", "Ask what they mean, separate the message from the emotion and decide what to change."),
    ("how do i be more empathetic", "Try to understand the other person's perspective before responding."),
    ("how do i keep a long distance friendship", "Schedule regular contact, share small updates and make plans to meet when possible."),
    ("how do i resolve a misunderstanding", "Ask what they heard, explain what you meant and focus on the shared goal."),
])

# ---------------------------------------------------------------- travel
add_pairs("travel", [
    ("how do i plan a trip", "Choose dates, set a budget, book transport and stay, then plan a few key activities."),
    ("how do i pack light", "Choose versatile clothes, limit shoes and use packing cubes or rolls."),
    ("what should i pack for a trip", "Essentials, weather-appropriate clothes, chargers, medication, documents and a little spare space."),
    ("how do i find cheap flights", "Be flexible with dates, compare airlines and book at a reasonable distance from departure."),
    ("how do i travel safely", "Share your plans, keep documents secure, stay aware of your surroundings and have emergency contacts."),
    ("what is a passport", "A passport is a government document that identifies you for international travel."),
    ("what is a visa", "A visa is permission from a country to enter, stay or work there under specific conditions."),
    ("how do i deal with jet lag", "Adjust sleep gradually, get daylight and stay hydrated."),
    ("how do i avoid getting lost", "Download offline maps, note your accommodation and keep a charged phone."),
    ("what is a carry on", "A carry-on is luggage small enough to take into the cabin."),
    ("how early should i arrive at the airport", "Many airports recommend two to three hours before an international flight."),
    ("how do i exchange currency", "Compare rates and fees, and avoid exchanging large amounts at poor rates."),
    ("how do i travel on a budget", "Travel off peak, use public transport, stay in simpler accommodation and plan food costs."),
    ("what is a hostel", "A hostel is budget accommodation with shared rooms or facilities."),
    ("what is a hotel", "A hotel is accommodation with rooms and usually services such as reception."),
    ("how do i choose a hotel", "Check location, reviews, cancellation policy and whether the room has what you need."),
    ("how do i use public transport abroad", "Research passes, validate tickets and keep the local transit app or map handy."),
    ("how do i stay healthy while travelling", "Drink safe water, wash hands, sleep enough and carry basic medication."),
    ("what should i do if i lose my passport", "Report it to local authorities and your embassy, and keep a copy of your documents."),
    ("how do i travel with a pet", "Check airline and destination rules, prepare a carrier and carry health documents."),
    ("what is travel insurance", "Travel insurance can cover medical costs, cancellations and lost luggage."),
    ("how do i beat boredom on a long flight", "Bring a book, offline entertainment, snacks and a neck pillow."),
    ("how do i adjust to a new time zone", "Get daylight at the right time, eat on local schedule and avoid long naps."),
    ("what is a layover", "A layover is a stop between flights before continuing to the destination."),
    ("how do i keep my home safe while away", "Lock up, pause deliveries and ask someone to check on the place."),
    ("what is slow travel", "Slow travel means spending more time in fewer places and experiencing them more deeply."),
    ("how do i take better travel photos", "Look for good light, include a clear subject and take a few different angles."),
    ("what is a day trip", "A day trip is a journey to a place and back within the same day."),
    ("how do i travel responsibly", "Respect local culture, reduce waste and support local businesses."),
    ("how do i choose a destination", "Consider interests, budget, season, travel time and the kind of experience you want."),
])

# ---------------------------------------------------------------- weather and nature
add_pairs("nature", [
    ("what is weather", "Weather is the state of the atmosphere at a particular place and time."),
    ("what is climate", "Climate is the typical pattern of weather in a place over a long period."),
    ("why does it rain", "Water vapour cools and condenses into droplets that become heavy enough to fall."),
    ("why does it snow", "Snow forms when water vapour freezes into ice crystals that stay frozen as they fall."),
    ("what is wind", "Wind is air moving from higher pressure to lower pressure."),
    ("what is a hurricane", "A hurricane is a large tropical storm with strong winds and heavy rain."),
    ("what is a tornado", "A tornado is a rapidly rotating column of air extending from a storm to the ground."),
    ("what is fog", "Fog is a cloud at ground level that reduces visibility."),
    ("what is humidity", "Humidity is the amount of water vapour in the air."),
    ("what is a cloud", "A cloud is a visible collection of tiny water droplets or ice crystals."),
    ("what causes rainbows", "Sunlight bends and reflects inside water droplets, separating into colours."),
    ("what is frost", "Frost forms when water vapour freezes directly onto cold surfaces."),
    ("what is dew", "Dew is water that condenses on cool surfaces overnight."),
    ("what is a heatwave", "A heatwave is a period of unusually hot weather."),
    ("what is a drought", "A drought is a long period with too little water."),
    ("what is a flood", "A flood is water covering land that is normally dry."),
    ("what is a forest", "A forest is a large area dominated by trees."),
    ("what is a rainforest", "A rainforest is a dense forest with high rainfall and rich biodiversity."),
    ("what is a coral reef", "A coral reef is a structure built by coral animals in shallow tropical water."),
    ("what is biodiversity", "Biodiversity is the variety of living things in an environment."),
])

# ---------------------------------------------------------------- history
add_pairs("history", [
    ("what is history", "History is the study of past events, people and societies."),
    ("what is an ancient civilisation", "An ancient civilisation is an early society with cities, writing or organised government."),
    ("what were the pyramids built for", "The Egyptian pyramids were mostly built as tombs for pharaohs."),
    ("who was cleopatra", "Cleopatra was a ruler of ancient Egypt."),
    ("what was the roman empire", "The Roman Empire was a major ancient power centred on Rome."),
    ("what was the industrial revolution", "The Industrial Revolution was a period of rapid growth in machine production and industry."),
    ("what was world war one", "World War One was a global conflict from 1914 to 1918."),
    ("what was world war two", "World War Two was a global conflict from 1939 to 1945."),
    ("what was the cold war", "The Cold War was a long period of political and military tension, mainly between the United States and the Soviet Union."),
    ("who was albert einstein", "Albert Einstein was a physicist known for the theory of relativity."),
    ("who was isaac newton", "Isaac Newton was a physicist and mathematician who described laws of motion and gravity."),
    ("who was marie curie", "Marie Curie was a scientist known for research on radioactivity."),
    ("who was leonardo da vinci", "Leonardo da Vinci was a Renaissance artist and inventor."),
    ("what was the renaissance", "The Renaissance was a period of renewed interest in art, science and classical learning in Europe."),
    ("what was the printing press", "The printing press helped make books faster and cheaper to produce, spreading ideas widely."),
    ("what was the moon landing", "Apollo 11 landed humans on the Moon in 1969."),
    ("who was nelson mandela", "Nelson Mandela was a South African leader and anti-apartheid activist."),
    ("what was the berlin wall", "The Berlin Wall divided East and West Berlin from 1961 until 1989."),
    ("what is democracy", "Democracy is a system where people have a say in government, usually through elections."),
    ("what is an empire", "An empire is a large political unit ruled by one central power."),
    ("what is a revolution", "A revolution is a major and often rapid change in politics, society or technology."),
    ("what is archaeology", "Archaeology is the study of the past through physical remains."),
    ("what is a museum", "A museum is a place that collects, preserves and displays objects for learning."),
    ("what is a primary source", "A primary source is evidence created during the period being studied."),
    ("what is a secondary source", "A secondary source interprets or analyses primary sources."),
    ("who built the great wall of china", "The Great Wall of China was built and rebuilt by several Chinese dynasties over centuries."),
    ("what was the silk road", "The Silk Road was a network of trade routes connecting Asia, the Middle East and Europe."),
    ("what was the space race", "The Space Race was competition between the United States and Soviet Union in space exploration."),
    ("what is the united nations", "The United Nations is an international organisation founded in 1945 to support peace and cooperation."),
    ("what is a constitution", "A constitution is a set of fundamental rules for how a state is governed."),
])

# ---------------------------------------------------------------- periodic table
ELEMENTS = """Hydrogen|H|1
Helium|He|2
Lithium|Li|3
Beryllium|Be|4
Boron|B|5
Carbon|C|6
Nitrogen|N|7
Oxygen|O|8
Fluorine|F|9
Neon|Ne|10
Sodium|Na|11
Magnesium|Mg|12
Aluminium|Al|13
Silicon|Si|14
Phosphorus|P|15
Sulfur|S|16
Chlorine|Cl|17
Argon|Ar|18
Potassium|K|19
Calcium|Ca|20
Scandium|Sc|21
Titanium|Ti|22
Vanadium|V|23
Chromium|Cr|24
Manganese|Mn|25
Iron|Fe|26
Cobalt|Co|27
Nickel|Ni|28
Copper|Cu|29
Zinc|Zn|30
Gallium|Ga|31
Germanium|Ge|32
Arsenic|As|33
Selenium|Se|34
Bromine|Br|35
Krypton|Kr|36
Rubidium|Rb|37
Strontium|Sr|38
Yttrium|Y|39
Zirconium|Zr|40
Niobium|Nb|41
Molybdenum|Mo|42
Technetium|Tc|43
Ruthenium|Ru|44
Rhodium|Rh|45
Palladium|Pd|46
Silver|Ag|47
Cadmium|Cd|48
Indium|In|49
Tin|Sn|50
Antimony|Sb|51
Tellurium|Te|52
Iodine|I|53
Xenon|Xe|54
Caesium|Cs|55
Barium|Ba|56
Lanthanum|La|57
Cerium|Ce|58
Praseodymium|Pr|59
Neodymium|Nd|60
Promethium|Pm|61
Samarium|Sm|62
Europium|Eu|63
Gadolinium|Gd|64
Terbium|Tb|65
Dysprosium|Dy|66
Holmium|Ho|67
Erbium|Er|68
Thulium|Tm|69
Ytterbium|Yb|70
Lutetium|Lu|71
Hafnium|Hf|72
Tantalum|Ta|73
Tungsten|W|74
Rhenium|Re|75
Osmium|Os|76
Iridium|Ir|77
Platinum|Pt|78
Gold|Au|79
Mercury|Hg|80
Thallium|Tl|81
Lead|Pb|82
Bismuth|Bi|83
Polonium|Po|84
Astatine|At|85
Radon|Rn|86
Francium|Fr|87
Radium|Ra|88
Actinium|Ac|89
Thorium|Th|90
Protactinium|Pa|91
Uranium|U|92
Neptunium|Np|93
Plutonium|Pu|94
Americium|Am|95
Curium|Cm|96
Berkelium|Bk|97
Californium|Cf|98
Einsteinium|Es|99
Fermium|Fm|100
Mendelevium|Md|101
Nobelium|No|102
Lawrencium|Lr|103
Rutherfordium|Rf|104
Dubnium|Db|105
Seaborgium|Sg|106
Bohrium|Bh|107
Hassium|Hs|108
Meitnerium|Mt|109
Darmstadtium|Ds|110
Roentgenium|Rg|111
Copernicium|Cn|112
Nihonium|Nh|113
Flerovium|Fl|114
Moscovium|Mc|115
Livermorium|Lv|116
Tennessine|Ts|117
Oganesson|Og|118""".strip().split("\n")
for row in ELEMENTS:
    name, symbol, number = row.split("|")
    add("science", "What is the chemical symbol for " + name + "?", "The chemical symbol for " + name + " is " + symbol + ".")
    add("science", "What element has the symbol " + symbol + "?", symbol + " is the symbol for " + name + ".")
    add("science", "What is the atomic number of " + name + "?", name + " has atomic number " + number + ".")

US_STATES = """Alabama|Montgomery|AL
Alaska|Juneau|AK
Arizona|Phoenix|AZ
Arkansas|Little Rock|AR
California|Sacramento|CA
Colorado|Denver|CO
Connecticut|Hartford|CT
Delaware|Dover|DE
Florida|Tallahassee|FL
Georgia|Atlanta|GA
Hawaii|Honolulu|HI
Idaho|Boise|ID
Illinois|Springfield|IL
Indiana|Indianapolis|IN
Iowa|Des Moines|IA
Kansas|Topeka|KS
Kentucky|Frankfort|KY
Louisiana|Baton Rouge|LA
Maine|Augusta|ME
Maryland|Annapolis|MD
Massachusetts|Boston|MA
Michigan|Lansing|MI
Minnesota|Saint Paul|MN
Mississippi|Jackson|MS
Missouri|Jefferson City|MO
Montana|Helena|MT
Nebraska|Lincoln|NE
Nevada|Carson City|NV
New Hampshire|Concord|NH
New Jersey|Trenton|NJ
New Mexico|Santa Fe|NM
New York|Albany|NY
North Carolina|Raleigh|NC
North Dakota|Bismarck|ND
Ohio|Columbus|OH
Oklahoma|Oklahoma City|OK
Oregon|Salem|OR
Pennsylvania|Harrisburg|PA
Rhode Island|Providence|RI
South Carolina|Columbia|SC
South Dakota|Pierre|SD
Tennessee|Nashville|TN
Texas|Austin|TX
Utah|Salt Lake City|UT
Vermont|Montpelier|VT
Virginia|Richmond|VA
Washington|Olympia|WA
West Virginia|Charleston|WV
Wisconsin|Madison|WI
Wyoming|Cheyenne|WY""".strip().split("\n")
for row in US_STATES:
    state, capital, abbreviation = row.split("|")
    add("geography", "What is the capital of " + state + "?", "The capital of " + state + " is " + capital + ".")
    add("geography", "What is the abbreviation for " + state + "?", "The abbreviation for " + state + " is " + abbreviation + ".")

# ---------------------------------------------------------------- generated arithmetic
OPS = ["+", "-", "*"]
for _ in range(320):
    a = random.randint(2, 99)
    b = random.randint(2, 99)
    op = random.choice(OPS)
    if op == "*":
        a = random.randint(2, 20)
        b = random.randint(2, 20)
        answer = a * b
    elif op == "-":
        if b > a:
            a, b = b, a
        answer = a - b
    else:
        answer = a + b
    add("math", "What is " + str(a) + " " + op + " " + str(b) + "?", "The answer is " + str(answer) + ".")

for _ in range(120):
    b = random.randint(2, 12)
    answer = random.randint(2, 20)
    a = b * answer
    add("math", "What is " + str(a) + " divided by " + str(b) + "?", "The answer is " + str(answer) + ".")


# ---------------------------------------------------------------- build conversations
BY_TOPIC = {}
for q, a, t in PAIRS:
    BY_TOPIC.setdefault(t, []).append((q, a))

CONVERSATIONS = 5000
MESSAGES_PER_CONVERSATION = 10
topic_names = list(BY_TOPIC)
conversation_messages = 0
used_in_conversations = set()
for _ in range(CONVERSATIONS):
    topic = random.choice(topic_names)
    pool = BY_TOPIC[topic]
    for _turn in range(MESSAGES_PER_CONVERSATION // 2):
        q, a = random.choice(pool)
        used_in_conversations.add(q)
        conversation_messages += 2

for q, a, t in PAIRS:
    # Keep every unique pair available for retrieval, even if a random draw skipped it.
    pass

OUT = Path(__file__).resolve().parent.parent / "docs" / "assistant-chat-data.js"
lines = [
    "/* LessFun general chat pack.",
    "   Generated from " + str(CONVERSATIONS) + " conversations x " + str(MESSAGES_PER_CONVERSATION) + " messages = " + str(conversation_messages) + " messages.",
    "   Only unique, self-contained turns are loaded so the pack stays fast and works offline. */",
    "window.LESSFUN_CHAT_META = " + json.dumps({
        "conversations": CONVERSATIONS,
        "messages": conversation_messages,
        "pairs": len(PAIRS),
    }, ensure_ascii=False) + ";",
    "window.LESSFUN_CHAT_PAIRS = [",
]
for q, a, t in PAIRS:
    lines.append("  " + json.dumps([q, a, t], ensure_ascii=False) + ",")
lines.append("];")
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

print("Wrote " + str(OUT))
print("Unique pairs: " + str(len(PAIRS)))
for topic in sorted(TOPIC_COUNTS):
    print("  " + topic + ": " + str(TOPIC_COUNTS[topic]))
print("Synthetic conversations: " + str(CONVERSATIONS))
print("Synthetic messages: " + str(conversation_messages))
print("Size: " + str(OUT.stat().st_size) + " bytes")
