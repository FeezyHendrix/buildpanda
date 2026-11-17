import type { MarketGuides } from "./types";

export const fr: MarketGuides = {
  NG: {
    description: "Choisir un logiciel de gestion de chantier au Nigeria : quantitatifs, révision des prix, preuves de terrain et suivi des paiements.",
    intro: "Évaluez le logiciel sur un projet nigérian réel, du devis quantitatif chiffré à la réception. L’entreprise, le métreur et le propriétaire à distance ont besoin d’un dossier commun, avec des droits distincts pour consulter les coûts, déclarer les travaux et approuver les modifications.",
    sections: [
      { heading: "Conserver le budget initial lorsque les prix évoluent", body: "Partez de votre quantitatif, des dates des offres fournisseurs et des prix contractuels. Testez une nouvelle offre sans écraser le devis accepté. Pour un marché public, consultez les documents types révisés du BPP et utilisez le contrat du projet comme référence pour le circuit de validation." },
      { heading: "Relier les preuves du chantier au rapport du propriétaire", body: "Sur un exemple de bâtiment à Lagos, suivez une livraison jusqu’au stock, au journal de chantier et à une inspection. Demandez ensuite au propriétaire de consulter l’avancement sans voir les prix confidentiels de l’entreprise. Chaque photo doit identifier les travaux et la date ; chaque paiement enregistré doit renvoyer aux travaux certifiés." },
    ],
    pilot: "Apportez un plan, dix lignes de quantitatif, une offre de matériaux révisée et un certificat de paiement. Remontez d’un avenant à son approbation et testez une saisie hors connexion avant la synchronisation.",
  },
  GH: {
    description: "Comparer les logiciels de chantier au Ghana à partir des dossiers de marché, des métrés, des livraisons et de la réception.",
    intro: "Pour une entreprise ghanéenne, un essai utile commence avec les documents que l’équipe utilise déjà. Reliez le périmètre du marché, les quantités mesurées et les rapports du chantier pour qu’une instruction révisée ne devienne pas un écart budgétaire inexpliqué.",
    sections: [
      { heading: "Adapter le dossier au lot de travaux", body: "La PPA du Ghana publie différents documents types pour les marchés de travaux. Lorsqu’un marché public est concerné, partez du dossier émis pour ce projet. Vérifiez que le périmètre initial, le quantitatif accepté et les instructions ultérieures restent identifiables, au lieu de considérer chaque fichier ajouté comme l’accord en vigueur." },
      { heading: "Rapprocher les livraisons avant de certifier les travaux", body: "Sur un exemple à Accra, enregistrez une commande, une livraison partielle et le solde attendu. Demandez au responsable de chantier et au métreur de rapprocher les mêmes quantités. Distinguez les matériaux reçus des travaux exécutés : un bon de livraison ne prouve pas qu’une activité de construction est terminée." },
    ],
    pilot: "Utilisez un lot de travaux, un bon de livraison incomplet et une situation intermédiaire. Suivez la résolution de l’écart, puis vérifiez que le client peut consulter la situation sans pouvoir la modifier.",
  },
  KE: {
    description: "Logiciel de chantier au Kenya : évaluer les dossiers du projet, les révisions des plans et le suivi des inspections.",
    intro: "Un projet kényan exige davantage qu’un tableau de tâches. Vérifiez comment le système relie les plans approuvés, les documents des intervenants et les travaux déclarés, tout en conservant l’auteur de chaque révision et de chaque réception.",
    sections: [
      { heading: "Préparer un dossier documentaire traçable", body: "La liste de contrôle d’enregistrement de la NCA mentionne notamment les plans, les justificatifs des professionnels et entreprises, un récapitulatif du quantitatif et les accords du projet. Utilisez la liste officielle à jour pour préparer votre dossier. Classer un document dans le logiciel ne vaut ni enregistrement ni approbation par l’autorité." },
      { heading: "Rattacher les inspections à la révision du plan", body: "Pour un exemple d’immeuble à Nairobi, diffusez un plan de structure révisé après une inspection. Vérifiez que l’inspection initiale reste liée à la version examinée et que le chantier identifie la nouvelle instruction. Un défaut non résolu doit conserver son responsable et l’historique du suivi." },
    ],
    pilot: "Apportez un plan approuvé, sa nouvelle version et une inspection signalant un défaut. Faites clôturer le problème avec ses preuves en conservant la décision initiale et la révision concernée.",
  },
  ZA: {
    description: "Évaluer un logiciel de construction en Afrique du Sud : sous-traitance, certificats et preuves de réalisation faciles à retrouver.",
    intro: "Pour une équipe sud-africaine, le logiciel doit permettre de retrouver les décisions du chantier comme le dossier final. Testez la traçabilité de l’attribution du lot jusqu’à son achèvement, au-delà du seul tableau de bord.",
    sections: [
      { heading: "Conserver les justificatifs des références de l’entreprise", body: "Les indications du cidb sur le classement citent notamment des documents d’attribution, d’achèvement et de paiement. Appuyez-vous sur cette ressource pour organiser les archives, puis testez la récupération des preuves d’un projet terminé. Le stockage documentaire ne constitue pas, à lui seul, un classement ni une vérification de l’enregistrement de l’entreprise." },
      { heading: "Distinguer avancement du sous-traitant et paiement", body: "Sur un exemple de rénovation à Johannesburg, mesurez un lot sous-traité, consignez un défaut et préparez une situation d’avancement. Le défaut restant, le montant certifié et le paiement enregistré doivent rester distincts. C’est le contrat qui détermine leurs effets sur le paiement, pas un pourcentage affiché au tableau de bord." },
    ],
    pilot: "Apportez une attribution de sous-traitance, un certificat intermédiaire et un justificatif d’achèvement. Retrouvez-les dans un même dossier et vérifiez que le sous-traitant ne voit pas les données commerciales des autres lots.",
  },
  MA: {
    description: "Logiciel de gestion de chantier au Maroc : dossiers d’appel d’offres, documents multilingues, instructions et rapports de terrain.",
    intro: "Pour évaluer un logiciel sur un projet marocain, suivez les documents d’origine du marché jusqu’au chantier. Convenez de la langue de travail et du classement des pièces avant l’essai, surtout si le propriétaire et l’équipe d’exécution utilisent des langues différentes.",
    sections: [
      { heading: "Distinguer dépôt officiel et dossier d’exécution", body: "Le Portail Marocain des Marchés Publics publie son propre guide d’utilisation. Lorsqu’il concerne votre marché, conservez les pièces émises et les preuves de dépôt avec le dossier contractuel. Un espace de gestion de chantier aide à suivre l’exécution ; il ne remplace pas la plateforme officielle de passation des marchés." },
      { heading: "Tester les documents réellement utilisés par l’équipe", body: "Utilisez un exemple d’aménagement à Casablanca avec des pièces en français ou en arabe, une prescription de finition révisée et une inspection. Vérifiez la lisibilité, les références et les exports pendant la démonstration. Une page commerciale traduite ne signifie pas que tous les écrans du produit, exports ou modèles contractuels existent dans cette langue." },
    ],
    pilot: "Apportez un descriptif dans sa langue d’origine, un plan révisé et une instruction à l’entreprise. Faites identifier la version en vigueur et produire un rapport d’inspection lisible par le propriétaire, sans perdre les références initiales.",
  },
  CM: {
    description: "Comparer les logiciels de chantier au Cameroun : références du marché, lots, pièces fournisseurs et contrôle des documents bilingues.",
    intro: "Pour une équipe camerounaise, commencez l’évaluation par un lot de travaux clairement défini. Reliez la référence du marché, les instructions du chantier et l’avancement mesuré pour que chaque rapport puisse être rattaché au lot concerné.",
    sections: [
      { heading: "Préserver la référence du marché public", body: "L’ARMP publie des avis de marchés publics et des informations associées. Pour un marché de travaux public, conservez l’avis pertinent et les pièces émises avec le contrat. Vérifiez que les instructions ultérieures gardent la référence du lot : un avis, une attribution et une instruction sont des pièces distinctes." },
      { heading: "Rapprocher les rapports de l’équipe d’exécution", body: "Sur un exemple de chantier à Douala, utilisez des pièces d’origine en anglais et en français. Demandez au responsable de rapprocher une livraison, un rapport journalier et une quantité mesurée pour le même lot. Testez les désignations, unités et exports avant de conclure que le produit répond aux besoins linguistiques de l’équipe." },
    ],
    pilot: "Apportez un descriptif de lot, un bon de livraison et une instruction révisée. Produisez un rapport d’avancement avec ses preuves, puis vérifiez que le réviseur ne peut approuver que les dossiers qui lui sont attribués.",
  },
};
