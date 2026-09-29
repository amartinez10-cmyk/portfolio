/*
 * Textos del portfolio en los tres idiomas.
 * Para cambiar o añadir un texto: edita la misma clave en "ca", "en" y "es",
 * y en el HTML pon data-i18n="clave" en el elemento.
 *
 * Las habilidades ("skills.hard" y "skills.soft") son listas: para añadir,
 * quitar o cambiar una, hazlo en los tres idiomas. La página se actualiza sola.
 */
window.TRANSLATIONS = {
  ca: {
    "meta.title": "Portfolio de l'Alex",
    "meta.description": "Portfolio de l'Alex, Tècnic en Sistemes Microinformàtics i Xarxes.",
    "nav.label": "Seccions",
    "lang.label": "Idioma",
    "bg.pause": "Pausa el fons",
    "bg.play": "Reprodueix el fons",

    "nav.about": "Sobre mi",
    "nav.resume": "Currículum",
    "nav.certificates": "Certificats",
    "nav.projects": "Projectes",
    "nav.hhep": "7 HHEP",
    "nav.contact": "Contacte",

    "about.photoAlt": "Retrat de l'Alex",
    "about.greeting": "Hola, sóc l'Alex.",
    "about.role": "Tècnic en Sistemes Microinformàtics i Xarxes",
    "about.p1": "Actualment estudio SMX a Sa Palomera, i en aquest portfolio vaig recollint el que aprenc pel camí.",
    "about.p2": "M'interessa sobretot la Intel·ligència Artificial, i gaudeixo de la feina que em permet resoldre problemes reals i veure'n el resultat. Fora de classe dedico el meu temps a entrenar i a aprendre habilitats d'alt valor.",

    "skills.hardTitle": "Habilitats tècniques",
    "skills.hard": [
      "Muntatge i reparació d'ordinadors",
      "Windows i Linux",
      "Windows Server: Active Directory, DNS i DHCP",
      "Xarxes locals",
      "Màquines virtuals",
      "Seguretat informàtica",
      "HTML, CSS i JavaScript",
      "Eines d'IA"
    ],
    "skills.softTitle": "Habilitats personals",
    "skills.soft": [
      "Resolució de problemes",
      "Ganes d'aprendre",
      "Disciplina i constància",
      "Autonomia",
      "Treball en equip",
      "Comunicació"
    ],

    "boot.status": "Carregant el portfolio…",
    "boot.skip": "Saltar",
    "boot.l1": "Iniciant nucli",
    "boot.l2": "Comprovant maquinari",
    "boot.l3": "Muntant mòduls 3D",
    "boot.l4": "Compilant shaders",
    "boot.l5": "Carregant habilitats",
    "boot.l6": "Xifrant connexió",
    "boot.user": "usuari: convidat",
    "boot.ok": "OK",
    "boot.omitted": "OMÈS",
    "boot.granted": "ACCÉS CONCEDIT",

    "stage.label": "Model 3D interactiu d'un ordinador de torre amb les meves habilitats tècniques al voltant. Es gira amb el ratolí, el dit o les fletxes del teclat.",
    "stage.hint": "Arrossega per girar · Passa el cursor per les peces i els nodes",
    "stage.hintTouch": "Arrossega per girar · Toca les peces i els nodes",
    "pc.gpu": "Targeta gràfica",
    "pc.cooler": "Refrigeració líquida",
    "pc.ram": "Memòria RAM",
    "pc.board": "Placa base",
    "pc.psu": "Font d'alimentació",
    "pc.fans": "Ventiladors RGB",

    "resume.body": "Aviat hi trobaràs el meu currículum.",
    "certificates.body": "Aquí aniré afegint els certificats que obtingui.",
    "projects.body": "Aquí aniré publicant els projectes que faci a classe i pel meu compte.",
    "hhep.body": "Contingut en preparació.",
    "contact.body": "Aviat hi afegiré les meves dades de contacte."
  },

  en: {
    "meta.title": "Alex's portfolio",
    "meta.description": "Portfolio of Alex, Technician in Microcomputer Systems and Networks.",
    "nav.label": "Sections",
    "lang.label": "Language",
    "bg.pause": "Pause background",
    "bg.play": "Play background",

    "nav.about": "About me",
    "nav.resume": "Resume",
    "nav.certificates": "Certificates",
    "nav.projects": "Projects",
    "nav.hhep": "7 HHEP",
    "nav.contact": "Contact",

    "about.photoAlt": "Portrait of Alex",
    "about.greeting": "Hi, I'm Alex.",
    "about.role": "Technician in Microcomputer Systems and Networks",
    "about.p1": "I'm currently studying SMX at Sa Palomera, and this portfolio is where I collect what I learn along the way.",
    "about.p2": "I'm especially interested in Artificial Intelligence, and I enjoy work that lets me solve real problems and see the results. Outside of class, I spend my time training and learning high-value skills.",

    "skills.hardTitle": "Hard skills",
    "skills.hard": [
      "PC assembly and repair",
      "Windows and Linux",
      "Windows Server: Active Directory, DNS and DHCP",
      "Local networks",
      "Virtual machines",
      "IT security",
      "HTML, CSS and JavaScript",
      "AI tools"
    ],
    "skills.softTitle": "Soft skills",
    "skills.soft": [
      "Problem solving",
      "Eagerness to learn",
      "Discipline and consistency",
      "Working independently",
      "Teamwork",
      "Communication"
    ],

    "boot.status": "Loading the portfolio…",
    "boot.skip": "Skip",
    "boot.l1": "Starting kernel",
    "boot.l2": "Checking hardware",
    "boot.l3": "Mounting 3D modules",
    "boot.l4": "Compiling shaders",
    "boot.l5": "Loading skills",
    "boot.l6": "Encrypting connection",
    "boot.user": "user: guest",
    "boot.ok": "OK",
    "boot.omitted": "SKIPPED",
    "boot.granted": "ACCESS GRANTED",

    "stage.label": "Interactive 3D model of a desktop PC with my technical skills orbiting around it. Rotate it with the mouse, your finger or the arrow keys.",
    "stage.hint": "Drag to rotate · Hover over the parts and nodes",
    "stage.hintTouch": "Drag to rotate · Tap the parts and nodes",
    "pc.gpu": "Graphics card",
    "pc.cooler": "Liquid cooling",
    "pc.ram": "RAM memory",
    "pc.board": "Motherboard",
    "pc.psu": "Power supply",
    "pc.fans": "RGB fans",

    "resume.body": "My resume is coming soon.",
    "certificates.body": "I'll add my certificates here as I earn them.",
    "projects.body": "I'll post the projects I build in class and on my own here.",
    "hhep.body": "Content in progress.",
    "contact.body": "My contact details are coming soon."
  },

  es: {
    "meta.title": "Portfolio de Alex",
    "meta.description": "Portfolio de Alex, Técnico en Sistemas Microinformáticos y Redes.",
    "nav.label": "Secciones",
    "lang.label": "Idioma",
    "bg.pause": "Pausar fondo",
    "bg.play": "Reproducir fondo",

    "nav.about": "Sobre mí",
    "nav.resume": "Currículum",
    "nav.certificates": "Certificados",
    "nav.projects": "Proyectos",
    "nav.hhep": "7 HHEP",
    "nav.contact": "Contacto",

    "about.photoAlt": "Retrato de Alex",
    "about.greeting": "Hola, soy Alex.",
    "about.role": "Técnico en Sistemas Microinformáticos y Redes",
    "about.p1": "Actualmente estudio SMX en Sa Palomera, y en este portfolio voy recogiendo lo que aprendo por el camino.",
    "about.p2": "Me interesa sobre todo la Inteligencia Artificial, y disfruto del trabajo que me deja resolver problemas reales y ver el resultado. Fuera de clase dedico mi tiempo a entrenar y aprender habilidades de alto valor.",

    "skills.hardTitle": "Habilidades técnicas",
    "skills.hard": [
      "Montaje y reparación de ordenadores",
      "Windows y Linux",
      "Windows Server: Active Directory, DNS y DHCP",
      "Redes locales",
      "Máquinas virtuales",
      "Seguridad informática",
      "HTML, CSS y JavaScript",
      "Herramientas de IA"
    ],
    "skills.softTitle": "Habilidades personales",
    "skills.soft": [
      "Resolución de problemas",
      "Ganas de aprender",
      "Disciplina y constancia",
      "Autonomía",
      "Trabajo en equipo",
      "Comunicación"
    ],

    "boot.status": "Cargando el portfolio…",
    "boot.skip": "Saltar",
    "boot.l1": "Iniciando núcleo",
    "boot.l2": "Comprobando hardware",
    "boot.l3": "Montando módulos 3D",
    "boot.l4": "Compilando shaders",
    "boot.l5": "Cargando habilidades",
    "boot.l6": "Cifrando conexión",
    "boot.user": "usuario: invitado",
    "boot.ok": "OK",
    "boot.omitted": "OMITIDO",
    "boot.granted": "ACCESO CONCEDIDO",

    "stage.label": "Modelo 3D interactivo de un ordenador de torre con mis habilidades técnicas a su alrededor. Se gira con el ratón, el dedo o las flechas del teclado.",
    "stage.hint": "Arrastra para girar · Pasa el cursor por las piezas y los nodos",
    "stage.hintTouch": "Arrastra para girar · Toca las piezas y los nodos",
    "pc.gpu": "Tarjeta gráfica",
    "pc.cooler": "Refrigeración líquida",
    "pc.ram": "Memoria RAM",
    "pc.board": "Placa base",
    "pc.psu": "Fuente de alimentación",
    "pc.fans": "Ventiladores RGB",

    "resume.body": "Pronto encontrarás aquí mi currículum.",
    "certificates.body": "Aquí iré añadiendo los certificados que obtenga.",
    "projects.body": "Aquí iré publicando los proyectos que haga en clase y por mi cuenta.",
    "hhep.body": "Contenido en preparación.",
    "contact.body": "Pronto añadiré aquí mis datos de contacto."
  }
};
