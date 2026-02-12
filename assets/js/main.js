(function initPortfolio() {
  const data = window.portfolioData;
  if (!data) {
    return;
  }
  document.documentElement.classList.add("js");

  const elements = {
    header: document.querySelector(".site-header"),
    heroKicker: document.getElementById("hero-kicker"),
    heroName: document.getElementById("hero-name"),
    heroRole: document.getElementById("hero-role"),
    heroHeadline: document.getElementById("hero-headline"),
    heroSummary: document.getElementById("hero-summary"),
    heroGithubLink: document.getElementById("hero-github-link"),
    heroDemoLink: document.getElementById("hero-demo-link"),
    heroStats: document.getElementById("hero-stats"),
    personaHighlights: document.getElementById("persona-highlights"),
    nowLearningList: document.getElementById("now-learning-list"),
    personalNote: document.getElementById("personal-note"),
    journeyDescription: document.getElementById("journey-description"),
    journeyGrid: document.getElementById("journey-grid"),
    projectsDescription: document.getElementById("projects-description"),
    projectsGrid: document.getElementById("projects-grid"),
    skillsDescription: document.getElementById("skills-description"),
    skillsGrid: document.getElementById("skills-grid"),
    techStackGrid: document.getElementById("tech-stack-grid"),
    contactKicker: document.getElementById("contact-kicker"),
    contactTitle: document.getElementById("contact-title"),
    contactCopy: document.getElementById("contact-copy"),
    contactEmailLink: document.getElementById("contact-email-link"),
    contactGithubLink: document.getElementById("contact-github-link"),
    contactDemoLink: document.getElementById("contact-demo-link"),
    toneButtons: Array.from(document.querySelectorAll("[data-tone-option]")),
    footerYear: document.getElementById("footer-year"),
    themeToggle: document.getElementById("theme-toggle")
  };

  if (elements.footerYear) {
    elements.footerYear.textContent = String(new Date().getFullYear());
  }

  renderProfile(data.profile, elements);
  setupToneSwitcher(data.tones, elements);
  setupThemeSwitcher(elements.themeToggle);
  renderHeroStats(data.heroStats, elements.heroStats);
  renderJourney(data.journey, elements.journeyGrid);
  renderProjects(data.projects, elements.projectsGrid);

  renderSkills(data.skills, elements.skillsGrid);
  renderTechStack(data.techStack, elements.techStackGrid);

  setupHeaderScroll(elements.header);
  setupMobileMenu();
  setupRevealObserver();
})();

function renderProfile(profile, elements) {
  if (!profile) {
    return;
  }

  setText(elements.heroKicker, profile.heroKicker);
  setText(elements.heroName, profile.name);
  setText(elements.heroRole, profile.role);
  setText(elements.heroHeadline, profile.headline);
  setText(elements.heroSummary, profile.summary);
  setText(elements.journeyDescription, profile.journeyDescription);
  setText(elements.projectsDescription, profile.projectsDescription);
  setText(elements.skillsDescription, profile.skillsDescription);

  setText(elements.contactKicker, profile.contactKicker);
  setText(elements.contactTitle, profile.contactTitle);
  setText(elements.contactCopy, profile.contactCopy);

  setExternalLink(elements.heroGithubLink, profile.github);
  setExternalLink(elements.heroDemoLink, profile.huggingFace);
  setExternalLink(elements.contactGithubLink, profile.github);
  setExternalLink(elements.contactDemoLink, profile.huggingFace);
  setEmailLink(elements.contactEmailLink, profile.email);

  renderPersona(profile, elements);
}

function setupToneSwitcher(tones, elements) {
  if (!tones || typeof tones !== "object") {
    return;
  }

  const buttons = Array.isArray(elements.toneButtons) ? elements.toneButtons : [];
  if (!buttons.length) {
    return;
  }

  const validTones = Object.keys(tones).filter((key) => tones[key] && typeof tones[key] === "object");
  if (!validTones.length) {
    return;
  }

  const initialTone = getInitialTone(validTones);
  applyTone(initialTone, tones, elements, buttons);

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const toneKey = button.getAttribute("data-tone-option");
      if (!toneKey || !tones[toneKey]) {
        return;
      }
      applyTone(toneKey, tones, elements, buttons);
      saveTonePreference(toneKey);
    });
  });
}

function applyTone(toneKey, tones, elements, buttons) {
  const tone = tones[toneKey];
  if (!tone) {
    return;
  }

  setText(elements.heroHeadline, tone.heroHeadline);
  setText(elements.heroSummary, tone.heroSummary);
  setText(elements.projectsDescription, tone.projectsDescription);
  setText(elements.skillsDescription, tone.skillsDescription);
  setText(elements.contactTitle, tone.contactTitle);
  setText(elements.contactCopy, tone.contactCopy);

  buttons.forEach((button) => {
    const active = button.getAttribute("data-tone-option") === toneKey;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.body.setAttribute("data-tone", toneKey);
}

function renderHeroStats(stats, container) {
  if (!container || !Array.isArray(stats) || stats.length === 0) {
    return;
  }

  container.innerHTML = stats
    .map(
      (stat) => `
    <li class="stat-item reveal">
      <span class="stat-label">${escapeHTML(stat.label)}</span>
      <span class="stat-value">${escapeHTML(stat.value)}</span>
    </li>
  `
    )
    .join("");
}

function renderPersona(profile, elements) {
  if (!profile || !elements) {
    return;
  }

  if (elements.personaHighlights && Array.isArray(profile.identityHighlights)) {
    elements.personaHighlights.innerHTML = profile.identityHighlights
      .map(
        (item) => `
      <article class="persona-card">
        <p class="persona-label">${escapeHTML(item.label)}</p>
        <p class="persona-value">${escapeHTML(item.value)}</p>
      </article>
    `
      )
      .join("");
  }

  if (elements.nowLearningList && Array.isArray(profile.nowLearning)) {
    elements.nowLearningList.innerHTML = profile.nowLearning
      .map((item) => `<li>${escapeHTML(item)}</li>`)
      .join("");
  }

  setText(elements.personalNote, profile.personalNote);
}

function renderJourney(journey, container) {
  if (!container || !Array.isArray(journey) || journey.length === 0) {
    return;
  }

  container.innerHTML = journey
    .map(
      (item) => `
    <article class="journey-card reveal">
      <p class="journey-phase">${escapeHTML(item.phase)}</p>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.detail)}</p>
    </article>
  `
    )
    .join("");
}

function renderProjects(projects, container) {
  if (!container || !Array.isArray(projects) || projects.length === 0) {
    return;
  }

  container.innerHTML = projects
    .map((project) => {
      const safeId = safeSlug(project.id || project.name || "project");
      const safeRepoUrl = safeExternalUrl(project.repoUrl);
      const stack = Array.isArray(project.stack)
        ? project.stack.map((item) => `<li class="chip">// ${escapeHTML(item)}</li>`).join("")
        : "";
      const outcome = isNonEmptyString(project.outcome)
        ? `<p class="project-outcome">${escapeHTML(project.outcome)}</p>`
        : "";

      return `
    <article class="project-card reveal" aria-labelledby="project-${safeId}">
      <div class="project-meta">
        <h3 id="project-${safeId}">${escapeHTML(project.name)}</h3>
        <span class="maturity-badge">${escapeHTML(project.maturity)}</span>
      </div>
      <div class="project-content">
        <p class="project-purpose">${escapeHTML(project.purpose)}</p>
        ${outcome}
        <ul class="chip-list">${stack}</ul>
        <footer class="project-footer">
          <a href="${safeRepoUrl}" target="_blank" rel="noopener noreferrer">Open Repository -></a>
        </footer>
      </div>
    </article>
  `;
    })
    .join("");
}

function renderSkills(skills, container) {
  if (!container || !Array.isArray(skills) || skills.length === 0) {
    return;
  }

  container.innerHTML = skills
    .map((skill) => {
      const tools = Array.isArray(skill.tools)
        ? skill.tools
          .map((tool) => {
            const icon = getSkillIconMarkup(tool);
            return `
          <li class="skill-item">
            <span class="skill-icon" aria-hidden="true">${icon}</span>
            <span class="skill-text">${escapeHTML(tool)}</span>
          </li>
        `;
          })
          .join("")
        : "";
      const summary = isNonEmptyString(skill.summary)
        ? `<p class="skill-summary">${escapeHTML(skill.summary)}</p>`
        : "";

      return `
    <article class="skill-card reveal">
      <h3>${escapeHTML(skill.area)}</h3>
      ${summary}
      <ul>${tools}</ul>
    </article>
  `;
    })
    .join("");
}

function renderTechStack(techStack, container) {
  if (!container || !Array.isArray(techStack) || techStack.length === 0) {
    return;
  }

  container.innerHTML = techStack
    .map((tech) => {
      let iconMarkup;
      if (tech.icon.startsWith("<svg")) {
        // Inline SVG
        iconMarkup = tech.icon.replace("<svg", '<svg class="tech-icon-svg"');
      } else if (tech.icon.startsWith("devicon-")) {
        iconMarkup = `<i class="${escapeHTML(tech.icon)}"></i>`;
      } else if (tech.icon.includes("/") || tech.icon.includes(".")) {
        // Assume image path if contains / or .
        // Treat local SVG icons as simple-icons for styling purposes (inversion in dark mode)
        const isSimpleIcon = tech.icon.includes("assets/icons/") || tech.icon.includes("simple-icons");
        const extraClass = isSimpleIcon ? " simple-icon-img" : "";
        iconMarkup = `<img src="${escapeHTML(tech.icon)}" alt="${escapeHTML(tech.name)} icon" class="tech-icon-img${extraClass}" />`;
      } else {
        // Assume emoji or text
        iconMarkup = `<span class="tech-icon-text">${escapeHTML(tech.icon)}</span>`;
      }

      return `
        <div class="tech-item reveal">
          <div class="tech-icon-wrapper">
             ${iconMarkup}
          </div>
          <span class="tech-name">${escapeHTML(tech.name)}</span>
        </div>
      `;
    })
    .join("");
}

function setupHeaderScroll(header) {
  if (!header) {
    return;
  }

  const onScroll = () => {
    header.classList.toggle("scrolled", window.scrollY > 24);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function setupMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const mobileNav = document.getElementById("mobile-nav");

  if (!toggle || !mobileNav) {
    return;
  }

  const setOpenState = (isOpen) => {
    toggle.setAttribute("aria-expanded", String(isOpen));
    mobileNav.classList.toggle("open", isOpen);
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setOpenState(!isOpen);
  });

  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpenState(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpenState(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 780) {
      setOpenState(false);
    }
  });
}

function setupThemeSwitcher(toggle) {
  if (!toggle) {
    return;
  }

  const storageKey = "portfolio-theme";
  const className = "light-mode";
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  const darkThemeColor = "#020907";
  const lightThemeColor = "#f6efe4";

  const applyTheme = (isLight) => {
    document.documentElement.classList.toggle(className, isLight);
    toggle.setAttribute("aria-pressed", String(isLight));
    toggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", isLight ? lightThemeColor : darkThemeColor);
    }
  };

  // 1. Check storage
  const stored = getStoredValue(storageKey);
  // 2. Check system preference if no storage
  const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;

  const initialLight = stored === "light" || (!stored && systemPrefersLight);
  applyTheme(initialLight);

  toggle.addEventListener("click", () => {
    const isLight = !document.documentElement.classList.contains(className);
    applyTheme(isLight);
    setStoredValue(storageKey, isLight ? "light" : "dark");
  });
}

function setupRevealObserver() {
  const nodes = document.querySelectorAll(".reveal");
  if (!nodes.length) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const unsupportedObserver = !("IntersectionObserver" in window);

  if (reducedMotion || unsupportedObserver) {
    nodes.forEach((node) => node.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  nodes.forEach((node) => observer.observe(node));
}

function getInitialTone(validTones) {
  const fallback = validTones.includes("technical") ? "technical" : validTones[0];

  const stored = getStoredValue("portfolio-tone");
  if (stored && validTones.includes(stored)) {
    return stored;
  }

  return fallback;
}

function saveTonePreference(toneKey) {
  setStoredValue("portfolio-tone", toneKey);
}

function getSkillIconMarkup(toolName) {
  const text = String(toolName || "").toLowerCase();

  const icons = {
    code: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    `,
    cpu: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="7" y="7" width="10" height="10" rx="2"></rect>
        <path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3"></path>
      </svg>
    `,
    cloud: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 10a4 4 0 0 0-7.5-2A5 5 0 0 0 6 18h11a4 4 0 0 0 1-8z"></path>
      </svg>
    `,
    chart: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18"></path>
        <path d="m7 14 4-4 3 3 5-6"></path>
      </svg>
    `,
    wand: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="m4 20 8-8"></path>
        <path d="m14 4 1.5 3 3 1.5-3 1.5L14 13l-1.5-3L9.5 8.5l3-1.5L14 4z"></path>
      </svg>
    `
  };

  if (
    text.includes("cloud") ||
    text.includes("container") ||
    text.includes("devops") ||
    text.includes("deployment")
  ) {
    return icons.cloud;
  }

  if (
    text.includes("gan") ||
    text.includes("neural") ||
    text.includes("cnn") ||
    text.includes("transformer") ||
    text.includes("multimodal") ||
    text.includes("depth")
  ) {
    return icons.cpu;
  }

  if (
    text.includes("loss") ||
    text.includes("experiment") ||
    text.includes("optimization") ||
    text.includes("training")
  ) {
    return icons.chart;
  }

  if (
    text.includes("style transfer") ||
    text.includes("creative") ||
    text.includes("inference")
  ) {
    return icons.wand;
  }

  return icons.code;
}

function getStoredValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function setStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    // Ignore storage write failures.
  }
}

function setText(element, value) {
  if (!element || !isNonEmptyString(value)) {
    return;
  }

  element.textContent = value.trim();
}

function setExternalLink(element, rawUrl) {
  if (!element || !isNonEmptyString(rawUrl)) {
    return;
  }

  element.setAttribute("href", safeExternalUrl(rawUrl));
  element.setAttribute("target", "_blank");
  element.setAttribute("rel", "noopener noreferrer");
}

function setEmailLink(element, email) {
  if (!element || !isNonEmptyString(email)) {
    return;
  }

  element.setAttribute("href", `mailto:${email.trim()}`);
}

function safeExternalUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl));
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch (_) {
    // Keep safe fallback below.
  }

  return "#";
}

function safeSlug(rawValue) {
  return (
    String(rawValue)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

function escapeHTML(rawValue) {
  const text = String(rawValue ?? "");
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return text.replace(/[&<>"']/g, (char) => replacements[char]);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
