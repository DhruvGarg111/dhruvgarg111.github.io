(function initPortfolio() {
  const data = window.portfolioData;
  if (!data) {
    return;
  }
  document.documentElement.classList.add("js");

  const elements = {
    header: document.querySelector(".site-header"),
    heroMain: document.querySelector(".hero-main"),
    heroKicker: document.getElementById("hero-kicker"),
    heroName: document.getElementById("hero-name"),
    heroRole: document.getElementById("hero-role"),
    heroHeadline: document.getElementById("hero-headline"),
    heroSummary: document.getElementById("hero-summary"),
    heroGithubLink: document.getElementById("hero-github-link"),
    heroDemoLink: document.getElementById("hero-demo-link"),
    heroCanvasLink: document.getElementById("hero-canvas-link"),
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
    contactCanvasLink: document.getElementById("contact-canvas-link"),
    toneToggle: document.getElementById("tone-toggle"),
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
  setupSectionHighlighting(elements.header);
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

  const demoUrl = isNonEmptyString(profile.demoUrl) ? profile.demoUrl : profile.huggingFace;
  const neuralCanvasUrl = isNonEmptyString(profile.neuralCanvasUrl) ? profile.neuralCanvasUrl : profile.huggingFace;
  setExternalLink(elements.heroGithubLink, profile.github);
  setExternalLink(elements.heroDemoLink, demoUrl);
  setExternalLink(elements.heroCanvasLink, neuralCanvasUrl);
  setExternalLink(elements.contactGithubLink, profile.github);
  setExternalLink(elements.contactDemoLink, demoUrl);
  setExternalLink(elements.contactCanvasLink, neuralCanvasUrl);
  setEmailLink(elements.contactEmailLink, profile.email);

  renderPersona(profile, elements);
}

function setupToneSwitcher(tones, elements) {
  if (!tones || typeof tones !== "object") {
    return;
  }

  const toggle = elements.toneToggle;
  if (!toggle) {
    return;
  }

  const validTones = Object.keys(tones).filter((key) => tones[key] && typeof tones[key] === "object");
  if (!validTones.length) {
    return;
  }

  const toneOrder = getToneOrder(validTones);
  const initialTone = getInitialTone(validTones);
  applyTone(initialTone, tones, elements, toggle, toneOrder);
  setupHeroToneHeightLock(validTones, tones, elements);

  if (toneOrder.left === toneOrder.right) {
    toggle.setAttribute("disabled", "true");
    return;
  }

  toggle.addEventListener("click", () => {
    const currentTone = document.body.getAttribute("data-tone");
    const nextTone = currentTone === toneOrder.right ? toneOrder.left : toneOrder.right;
    if (!tones[nextTone]) {
      return;
    }
    applyTone(nextTone, tones, elements, toggle, toneOrder);
    lockHeroToneHeight(validTones, tones, elements);
    saveTonePreference(nextTone);
  });
}

function applyTone(toneKey, tones, elements, toggle, toneOrder) {
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

  const isRightTone = toneKey === toneOrder.right;
  toggle.classList.toggle("is-right", isRightTone);
  toggle.setAttribute("aria-checked", String(isRightTone));
  toggle.setAttribute("aria-label", isRightTone ? "Switch to technical view" : "Switch to hiring view");

  document.body.setAttribute("data-tone", toneKey);
}

function renderHeroStats(stats, container) {
  if (!container || !Array.isArray(stats) || stats.length === 0) {
    return;
  }

  container.innerHTML = stats
    .map(
      (stat, index) => `
    <li class="stat-item reveal" style="--reveal-delay:${getRevealDelay(index, 70, 360)}ms">
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
      (item, index) => `
    <article class="journey-card reveal" style="--reveal-delay:${getRevealDelay(index, 90, 540)}ms">
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
    .map((project, index) => {
      const safeId = safeSlug(project.id || project.name || "project");
      const safeRepoUrl = safeExternalUrl(project.repoUrl);
      const safeLiveUrl = safeExternalUrl(project.liveUrl);
      const stack = Array.isArray(project.stack)
        ? project.stack.map((item) => `<li class="chip">${escapeHTML(item)}</li>`).join("")
        : "";
      const purpose = isNonEmptyString(project.purpose)
        ? `<p class="project-purpose">${escapeHTML(project.purpose)}</p>`
        : "";
      const deployment = isNonEmptyString(project.deployment)
        ? `<p class="project-deployment">${escapeHTML(project.deployment)}</p>`
        : "";
      const outcome = isNonEmptyString(project.outcome)
        ? `<p class="project-outcome">${escapeHTML(project.outcome)}</p>`
        : "";
      const caseStudyItems = buildProjectCaseStudy(project);
      const caseStudy = caseStudyItems.length
        ? `
          <ul class="project-case-study">
            ${caseStudyItems
      .map(
        (item) => `
              <li class="project-case-item">
                <span class="project-case-label">${escapeHTML(item.label)}</span>${escapeHTML(item.value)}
              </li>
            `
      )
      .join("")}
          </ul>
        `
        : outcome;
      const liveLink = isNonEmptyString(project.liveUrl)
        ? `<a class="project-link project-link-live" href="${safeLiveUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(project.liveLabel || "Launch App")} -></a>`
        : "";
      const delay = getRevealDelay(index, 110, 660);

      return `
    <article class="project-card reveal" aria-labelledby="project-${safeId}" style="--reveal-delay:${delay}ms">
      <div class="project-meta">
        <h3 id="project-${safeId}">${escapeHTML(project.name)}</h3>
        <span class="maturity-badge">${escapeHTML(project.maturity)}</span>
      </div>
      <div class="project-content">
        ${purpose}
        ${caseStudy}
        ${deployment}
        <ul class="chip-list">${stack}</ul>
        <footer class="project-footer">
          ${liveLink}
          <a class="project-link project-link-repo" href="${safeRepoUrl}" target="_blank" rel="noopener noreferrer">Open Repository -></a>
        </footer>
      </div>
    </article>
  `;
    })
    .join("");
}

function buildProjectCaseStudy(project) {
  if (!project || typeof project !== "object") {
    return [];
  }

  const blocks = [
    { label: "Problem", value: project.problem },
    { label: "Approach", value: project.approach },
    { label: "Impact", value: project.impact }
  ];

  return blocks.filter((item) => isNonEmptyString(item.value));
}

function renderSkills(skills, container) {
  if (!container || !Array.isArray(skills) || skills.length === 0) {
    return;
  }

  container.innerHTML = skills
    .map((skill, index) => {
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
      const delay = getRevealDelay(index, 85, 510);

      return `
    <article class="skill-card reveal" style="--reveal-delay:${delay}ms">
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
    .map((tech, index) => {
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
        <div class="tech-item reveal" style="--reveal-delay:${getRevealDelay(index, 45, 450)}ms">
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

function setupSectionHighlighting(header) {
  const navLinks = Array.from(
    document.querySelectorAll('.site-nav a[href^="#"], .mobile-nav a[href^="#"]')
  );

  if (!navLinks.length) {
    return;
  }

  const sectionMap = new Map();
  navLinks.forEach((link) => {
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") {
      return;
    }

    const section = document.querySelector(hash);
    if (!section || sectionMap.has(hash)) {
      return;
    }

    sectionMap.set(hash, section);
  });

  const sections = Array.from(sectionMap.entries()).map(([hash, section]) => ({ hash, section }));
  if (!sections.length) {
    return;
  }

  const setActiveLink = (activeHash) => {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === activeHash;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateActiveLink = () => {
    const headerOffset = (header?.offsetHeight || 88) + 24;
    const scrollMarker = window.scrollY + headerOffset;
    let activeHash = sections[0].hash;

    sections.forEach(({ hash, section }) => {
      if (section.offsetTop <= scrollMarker) {
        activeHash = hash;
      }
    });

    setActiveLink(activeHash);
  };

  updateActiveLink();
  window.addEventListener("scroll", updateActiveLink, { passive: true });
  window.addEventListener("resize", updateActiveLink);
}

function setupThemeSwitcher(toggle) {
  if (!toggle) {
    return;
  }

  const storageKey = "portfolio-theme";
  const className = "light-mode";
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  const darkThemeColor = "#10131a";
  const lightThemeColor = "#f7f1e6";
  const darkLogos = Array.from(document.querySelectorAll(".profile-logo-dark"));
  const lightLogos = Array.from(document.querySelectorAll(".profile-logo-light"));

  const syncThemeLogos = (isLight) => {
    darkLogos.forEach((logo) => {
      logo.hidden = isLight;
      logo.setAttribute("aria-hidden", String(isLight));
    });

    lightLogos.forEach((logo) => {
      logo.hidden = !isLight;
      logo.setAttribute("aria-hidden", String(!isLight));
    });
  };

  const applyTheme = (isLight) => {
    document.documentElement.classList.toggle(className, isLight);
    syncThemeLogos(isLight);
    toggle.classList.toggle("is-light", isLight);
    toggle.setAttribute("aria-checked", String(isLight));
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

function getToneOrder(validTones) {
  const left = validTones.includes("technical") ? "technical" : validTones[0];
  const rightCandidate = validTones.includes("recruiter")
    ? "recruiter"
    : validTones.find((tone) => tone !== left);
  const right = rightCandidate || left;

  return { left, right };
}

function setupHeroToneHeightLock(validTones, tones, elements) {
  if (!Array.isArray(validTones) || !validTones.length) {
    return;
  }

  const updateHeight = () => lockHeroToneHeight(validTones, tones, elements);
  updateHeight();

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(updateHeight, 120);
  });

  if (document.fonts && typeof document.fonts.ready?.then === "function") {
    document.fonts.ready.then(updateHeight).catch(() => {
      // Ignore font readiness failures.
    });
  }
}

function lockHeroToneHeight(validTones, tones, elements) {
  const heroMain = elements.heroMain;
  if (!heroMain || !heroMain.isConnected) {
    return;
  }

  const previousMinHeight = heroMain.style.minHeight;
  heroMain.style.minHeight = "0px";

  const width = heroMain.getBoundingClientRect().width;
  if (!width) {
    heroMain.style.minHeight = previousMinHeight;
    return;
  }

  const clone = heroMain.cloneNode(true);
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.width = `${width}px`;
  clone.style.minHeight = "0";
  clone.style.height = "auto";
  clone.style.transform = "none";

  const cloneHeadline = clone.querySelector(".hero-headline");
  const cloneSummary = clone.querySelector(".hero-summary");

  document.body.appendChild(clone);

  let maxHeight = 0;

  validTones.forEach((toneKey) => {
    const tone = tones[toneKey];
    if (!tone || !cloneHeadline || !cloneSummary) {
      return;
    }

    if (isNonEmptyString(tone.heroHeadline)) {
      cloneHeadline.textContent = tone.heroHeadline.trim();
    }

    if (isNonEmptyString(tone.heroSummary)) {
      cloneSummary.textContent = tone.heroSummary.trim();
    }

    maxHeight = Math.max(maxHeight, Math.ceil(clone.getBoundingClientRect().height));
  });

  document.body.removeChild(clone);

  if (maxHeight <= 0) {
    heroMain.style.minHeight = previousMinHeight;
    return;
  }

  heroMain.style.minHeight = `${maxHeight}px`;
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

function getRevealDelay(index, step = 80, max = 600) {
  const numericIndex = Number.isFinite(index) ? index : 0;
  const normalized = Math.max(0, numericIndex);
  return Math.min(normalized * step, max);
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

