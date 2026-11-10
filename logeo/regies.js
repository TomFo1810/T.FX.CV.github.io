/* Formulaires de candidature des régies genevoises. Liens relevés sur le site de chaque régie le 10 novembre 2026.
   « motif » sert à reconnaître la régie dans le nom de l'annonceur. */
window.LOGEO_REGIES = [
  { nom: "Naef Immobilier", motif: "naef", page: "https://www.naef.ch/documents-utiles/", verifie: true, docs: [
    { t: "Demande de location, logements et garages", u: "https://www.naef.ch/wp-content/uploads/2026/06/Daq-016.pdf", k: "papier", n: "2 pages" },
    { t: "Formulaire logement subventionné", u: "https://www.naef.ch/wp-content/uploads/2026/03/Daq-017-1.pdf", k: "papier", n: "7 pages" },
    { t: "Compte E-Candidat", u: "https://e-location.naef.ch", k: "ligne" } ] },
  { nom: "Moser Vernet & Cie", motif: "moser|move properties", page: "https://www.moservernet.ch/services/aux-locataires/formulaires-dinscription/", verifie: true, docs: [
    { t: "Formulaire d'inscription, logement", u: "https://www.moservernet.ch/wp-content/uploads/2026/08/2025_Moser_Vernet_Formulaire_Logement_FR_v12RIL.pdf", k: "papier", n: "2 pages, existe aussi en allemand, anglais, espagnol et portugais" } ] },
  { nom: "Régimo Genève", motif: "regimo", page: "https://regimo-geneve.ch/services-aux-locataires", verifie: true, docs: [
    { t: "Demande de location, logement", u: "https://regimo-geneve.ch/fileadmin/user_upload/Demande_de_location_-_logement_-_GE.pdf", k: "ecran", n: "1 page, 70 champs à remplir à l'écran" } ] },
  { nom: "Bory & Cie", motif: "bory", page: "https://www.bory.ch/demande-de-location", docs: [
    { t: "Formulaire de location, appartement, villa, parking", u: "https://edit.bory.ch/app/uploads/2026/05/v3-Formulaire-location-appartement-villa-parking-2026-FR.pdf", k: "pdf" },
    { t: "Demande de logement subventionné", u: "https://edit.bory.ch/app/uploads/2020/07/Demande-logement-subventionné.pdf", k: "pdf" } ] },
  { nom: "Rosset & Cie", motif: "rosset", page: "https://www.rosset.ch/en/useful-documents", docs: [
    { t: "Formulaires de location (logement, subventionné, coopératives)", u: "https://www.rosset.ch/en/useful-documents", k: "page", n: "une quinzaine de formulaires selon l'immeuble" } ] },
  { nom: "Pilet & Renaud", motif: "pilet", page: "https://www.pilet-renaud.ch/en/rent/useful-documents", docs: [
    { t: "Demande de location, appartements", u: "https://www.pilet-renaud.ch/medias/ckfinder/files/Application%20for%20apartments.pdf", k: "pdf" } ] },
  { nom: "Régisseurs Associés", motif: "regisseurs associes", page: "https://www.regisseurs.ch/", docs: [
    { t: "Inscription en ligne", u: "https://inscription.regisseurs.ch", k: "ligne" } ] },
  { nom: "Gerofinance", motif: "gerofinance|regie du rhone", page: "https://www.gerofinance.ch/p3284-espace-candidats.html", docs: [
    { t: "Espace candidats", u: "https://www.gerofinance.ch/p3284-espace-candidats.html", k: "ligne" } ] }
];
