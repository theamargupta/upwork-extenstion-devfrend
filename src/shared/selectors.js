(() => {
  'use strict';

  const SELECTORS = {
    pageText: {
      hideChrome: [
        'nav', 'footer', 'header', 'aside',
        '[role="navigation"]', '[role="contentinfo"]', '[role="banner"]',
        '[aria-label*="footer" i]', '[aria-label*="navigation" i]',
        '[class*="footer" i]', '[id*="footer" i]',
        '[data-test*="footer" i]', '[data-qa*="footer" i]',
        '.site-footer', '.page-footer', '.site-header', '.page-header',
        'script', 'style', 'noscript'
      ],
      dialog: 'dialog[open], [role="dialog"][aria-modal="true"], [role="dialog"]:not([aria-hidden="true"]), .air3-modal, .air3-slider[role="dialog"]'
    },
    jobDetail: {
      title: [
        'h4 span.flex-1', 'h1 span.flex-1', 'h4.flex-1', 'h1.flex-1',
        'h4[data-test="job-title"]', 'h1[data-test="job-title"]',
        '.job-details-header h4', '.job-details-header h1',
        'header h4', 'header h1', 'h4', 'h1'
      ],
      description: [
        '.text-body-sm.multiline-text', '[data-test="Description"]',
        '[data-test="description"]', '.break.word-break', '.break',
        '.job-description', '.description .text-body', 'section .text-body-sm',
        '[data-cy="description"]'
      ],
      descriptionFallback: 'p, div.text-body-sm',
      fixedBudget: [
        '[data-cy="fixed-price"]', '[data-test="fixed-price"]',
        '[data-test="budget"]', '.features [data-cy="fixed-price"]'
      ],
      hourlyBudget: [
        '[data-cy="hourly-rate"]', '[data-test="hourly-rate"]',
        '[data-test="hourly-budget"]'
      ],
      features: ['.features li', '.job-features li', '[data-test="features"] li'],
      experience: ['[data-test="experience-level"]', '[data-cy="experience-level"]', '.experience-level'],
      skills: [
        '.air3-badge-highlight', '.skills-list .badge', '.skills-list a',
        '[data-test="Ede Skills"] .air3-badge',
        '[data-test="skills-list"] .air3-badge', '.skill-badge',
        '.skills a.badge', '.up-skill-badge', 'a[data-test="attr-item"]'
      ],
      postedDate: ['[data-test="PostedOn"]', '[data-test="posted-on"]', '.posted-on', 'time'],
      location: ['[data-test="location"]', '[data-cy="location"]', '.location'],
      postedLine: ['.posted-on-line', '.d-flex.posted-on-line'],
      postedLineLocation: 'p.text-light-on-muted',
      projectInfo: ['.features li', '.job-features li', '[data-test="features"] li', '.segmentations li'],
      proposals: ['[data-test="proposals"]', '[data-cy="proposals"]', '.proposals']
    },
    client: {
      container: [
        '[data-test="about-client-container"]', '[data-test="AboutClientBanner"]',
        '.about-client', '.client-info', '[data-cy="about-client"]'
      ],
      paymentVerified: '.payment-verified:not(.payment-not-verified)',
      paymentNotVerified: '.payment-not-verified',
      location: '[data-qa="client-location"], [data-test="client-location"], [data-cy="client-location"]',
      country: 'strong',
      city: '.nowrap'
    },
    searchList: {
      cards: [
        'section.air3-card-section.air3-card-hover[data-ev-opening_uid]',
        '[data-test="job-tile-list"] > section',
        '[data-test="job-tile-list"] article',
        'section.up-card-section .job-tile-list article',
        '.job-tile-list .job-tile',
        'section[data-ev-sublocation="job_feed_tile"]',
        '.air3-card-section[data-ev-opening_uid]',
        '.job-tile',
        'article[data-ev-opening_uid]'
      ],
      titleLinks: '[data-test="job-tile-list"] a[href*="/jobs/"], a[href*="/jobs/~"], a[href*="/best-matches/details/"]',
      jobLink: 'a[href*="/jobs/~"], a[href*="/best-matches/details/"]',
      fallbackLink: 'h4 a, h3 a, .job-title a',
      anyLink: 'a',
      cardContainer: 'section[data-ev-opening_uid], section.air3-card-section, article',
      sidebar: '.air3-slider[role="dialog"], .air3-slider-job-details, [data-test="air3-slider"]',
      sidebarReady: '.air3-slider[role="dialog"], .air3-slider-job-details',
      sidebarClose: '[data-test="slider-close-mobile"], .air3-slider-close-mobile, .air3-slider .air3-btn-link[data-test="slider-go-back"]'
    },
    apply: {
      coverLetter: 'textarea[aria-labelledby="cover_letter_label"]',
      warningBanner: '.air3-alert-warning, [class*="alert-warning"], [class*="unmet-criteria"]',
      rateDropdownToggle: '[aria-label="How often do you want a rate increase?"] .air3-dropdown-toggle',
      rateMenuItem: 'li.air3-menu-item',
      highlightsTrigger: '[data-test="portfolio"]',
      certTabBtn: 'button.air3-tab-btn[data-ev-label="certifications"]',
      dialog: '[role="dialog"]',
      highlightHeaders: 'h5',
      highlightCardContainer: '[class*="air3-card"], [class*="item"], li, article, section',
      highlightAddButton: 'button.item-add',
      selectedItemTitle: '.item-title',
      modalButtons: 'button',
      milestoneDescription: 'input[data-test="milestone-description"]',
      milestoneAmountIdPrefix: 'milestone-amount-',
      durationDropdownToggle: '[data-test="dropdown-toggle"]',
      durationMenuItem: 'li.air3-menu-item, li[role="option"]'
    },
    autoApply: {
      applyButton: 'button[data-cy="submit-proposal-button"], a[data-cy="submit-proposal-button"], button[aria-label="Apply now"]',
      drawer: '[role="dialog"], .air3-modal, .air3-slider',
      coverTextarea: '[role="dialog"] textarea[aria-labelledby="cover_letter_label"], textarea[aria-labelledby="cover_letter_label"], [role="dialog"] textarea, .air3-modal textarea, .air3-slider textarea, textarea.air3-textarea',
      rateToggle: '[aria-label="How often do you want a rate increase?"] [role="combobox"], [aria-label="How often do you want a rate increase?"] .air3-dropdown-toggle',
      rateOptions: '#dropdown-menu li, [role="listbox"] li, .air3-menu-item, li.air3-menu-item, li[role="option"], [role="option"], .air3-dropdown-menu li',
      portfolioCard: '[data-test="portfolio"]',
      certificationsCard: '[data-test="certifications"]',
      highlightsModal: '.air3-modal-highlights-editor[role="dialog"]',
      highlightTabButton: '.air3-modal-highlights-editor button[role="tab"][aria-controls="{tab}"]',
      highlightPanelActive: '.air3-modal-highlights-editor #{tab}.is-active',
      highlightSelectButton: '.air3-modal-highlights-editor #{tab} button[data-ev-label="profile_highlights_editor_btn_add"]',
      highlightButtons: '.air3-modal-highlights-editor button',
      truncationButtons: 'button.air3-truncation-btn[aria-expanded="false"], button[aria-expanded="false"].air3-btn-link'
    }
  };

  globalThis.__jobExtractor = globalThis.__jobExtractor || {};
  globalThis.__jobExtractor.SELECTORS = SELECTORS;
})();
