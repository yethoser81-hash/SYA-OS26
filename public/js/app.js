const modules = {
  boutique: {
    name: "Boutique",
    icon: "🛍",
    description:
      "Gestion complète d'une activité de commerce de détail.",
    url: "/modules/boutique",
  },

  supermarket: {
    name: "Supermarché",
    icon: "🛒",
    description:
      "Gestion des ventes, rayons, stocks, caisses et opérations du supermarché.",
    url: "/modules/supermarket",
  },

  wholesale: {
    name: "Grossiste",
    icon: "📦",
    description:
      "Gestion des achats, stocks, ventes en volume et distribution.",
    url: "/modules/wholesale",
  },

  microfinance: {
    name: "Microfinance",
    icon: "◉",
    description:
      "Gestion des clients, opérations, crédits, remboursements et portefeuille.",
    url: "/modules/microfinance",
  },

  enterprise: {
    name: "Entreprise",
    icon: "▦",
    description:
      "Pilotage global des activités, finances, opérations et ressources.",
    url: "/modules/enterprise",
  },
};


const searchInput =
  document.getElementById("moduleSearch");

const dropdown =
  document.getElementById("moduleDropdown");

const noResults =
  document.getElementById("noResults");

const previewIcon =
  document.getElementById("previewIcon");

const previewTitle =
  document.getElementById("previewTitle");

const previewDescription =
  document.getElementById("previewDescription");

const accessButton =
  document.getElementById("accessModule");


let selectedModule = null;


function selectModule(key) {

  const module = modules[key];

  if (!module) {
    return;
  }

  selectedModule = key;

  searchInput.value = module.name;

  previewIcon.textContent = module.icon;

  previewTitle.textContent = module.name;

  previewDescription.textContent =
    module.description;

  accessButton.disabled = false;

  dropdown.classList.remove("open");

  noResults.style.display = "none";
}


function filterModules() {

  const query =
    searchInput.value
      .trim()
      .toLowerCase();

  const options =
    dropdown.querySelectorAll(
      ".module-option",
    );

  let visible = 0;

  options.forEach((option) => {

    const key =
      option.dataset.module;

    const module =
      modules[key];

    const searchable =
      `${module.name} ${module.description}`
        .toLowerCase();

    const match =
      !query ||
      searchable.includes(query);

    option.style.display =
      match ? "flex" : "none";

    if (match) {
      visible++;
    }
  });


  dropdown.classList.add("open");

  noResults.style.display =
    visible === 0
      ? "block"
      : "none";

  /*
   * Si l'utilisateur modifie le texte,
   * on retire l'environnement précédemment sélectionné.
   */
  if (
    selectedModule &&
    searchInput.value !==
      modules[selectedModule].name
  ) {
    selectedModule = null;

    accessButton.disabled = true;

    previewIcon.textContent = "SYA";

    previewTitle.textContent =
      "Sélectionnez votre activité";

    previewDescription.textContent =
      "Recherchez ou sélectionnez un environnement dans le champ ci-dessus.";
  }
}


document
  .querySelectorAll(".module-option")
  .forEach((option) => {

    option.addEventListener(
      "click",
      () => {

        selectModule(
          option.dataset.module,
        );

      },
    );

  });


searchInput.addEventListener(
  "focus",
  () => {

    filterModules();

  },
);


searchInput.addEventListener(
  "input",
  () => {

    filterModules();

  },
);


document.addEventListener(
  "click",
  (event) => {

    if (
      !event.target.closest(
        ".module-search",
      ) &&
      !event.target.closest(
        ".module-dropdown",
      )
    ) {
      dropdown.classList.remove(
        "open",
      );
    }

  },
);


accessButton.addEventListener(
  "click",
  () => {

    if (!selectedModule) {
      return;
    }

    const module =
      modules[selectedModule];

    window.location.href =
      module.url;

  },
);


/*
 * Raccourci clavier "/"
 */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "/" &&
      document.activeElement !==
        searchInput
    ) {

      event.preventDefault();

      searchInput.focus();

    }

  },
);


/*
 * Langue — conservation du choix.
 *
 * La vraie couche i18n sera ensuite
 * branchée sur le Core SYA.
 */

const languageSelect =
  document.getElementById(
    "languageSelect",
  );

const savedLanguage =
  localStorage.getItem(
    "sya-language",
  );

if (savedLanguage) {
  languageSelect.value =
    savedLanguage;
}

languageSelect.addEventListener(
  "change",
  () => {

    localStorage.setItem(
      "sya-language",
      languageSelect.value,
    );

  },
);