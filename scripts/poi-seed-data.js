// Contenu éditorial des 18 lieux "Explorer France" (epic #11), rédigé à partir de recherches web
// (sites officiels de tourisme, camping-car.com, park4night, generationvoyage, etc.) le 21/11/2026.
// Sert à générer le SQL d'insertion dans points_interet (voir scripts/generate-poi-sql.js).

module.exports = [
  {
    slug: 'annecy',
    name: 'Annecy',
    region: 'Auvergne-Rhône-Alpes',
    category: 'ville',
    lat: 45.8992, lon: 6.1294,
    description_courte: "La « Venise des Alpes », vieille ville à canaux au bord d'un lac parmi les plus purs d'Europe.",
    description_longue: "Annecy doit son surnom à son centre historique traversé de canaux, bordé de maisons colorées et dominé par le Palais de l'Isle et le château médiéval. Le lac d'Annecy, à deux pas, offre baignade, pédalos et un tour complet d'environ 30 km entre montagnes et villages. Les quais et le marché du centre ancien se prêtent à une balade à pied, incontournable mais compliquée en camping-car.",
    ambiance_tags: ['lac', 'montagne', 'baignade', 'romantique'],
    best_duration: '1 à 2 jours',
    best_season: 'Mai à septembre',
    practical_tips: "Se garer avec un camping-car dans ou aux abords du centre-ville d'Annecy est très compliqué : mieux vaut utiliser une aire dédiée en périphérie (comme celle de Colmyr, gratuite toute l'année) et rejoindre le centre à pied, vélo ou bus.",
    how_to_get_there: "Accès par l'A41 (sortie Annecy) ou l'A43 depuis Lyon/Chambéry. Gare TGV directe depuis Paris et Lyon.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Castle_of_Annecy_02.jpg', credit: 'Krzysztof Golik (Wikimedia Commons)', license: 'CC BY-SA 4.0' },
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Annecy-Semnoz_(2013).JPG', credit: 'Florian Pépellin (Wikimedia Commons)', license: 'CC BY-SA 3.0' }
    ]
  },
  {
    slug: 'mont-saint-michel',
    name: 'Mont-Saint-Michel',
    region: 'Normandie',
    category: 'monument',
    lat: 48.6361, lon: -1.5115,
    description_courte: "Îlot rocheux et abbaye médiévale emblématiques, cernés par les plus grandes marées d'Europe continentale.",
    description_longue: "Silhouette visible à des kilomètres, le Mont-Saint-Michel surgit de sa baie au gré des marées. L'abbaye perchée, les ruelles pentues et les remparts se visitent à pied depuis les grands parkings continentaux reliés par navette gratuite. Le site est un Grand Site de France inscrit à l'UNESCO, à ne pas confondre avec les parkings payants attenants.",
    ambiance_tags: ['patrimoine', 'marée', 'incontournable', 'famille'],
    best_duration: 'Demi-journée à 1 jour',
    best_season: 'Toute l\'année, idéalement hors juillet-août pour éviter l\'affluence',
    practical_tips: "Le stationnement sur le grand parking est payant mais le séjour nocturne y est toléré ; impossible en revanche d'y rester garé pendant la visite comme aire d'hébergement. Plusieurs aires et campings dédiés aux camping-cars existent à proximité (Beauvoir), avec navette gratuite vers le Mont.",
    how_to_get_there: "A84 puis D976 depuis Rennes ou Caen. Gare SNCF la plus proche : Pontorson, puis navette Midibus.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mont_Saint_Michel.jpg', credit: 'Eric Pouhier (Wikimedia Commons)', license: 'CC BY-SA 2.5' }
    ]
  },
  {
    slug: 'gouffre-de-padirac',
    name: 'Gouffre de Padirac',
    region: 'Occitanie',
    category: 'site naturel',
    lat: 44.8339, lon: 1.7406,
    description_courte: "Immense gouffre souterrain du Lot où l'on descend à 103 m de profondeur avant une balade en barque sur une rivière souterraine.",
    description_longue: "Découvert en 1889, le Gouffre de Padirac est le premier site souterrain naturel de France avec près de 500 000 visiteurs par an. La visite guidée combine marche, ascenseurs et une traversée en barque menée par un batelier sur la « rivière plane ». Un monde minéral spectaculaire, incontournable lors d'un passage dans la vallée de la Dordogne.",
    ambiance_tags: ['grotte', 'insolite', 'famille', 'fraîcheur'],
    best_duration: '2 à 3 heures',
    best_season: 'Avril à novembre (fermé l\'hiver)',
    practical_tips: "Parking gratuit dédié aux camping-cars (P2), mais stationnement nocturne interdit sur place (22h-8h) ; une aire de camping-car existe à Trémoulières, à 2 km. Arriver tôt en haute saison, la visite se fait par petits groupes toutes les 30 minutes.",
    how_to_get_there: "Par la D673 puis D90, à 30 min de Rocamadour et Brive-la-Gaillarde.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gouffre_de_Padirac.jpg', credit: 'Wikimedia Commons', license: 'licence libre' }
    ]
  },
  {
    slug: 'gorges-du-verdon',
    name: 'Gorges du Verdon',
    region: 'Provence-Alpes-Côte d\'Azur',
    category: 'site naturel',
    lat: 43.8434, lon: 6.2219,
    description_courte: "Le plus grand canyon d'Europe, aux eaux turquoise, bordé de deux routes panoramiques entre Castellane et Moustiers-Sainte-Marie.",
    description_longue: "Les Gorges du Verdon se parcourent par la route des Crêtes (rive droite) ou la Corniche Sublime (rive gauche), ponctuées de points de vue vertigineux. Canoë, baignade au lac de Sainte-Croix et randonnée complètent la découverte. Le village perché de Moustiers-Sainte-Marie, réputé pour sa faïence, en est la porte d'entrée la plus pittoresque.",
    ambiance_tags: ['canyon', 'randonnée', 'baignade', 'panorama'],
    best_duration: '2 à 4 jours',
    best_season: 'Mai à septembre',
    practical_tips: "Routes touristiques étroites et sinueuses : roulez lentement et partagez la chaussée avec cyclistes et motards. Castellane et Moustiers-Sainte-Marie disposent d'aires de services pour camping-cars ; prévoir les grands axes pour les véhicules les plus longs.",
    how_to_get_there: "Accès par Castellane (D952) ou Aups/Moustiers (D71-D952) depuis l'A51 (Marseille-Aix).",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Verdon_Gorge_Wikivoyage_Banner.jpg', credit: 'Benh Lieu Song (Wikimedia Commons)', license: 'CC BY-SA 3.0' }
    ]
  },
  {
    slug: 'saint-malo',
    name: 'Saint-Malo',
    region: 'Bretagne',
    category: 'ville',
    lat: 48.6494, lon: -2.0257,
    description_courte: "Cité corsaire fortifiée, ceinturée de remparts du XIVe siècle offrant un tour de ville face à la mer d'Émeraude.",
    description_longue: "Reconstruite après la Seconde Guerre mondiale à l'identique, la vieille ville intra-muros de Saint-Malo s'explore en suivant les remparts sur environ 2 km, du château à la Tour Bidouane puis au Bastion de la Hollande. La plage de Bon-Secours, en piscine d'eau de mer à marée basse, est un passage obligé juste en contrebas.",
    ambiance_tags: ['remparts', 'mer', 'histoire', 'corsaire'],
    best_duration: '1 journée',
    best_season: 'Avril à octobre',
    practical_tips: "Plusieurs aires de camping-car existent à l'entrée de la ville (parking Paul Féval, Les Ilots) avec navette ou bus vers l'intramuros ; éviter de chercher à se garer directement dans la cité historique.",
    how_to_get_there: "Par la RN137 depuis Rennes (1h) ou la D137 depuis Dinan.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/99_3550_Hafen_von_Saint-Malo,_Frankreich.jpg', credit: 'W. Bulach (Wikimedia Commons)', license: 'CC BY-SA 4.0' }
    ]
  },
  {
    slug: 'dune-du-pilat',
    name: 'Dune du Pilat',
    region: 'Nouvelle-Aquitaine',
    category: 'site naturel',
    lat: 44.5896, lon: -1.2156,
    description_courte: "La plus haute dune de sable d'Europe, à l'entrée du Bassin d'Arcachon, avec vue sur l'océan et la forêt landaise.",
    description_longue: "Culminant à plus de 100 mètres, la Dune du Pilat avance d'environ 5 mètres par an vers la forêt sous l'effet du vent. L'ascension, sans escalier mais sportive dans le sable, est récompensée par un panorama à 360° sur le Bassin d'Arcachon, le Banc d'Arguin et l'océan Atlantique. Un Grand Site de France protégé, accueillant près de 2 millions de visiteurs par an.",
    ambiance_tags: ['dune', 'océan', 'coucher de soleil', 'sport'],
    best_duration: '2 à 3 heures',
    best_season: 'Printemps et été pour la météo, hors juillet-août pour éviter la foule',
    practical_tips: "Stationnement camping-car payant (tarif spécifique plus élevé que les voitures) et interdit la nuit ; stationnement sauvage strictement prohibé aux abords (amende). Privilégier une arrivée matinale en haute saison, le parking sature vite.",
    how_to_get_there: "Par la D218 depuis Arcachon ou La Teste-de-Buch ; navette Dune Express en juillet-août.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sommet_de_la_Dune_du_Pilat.jpg', credit: 'Jörg Braukmann (Wikimedia Commons)', license: 'CC BY-SA 4.0' },
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/00_3029_Dune_du_Pilat_-_Frankreich.jpg', credit: 'W. Bulach (Wikimedia Commons)', license: 'CC BY-SA 4.0' }
    ]
  },
  {
    slug: 'colmar',
    name: 'Colmar',
    region: 'Grand Est',
    category: 'ville',
    lat: 48.0794, lon: 7.3585,
    description_courte: "Capitale des vins d'Alsace, célèbre pour son quartier de la Petite Venise aux maisons à colombages colorées.",
    description_longue: "Colmar enchante par ses canaux bordés de maisons à pans de bois fleuries, en particulier dans le quartier de la Petite Venise. Le musée Unterlinden, la vieille ville et la proximité de la route des vins d'Alsace en font une étape culturelle et gourmande. Les marchés de Noël, parmi les plus réputés de France, transforment la ville en décor féerique en fin d'année.",
    ambiance_tags: ['colombages', 'canaux', 'vin', 'romantique'],
    best_duration: '1 à 2 jours',
    best_season: 'Avril à octobre, ou décembre pour les marchés de Noël',
    practical_tips: "Aire de camping-car dédiée au port de plaisance de Colmar (environ 20 minutes à pied du centre historique), avec parc clôturé ; réserver tôt en période de marchés de Noël, l'affluence et les places limitées se font sentir.",
    how_to_get_there: "Sortie A35 \"Colmar\", à 30 min de Strasbourg et Mulhouse.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Petite_Venise_depuis_le_pont_de_la_rue_des_%C3%89coles_(Colmar)_(8).jpg', credit: 'Gzen92 (Wikimedia Commons)', license: 'CC BY-SA 4.0' },
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Little_Venice_in_Colmar_01.jpg', credit: 'Krzysztof Golik (Wikimedia Commons)', license: 'CC BY-SA 4.0' }
    ]
  },
  {
    slug: 'cirque-de-gavarnie',
    name: 'Cirque de Gavarnie',
    region: 'Occitanie',
    category: 'site naturel',
    lat: 42.6936, lon: -0.0094,
    description_courte: "Amphithéâtre naturel classé à l'UNESCO dans les Pyrénées, que Victor Hugo décrivait comme le « Colosseum de la nature ».",
    description_longue: "Depuis le village de Gavarnie, un sentier balisé de 2 à 2h30 de marche aller-retour, peu technique, mène au pied de la Grande Cascade, la plus haute d'Europe avec ses 417 mètres de chute. Les parois calcaires du cirque, hautes de 1500 mètres, dominent un paysage glaciaire exceptionnel, accessible aussi à cheval ou à dos d'âne en été.",
    ambiance_tags: ['montagne', 'randonnée', 'cascade', 'patrimoine UNESCO'],
    best_duration: 'Demi-journée (randonnée de 4 à 5h aller-retour)',
    best_season: 'Juin à octobre (itinéraire déconseillé en hiver et au printemps, risque d\'avalanches)',
    practical_tips: "Se garer au parking du village de Gavarnie (payant en saison) ; un bus dessert aussi le village depuis Lourdes en été. Partir tôt le matin pour profiter de la lumière, éviter la chaleur et devancer l'affluence de juillet-août.",
    how_to_get_there: "Par la D921 depuis Lourdes via Luz-Saint-Sauveur et Gèdre (environ 1h15).",
    popularity: 'moyenne', hidden_gem: true,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cirque_de_Gavarnie,_Haute-Pyr%C3%A9n%C3%A9es,_France.jpg', credit: 'Benh Lieu Song (Wikimedia Commons)', license: 'CC BY-SA 2.0' }
    ]
  },
  {
    slug: 'calanques-de-cassis',
    name: 'Calanques de Cassis',
    region: 'Provence-Alpes-Côte d\'Azur',
    category: 'site naturel',
    lat: 43.2140, lon: 5.5390,
    description_courte: "Criques d'eau turquoise encaissées entre falaises blanches, aux portes de Cassis et Marseille.",
    description_longue: "Port-Pin et En-Vau, accessibles à pied depuis Cassis (15 à 60 minutes de marche selon la calanque), offrent des eaux cristallines nichées entre pinèdes et parois calcaires. Le Parc national des Calanques, créé en 2012, protège un territoire classé parmi les plus fréquentés de France, avec plus de 3 millions de visiteurs par an.",
    ambiance_tags: ['mer', 'falaises', 'randonnée', 'baignade'],
    best_duration: 'Demi-journée à 1 jour',
    best_season: 'Mai à septembre, en dehors des pics de risque incendie',
    practical_tips: "Accès motorisé très réglementé et souvent fermé en été (du 1er juin au 30 septembre, arrêté préfectoral anti-incendie) : mieux vaut se garer à Cassis ou La Ciotat et marcher, certaines calanques (Sugiton) nécessitant même une réservation en ligne. Vérifier le niveau de risque incendie du jour avant de partir.",
    how_to_get_there: "Sortie \"Cassis\" sur l'A50 depuis Marseille ou Toulon ; gare SNCF de Cassis.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Calanque_de_Sormiou-Cassis.jpg', credit: 'Tobi 87 (Wikimedia Commons)', license: 'CC BY-SA 3.0' }
    ]
  },
  {
    slug: 'sarlat-la-caneda',
    name: 'Sarlat-la-Canéda',
    region: 'Nouvelle-Aquitaine',
    category: 'ville',
    lat: 44.8900, lon: 1.2160,
    description_courte: "Capitale du Périgord noir, cité médiévale à la plus forte densité de monuments historiques au monde.",
    description_longue: "Ruelles pavées, maisons à colombages et hôtels particuliers en pierre ocre composent le décor exceptionnellement préservé de Sarlat, souvent utilisé comme plateau de cinéma. Le marché couvert du samedi matin, haut lieu de la gastronomie périgourdine (foie gras, noix, cabécou), anime tout le centre ancien. Point de départ idéal pour la vallée de la Dordogne et ses châteaux.",
    ambiance_tags: ['médiéval', 'gastronomie', 'marché', 'patrimoine'],
    best_duration: '1 à 2 jours',
    best_season: 'Avril à octobre ; marché du samedi matin incontournable',
    practical_tips: "Aire de camping-car communale au centre, sur l'ancien camping municipal, à distance de marche du centre historique. La ville se visite entièrement à pied, prévoir de laisser le véhicule à l'aire dès l'arrivée.",
    how_to_get_there: "Par la D704 ou D703 ; gare SNCF de Sarlat-la-Canéda, aéroports de Brive et Bergerac à proximité.",
    popularity: 'moyenne', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Clocher_saint-Sacerdos_Sarlat.jpg', credit: 'Jebulon (Wikimedia Commons)', license: 'CC0' },
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sarlat_2008_24.jpg', credit: 'Manfred Heyde (Wikimedia Commons)', license: 'CC BY-SA 3.0' }
    ]
  },
  {
    slug: 'pointe-du-raz',
    name: 'Pointe du Raz',
    region: 'Bretagne',
    category: 'site naturel',
    lat: 48.0397, lon: -4.7339,
    description_courte: "Éperon rocheux à l'extrémité du Finistère, l'un des plus beaux sites naturels de Bretagne face au Raz de Sein.",
    description_longue: "Classée Grand Site de France, la Pointe du Raz offre un sentier côtier sur le GR34 jusqu'au sémaphore, avec vue sur le phare de la Vieille et l'île de Sein. Les falaises battues par les vents et les embruns en font un lieu de visite spectaculaire, surtout à la tombée du jour lors des visites crépusculaires organisées sur place.",
    ambiance_tags: ['falaises', 'mer', 'randonnée', 'coucher de soleil'],
    best_duration: '2 à 3 heures',
    best_season: 'Toute l\'année, idéal au printemps et en été pour la lumière du soir',
    practical_tips: "Stationnement payant toute l'année en haute saison (environ 8€/jour, tarif identique voitures et camping-cars), compter 20 minutes de marche depuis le parking jusqu'à la pointe. Une navette relie en été la Pointe du Raz à la Pointe du Van.",
    how_to_get_there: "Par la D784 puis D8 depuis Audierne ou Douarnenez.",
    popularity: 'moyenne', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/PointDuRaz_DSC00375_PtrQs.jpg', credit: 'PtrQs (Wikimedia Commons)', license: 'CC BY-SA 4.0' }
    ]
  },
  {
    slug: 'gorges-de-lardeche',
    name: 'Gorges de l\'Ardèche',
    region: 'Auvergne-Rhône-Alpes',
    category: 'site naturel',
    lat: 44.4057, lon: 4.3968,
    description_courte: "Canyon calcaire de plus de 30 km creusé par la rivière Ardèche, célèbre pour son arche naturelle du Pont d'Arc.",
    description_longue: "La route touristique des Gorges de l'Ardèche (D290), classée réserve naturelle nationale, serpente entre points de vue vertigineux depuis Vallon-Pont-d'Arc jusqu'à Saint-Martin-d'Ardèche. Le Pont d'Arc, arche naturelle sculptée par la rivière, marque l'entrée du site et se découvre aussi en canoë. Spots de baignade réputés à Balazuc et Vogüé.",
    ambiance_tags: ['canyon', 'canoë', 'baignade', 'panorama'],
    best_duration: '1 à 2 jours',
    best_season: 'Mai à octobre',
    practical_tips: "La route touristique se conduit aussi en camping-car mais certains passages restent délicats pour les grands véhicules : rouler prudemment. Camping sauvage interdit dans la réserve naturelle, seul le bivouac minimaliste y est toléré ; plusieurs aires de service existent à Vallon-Pont-d'Arc.",
    how_to_get_there: "Par la D579 ou D104 depuis Montélimar ou Aubenas.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/GorgesArdeche.jpg', credit: 'Modano (Wikimedia Commons)', license: 'CC BY-SA 2.5' }
    ]
  },
  {
    slug: 'collioure',
    name: 'Collioure',
    region: 'Occitanie',
    category: 'ville',
    lat: 42.5256, lon: 3.0836,
    description_courte: "Village catalan haut en couleurs sur la Côte Vermeille, qui inspira Matisse et Derain au début du XXe siècle.",
    description_longue: "Dominé par son château royal et son clocher planté dans la mer, Collioure déroule ses ruelles pastel et ses barques catalanes colorées le long d'une petite baie méditerranéenne. Le village, berceau du fauvisme, a conservé l'ambiance qui a séduit les peintres, entre criques de galets et anchois artisanaux.",
    ambiance_tags: ['méditerranée', 'village catalan', 'art', 'plage'],
    best_duration: '1 journée',
    best_season: 'Mai à octobre',
    practical_tips: "Stationnement en centre-ville interdit aux camping-cars (barrières) : direction l'aire municipale du Cap Dourats, à environ 2 km du centre, reliée par navette gratuite en été. Prévoir l'affluence estivale, le village est très fréquenté en juillet-août.",
    how_to_get_there: "Sortie 14 \"Collioure\" depuis l'A9 au sud de Perpignan.",
    popularity: 'moyenne', hidden_gem: true,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Collioure_windmill_fort_saint-elme.jpg', credit: 'Palauenc05 (Wikimedia Commons)', license: 'CC BY-SA 4.0' },
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/%C3%89glise_Notre-Dame-des-Anges_de_Collioure_6.jpg', credit: 'Fildefer (Wikimedia Commons)', license: 'CC BY-SA 3.0' }
    ]
  },
  {
    slug: 'puy-de-dome',
    name: 'Puy de Dôme',
    region: 'Auvergne-Rhône-Alpes',
    category: 'site naturel',
    lat: 45.7722, lon: 2.9657,
    description_courte: "Volcan emblématique de la chaîne des Puys, seul site du patrimoine mondial UNESCO accessible à tous via un train à crémaillère.",
    description_longue: "Culminant à 1465 mètres, le Puy de Dôme se gravit en 15 minutes à bord du Panoramique des Dômes, un train électrique à crémaillère entièrement accessible, ou à pied par le chemin des Muletiers pour les plus sportifs. Au sommet, un panorama à 360° embrasse la chaîne des Puys, classée à l'UNESCO parmi les 80 volcans du monde, ainsi que les vestiges d'un temple gallo-romain dédié à Mercure.",
    ambiance_tags: ['volcan', 'panorama', 'randonnée', 'patrimoine UNESCO'],
    best_duration: 'Demi-journée',
    best_season: 'Avril à octobre (le train fonctionne toute l\'année, conditions hivernales variables)',
    practical_tips: "Grand parking au pied du site (gare de la Font de l'Arbre) adapté aux camping-cars ; réserver son billet de train à l'avance en haute saison, l'affluence est importante l'été.",
    how_to_get_there: "Par la D941A ou D68 depuis Clermont-Ferrand (environ 15 km).",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Volcanoes_in_Auvergne_France_2010.jpg', credit: 'zarmel (Wikimedia Commons)', license: 'CC BY-SA 3.0' }
    ]
  },
  {
    slug: 'etretat',
    name: 'Étretat',
    region: 'Normandie',
    category: 'site naturel',
    lat: 49.7075, lon: 0.2044,
    description_courte: "Falaises de craie blanche et arches naturelles spectaculaires sur la Côte d'Albâtre, immortalisées par Monet et Maupassant.",
    description_longue: "Les trois arches naturelles d'Étretat (Amont, Aval, Manneporte) et l'aiguille de craie qui les accompagne forment l'un des paysages côtiers les plus photographiés de France. Des sentiers sur les falaises, de part et d'autre de la plage de galets, offrent des points de vue vertigineux sur la Manche. La maison d'Arsène Lupin et le centre-ville complètent la visite.",
    ambiance_tags: ['falaises', 'mer', 'randonnée', 'peinture impressionniste'],
    best_duration: 'Demi-journée à 1 jour',
    best_season: 'Avril à octobre',
    practical_tips: "Aire de camping-car payante juste à l'entrée de la ville, à 1,5 km des falaises (environ 15 minutes à pied) ; prévoir d'arriver tôt le matin en été, les parkings du centre saturent vite et les emplacements sur l'aire se remplissent rapidement.",
    how_to_get_there: "Par la D940 depuis Le Havre (30 min) ou Fécamp.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/L%27Aiguille_et_la_Porte_d%27Aval-Etretat-Normandie.jpg', credit: 'Tobi 87 (Wikimedia Commons)', license: 'CC BY-SA 3.0' },
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Porte_d%27Aval_(Vue_depuis_la_Manneporte).jpg', credit: 'Jörg Braukmann (Wikimedia Commons)', license: 'CC BY-SA' }
    ]
  },
  {
    slug: 'roussillon-sentier-des-ocres',
    name: 'Roussillon et le Sentier des Ocres',
    region: 'Provence-Alpes-Côte d\'Azur',
    category: 'site naturel',
    lat: 43.9018, lon: 5.2946,
    description_courte: "Village perché classé parmi les Plus Beaux Villages de France, au-dessus d'un ancien gisement d'ocre aux couleurs flamboyantes.",
    description_longue: "Les façades du village de Roussillon déclinent toute la palette des ocres locales, du jaune pâle au rouge profond. En contrebas, le Sentier des Ocres serpente dans d'anciennes carrières à ciel ouvert, entre falaises minérales et pins, sur un parcours aménagé de passerelles et belvédères. L'écomusée Ôkhra, à proximité, raconte l'histoire industrielle du site.",
    ambiance_tags: ['village perché', 'géologie', 'randonnée', 'couleurs'],
    best_duration: '2 à 3 heures',
    best_season: 'Toute l\'année, lumière la plus spectaculaire en fin de journée',
    practical_tips: "Le sentier compte environ 350 marches et n'est pas adapté aux poussettes ni aux personnes à mobilité réduite ; plusieurs parkings (dont un pour cars) existent au village et sur le site, entrée payante réglée sur place.",
    how_to_get_there: "Par la D105 depuis Apt (environ 10 km), au cœur du Luberon.",
    popularity: 'moyenne', hidden_gem: true,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ochre_quarry,_Roussillon,_France_(465185258).jpg', credit: 'Fulvio Spada (Wikimedia Commons)', license: 'CC BY-SA 2.0' }
    ]
  },
  {
    slug: 'baie-de-somme',
    name: 'Baie de Somme',
    region: 'Hauts-de-France',
    category: 'site naturel',
    lat: 50.1853, lon: 1.6356,
    description_courte: "Vaste estuaire classé parmi les plus belles baies du monde, où l'on observe des colonies de phoques sauvages au fil des marées.",
    description_longue: "Entre Saint-Valery-sur-Somme, Le Crotoy et la Pointe du Hourdel, la Baie de Somme déroule 70 km² de vasières, prés salés et bancs de sable où se reposent phoques veaux-marins et gris. La traversée guidée de la baie à marée basse, le Parc du Marquenterre pour l'observation ornithologique et le petit train à vapeur comptent parmi les incontournables.",
    ambiance_tags: ['nature', 'phoques', 'marée', 'oiseaux'],
    best_duration: '1 à 2 jours',
    best_season: 'Toute l\'année, l\'automne pour la pêche à pied et les migrations d\'oiseaux',
    practical_tips: "Tout se cale sur les horaires de marée (coefficients parmi les plus élevés d'Europe) : vérifier les horaires avant de planifier la journée, en particulier pour l'observation des phoques à la Pointe du Hourdel, visibles surtout à marée descendante. Garder ses distances, l'approche des phoques est interdite.",
    how_to_get_there: "Par la D940 ou D3 depuis Abbeville ; aire de camping-car à Saint-Valery-sur-Somme et au Crotoy.",
    popularity: 'moyenne', hidden_gem: true,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Baie_de_Somme_-_near_Noyelles-sur-Mer-3334-36.jpg', credit: 'Raimond Spekking (Wikimedia Commons)', license: 'CC BY-SA 4.0' },
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Saint-Valery-sur-Somme.jpg', credit: 'Troye Owens (Wikimedia Commons)', license: 'CC BY-SA 2.0' }
    ]
  },
  {
    slug: 'gorges-du-tarn',
    name: 'Gorges du Tarn',
    region: 'Occitanie',
    category: 'site naturel',
    lat: 44.3614, lon: 3.4214,
    description_courte: "Canyon creusé par le Tarn entre les Causses, bordé de villages médiévaux et de falaises propices à la baignade et au canoë.",
    description_longue: "De Florac au Rozier, la route des Gorges du Tarn longe la rivière au pied de falaises calcaires impressionnantes, ponctuée de villages comme Sainte-Énimie ou La Malène. En été, les eaux du Tarn se prêtent à la baignade et au canoë, tandis que les Causses environnants offrent des panoramas typiques des grands espaces du Sud-Massif Central.",
    ambiance_tags: ['canyon', 'rivière', 'baignade', 'villages médiévaux'],
    best_duration: '2 à 3 jours',
    best_season: 'Juin à septembre (crues possibles le reste de l\'année, \"épisodes cévenols\")',
    practical_tips: "Routes étroites et sinueuses au cœur des gorges, circulation parfois difficile pour les plus grands véhicules en pleine saison ; de nombreux campings bord de rivière entre Sainte-Énimie et Florac accueillent les camping-cars.",
    how_to_get_there: "Sortie \"Gorges du Tarn\" sur l'A75 à Aguessac, puis D907.",
    popularity: 'moyenne', hidden_gem: true,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Point_Sublime-Gorges_du_Tarn-Frankreich.jpg', credit: 'Tobi 87 (Wikimedia Commons)', license: 'CC BY-SA 3.0' },
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Castelbouc_Gorges_du_Tarn.jpg', credit: 'Myrabella (Wikimedia Commons)', license: 'CC BY-SA' }
    ]
  },
  // --- 8 lieux supplémentaires ajoutés le 21/11/2026, pour enrichir la couverture régionale ---
  {
    slug: 'chaos-de-huelgoat',
    name: 'Chaos de Huelgoat',
    region: 'Bretagne',
    category: 'site naturel',
    lat: 48.3650, lon: -3.7436,
    description_courte: "Forêt bretonne envahie de rochers de granite géants, de légendes arthuriennes et d'une rivière qui disparaît sous terre.",
    description_longue: "Au cœur des Monts d'Arrée, la rivière de l'Argent cascade entre des centaines de blocs de granite entassés par l'érosion, un chaos qui a nourri tout un folklore local (grotte du Diable, Roche Tremblante). Le camp d'Artus, ancien refuge fortifié gaulois, complète ce site aussi mystérieux qu'accessible à pied, bien différent des grands sites naturels du littoral breton.",
    ambiance_tags: ['forêt', 'randonnée', 'légendes', 'insolite'],
    best_duration: 'Demi-journée',
    best_season: 'Printemps à automne',
    practical_tips: "Se garer sur le grand parking du centre-bourg, accessible aux camping-cars, puis explorer à pied ; sentiers assez techniques (racines, rochers humides), prévoir de bonnes chaussures.",
    how_to_get_there: "À environ 30 minutes de route de Morlaix ou de Carhaix, en plein centre du Finistère.",
    popularity: 'faible', hidden_gem: true,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rochers_en_for%C3%AAt_de_Huelgoat2.jpg', credit: 'Wikimedia Commons', license: 'licence libre' }
    ]
  },
  {
    slug: 'riquewihr',
    name: 'Riquewihr',
    region: 'Grand Est',
    category: 'ville',
    lat: 48.1672, lon: 7.2978,
    description_courte: "Village à remparts figé au XVIe siècle, capitale historique du vin d'Alsace sur la Route des Vins.",
    description_longue: "Ancienne possession des ducs de Wurtemberg, Riquewihr a traversé les siècles presque intact, protégé par ses fortifications médiévales et épargné par les bombardements de la Seconde Guerre mondiale. Classé parmi Les Plus Beaux Villages de France, il déroule ses maisons à colombages penchées, sa tour du Dolder et ses caves à riesling, à quelques kilomètres de Colmar.",
    ambiance_tags: ['village médiéval', 'vin', 'architecture', 'romantique'],
    best_duration: 'Demi-journée à 1 jour',
    best_season: 'Printemps à automne (marchés de Noël en décembre, très fréquentés)',
    practical_tips: "Les camping-cars ne peuvent pas entrer dans le village : se garer sur les parkings dédiés en périphérie et marcher quelques minutes. Éviter le cœur de l'été et les week-ends de marché de Noël, très saturés.",
    how_to_get_there: "À environ 11 km au nord de Colmar par la route des Vins d'Alsace.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Riquewihr,_relief_2.jpg', credit: 'Fiore Silvestro Barbato (Wikimedia Commons)', license: 'CC BY-SA 2.0' }
    ]
  },
  {
    slug: 'chateau-de-montsegur',
    name: 'Château de Montségur',
    region: 'Occitanie',
    category: 'monument',
    lat: 42.8722, lon: 1.8342,
    description_courte: "Le « pog » cathare le plus célèbre de France, perché à plus de 1200 m au-dessus de la vallée ariégeoise.",
    description_longue: "Assiégés en 1243-1244 par les troupes royales, les cathares de Montségur finirent par se rendre : plus de 200 d'entre eux furent brûlés au pied du piton rocheux pour avoir refusé d'abjurer leur foi, faisant de ce lieu l'un des sites de mémoire les plus chargés d'histoire du Sud-Ouest. La montée, courte mais raide, offre un panorama circulaire sur les Pyrénées ariégeoises.",
    ambiance_tags: ['histoire', 'randonnée', 'panorama', 'cathares'],
    best_duration: 'Demi-journée',
    best_season: 'Printemps à automne',
    practical_tips: "Parking au village, puis 30-40 minutes de montée assez raide et pierreuse ; prévoir de bonnes chaussures et éviter en cas de pluie (sentier glissant).",
    how_to_get_there: "À environ 1h de route de Foix, dans les Pyrénées ariégeoises.",
    popularity: 'moyenne', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Montsegur.p%C3%B2g1.jpg', credit: 'Wikimedia Commons', license: 'licence libre' }
    ]
  },
  {
    slug: 'lac-de-serre-poncon',
    name: 'Lac de Serre-Ponçon',
    region: 'Provence-Alpes-Côte d\'Azur',
    category: 'site naturel',
    lat: 44.5273, lon: 6.3811,
    description_courte: "La « mer des Alpes », immense lac artificiel aux eaux turquoise encadré de sommets alpins.",
    description_longue: "Créé par un barrage sur la Durance pour l'eau et l'électricité, ce lac est aujourd'hui l'un des plus grands plans d'eau artificiels d'Europe. Ses eaux d'un bleu intense, bordées de plages et de criques, en font un spot prisé pour la voile, le paddle et la baignade en été, avec en toile de fond les sommets du massif des Écrins. Le village de Savines-le-Lac, englouti puis reconstruit sur la rive, raconte l'histoire singulière du site.",
    ambiance_tags: ['lac', 'montagne', 'nautisme', 'panorama'],
    best_duration: '1 à 2 jours',
    best_season: 'Juin à septembre',
    practical_tips: "De nombreuses aires et campings pour camping-cars existent tout autour du lac (Savines-le-Lac, Embrun, Chorges) ; réserver en haute saison, les emplacements se remplissent vite en juillet-août.",
    how_to_get_there: "Entre Gap et Embrun, sur l'axe des Hautes-Alpes.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Vue_du_lac_de_Serre-Pon%C3%A7on_et_du_pont_de_Savines_(depuis_Savines-le-Lac).jpg', credit: 'Wikimedia Commons', license: 'licence libre' }
    ]
  },
  {
    slug: 'bonifacio',
    name: 'Bonifacio',
    region: 'Corse',
    category: 'ville',
    lat: 41.3870, lon: 9.1570,
    description_courte: "Citadelle blanche suspendue à pic sur des falaises calcaires, à la pointe sud de la Corse.",
    description_longue: "Bâtie sur un éperon calcaire dominant la Méditerranée, la ville haute de Bonifacio surplombe un port naturel encaissé où se mêlent bateaux de pêche et voiliers. Les ruelles fortifiées, l'escalier du Roi d'Aragon taillé dans la roche et les falaises blanches battues par le vent en font l'une des étapes les plus spectaculaires du littoral corse.",
    ambiance_tags: ['falaises', 'mer', 'citadelle', 'panorama'],
    best_duration: '1 à 2 jours',
    best_season: 'Mai à octobre (éviter le cœur de l\'été, très fréquenté)',
    practical_tips: "Le stationnement en centre-ville est très limité pour les camping-cars : privilégier les parkings dédiés à l'entrée de la ville et terminer à pied. Les ruelles de la vieille ville sont étroites et escarpées.",
    how_to_get_there: "À l'extrémité sud de la Corse, à environ 1h30 de route d'Ajaccio ou de Porto-Vecchio.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bonifacio_falaises_escalier_roi_Aragon.jpg', credit: 'Myrabella (Wikimedia Commons)', license: 'CC BY-SA 3.0' }
    ]
  },
  {
    slug: 'honfleur',
    name: 'Honfleur',
    region: 'Normandie',
    category: 'ville',
    lat: 49.4197, lon: 0.2336,
    description_courte: "Port historique normand aux maisons hautes et étroites, qui a inspiré les peintres impressionnistes.",
    description_longue: "Blotti autour du Vieux Bassin, Honfleur a conservé son caractère de port de pêche et de commerce, avec ses façades à colombages ou en ardoise reflétées dans l'eau. La lumière particulière de l'estuaire de la Seine a attiré de nombreux peintres au XIXe siècle, de Monet à Boudin, natif de la ville. L'église Sainte-Catherine, entièrement construite en bois par des charpentiers de marine, complète ce décor photogénique.",
    ambiance_tags: ['port', 'charme', 'art', 'gastronomie'],
    best_duration: '1 journée',
    best_season: 'Toute l\'année, hors week-ends très chargés en été',
    practical_tips: "Aire de camping-car disponible en périphérie du centre historique ; le Vieux Bassin et ses ruelles se visitent à pied, très animés et bondés les week-ends d'été.",
    how_to_get_there: "À l'embouchure de la Seine, à environ 15 minutes du pont de Normandie.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Honfleur_F_PM_030511.jpg', credit: 'Paul M.R. Maeyaert (Wikimedia Commons)', license: 'CC BY-SA 4.0' }
    ]
  },
  {
    slug: 'chateau-de-chambord',
    name: 'Château de Chambord',
    region: 'Centre-Val de Loire',
    category: 'monument',
    lat: 47.6163, lon: 1.5170,
    description_courte: "Le plus grand des châteaux de la Loire, chef-d'œuvre de la Renaissance voulu par François Ier.",
    description_longue: "Construit de 1519 à 1547, Chambord doit son plan à Domenico da Cortona, même si certains attribuent à Léonard de Vinci la conception de son escalier à double révolution, qui permet à deux personnes de monter et descendre sans jamais se croiser. Le château est entouré d'un parc boisé de plus de 5000 hectares, peuplé de cerfs et ceint d'un mur de 31 km, offrant un cadre naturel immense autour de ce décor architectural unique au monde.",
    ambiance_tags: ['château', 'Renaissance', 'architecture', 'parc'],
    best_duration: 'Demi-journée',
    best_season: 'Printemps à automne',
    practical_tips: "Grand parking visiteurs adapté aux camping-cars à l'entrée du domaine ; arriver tôt le matin pour éviter l'afflux de cars touristiques en milieu de journée.",
    how_to_get_there: "À environ 15 km à l'est de Blois, dans le Val de Loire.",
    popularity: 'forte', hidden_gem: false,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Chambord_Castle_Northwest_facade.jpg', credit: 'Benh Lieu Song (Wikimedia Commons)', license: 'CC BY-SA 3.0' }
    ]
  },
  {
    slug: 'cascades-du-herisson',
    name: 'Cascades du Hérisson',
    region: 'Bourgogne-Franche-Comté',
    category: 'site naturel',
    lat: 46.6550, lon: 5.8333,
    description_courte: "Série de 31 cascades successives dévalant une vallée encaissée du Haut-Jura, loin de la foule.",
    description_longue: "Le torrent du Hérisson, qui prend sa source dans les lacs d'Ilay et de Bonlieu, a longtemps fait tourner moulins et forges. Aujourd'hui, un sentier forestier permet de longer ses chutes successives, dont l'Éventail et le Grand Saut, dans une ambiance de forêt profonde bien moins fréquentée que les grands canyons alpins.",
    ambiance_tags: ['cascades', 'randonnée', 'forêt', 'nature préservée'],
    best_duration: 'Demi-journée',
    best_season: 'Mars à juin et septembre à novembre (débit plus faible en été)',
    practical_tips: "Plusieurs parkings jalonnent le parcours (Maison des Cascades, Ilay, Bonlieu) ; le sentier complet est assez exigeant (dénivelé, terrain glissant par endroits), prévoir de bonnes chaussures.",
    how_to_get_there: "Dans le Haut-Jura, entre Doucier et Ilay, à environ 30 minutes de Lons-le-Saunier.",
    popularity: 'faible', hidden_gem: true,
    photos: [
      { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cascade_du_h%C3%A9risson_Jura_France.JPG', credit: 'Wikimedia Commons', license: 'licence libre' }
    ]
  }
];
