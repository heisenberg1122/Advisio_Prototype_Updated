/* ADVISIO | Student Onboarding Product Tour Logic */

(function () {
  // Tour steps definition
  const tourSteps = [
    {
      tab: 'overview',
      selector: '[data-tour="student-overview"]',
      title: 'Dashboard Overview',
      desc: 'Welcome to your Student Research Dashboard. This is your central hub for tracking capstone progress, managing milestones, and coordinating consultations.'
    },
    {
      tab: 'progress-tracker',
      selector: '[data-tour="student-progress-tracker"]',
      title: 'Research Progress Tracker',
      desc: 'Monitor your group\'s active milestones here. Track approved chapters, ongoing revision cycles, and pending tasks from start to finish.'
    },
    {
      tab: 'overview',
      selector: '[data-tour="student-events"]',
      title: 'Upcoming Events',
      desc: 'Keep track of approaching deadlines, scheduled consultations, and defense presentation timelines to stay on schedule.'
    },
    {
      tab: 'adviser-pool',
      selector: '[data-tour="student-adviser-pool"]',
      title: 'Adviser Credentials Hub',
      desc: 'Browse available faculty advisers, search by research expertise, check their current advising loads, and view recommendation scores.'
    },
    {
      tab: 'chat',
      selector: '[data-tour="student-group-thread"]',
      title: 'Group Thread & Chats',
      desc: 'Communicate directly with your faculty adviser and group members in one centralized chat, send drafts, and receive feedback notifications.'
    },
    {
      tab: 'tasks',
      selector: '[data-tour="student-tasks"]',
      title: 'Assigned Tasks',
      desc: 'View research-related tasks assigned to your student group. Submissions and progress charts for other groups remain hidden.'
    },
    {
      tab: 'submissions',
      selector: '[data-tour="student-document-submission"]',
      title: 'Document Submission',
      desc: 'Upload document drafts, preview your chapters before submission, and view adviser notes, comments, and margin annotations.'
    },
    {
      tab: 'submissions',
      selector: '[data-tour="student-version-history"]',
      title: 'Document Version History',
      desc: 'Track files uploaded previously. Monitor approval progress, returned drafts, and download compiled manuscripts.'
    },
    {
      tab: 'consultation-hub',
      selector: '[data-tour="student-consultation-hub"]',
      title: 'Consultation Hub',
      desc: 'View consultation logs, check meeting schedules, request new consultation blocks, and launch video conferencing directly from the table.'
    },
    {
      tab: 'defense-center',
      selector: '[data-tour="student-defense-center"]',
      title: 'Defense Center',
      desc: 'Check your defense readiness checklist, verify panelist assignments, and view scheduled defense locations.'
    },
    {
      tab: 'notifications',
      selector: '[data-tour="student-notifications"]',
      title: 'Notifications Center',
      desc: 'Stay informed on all project updates, task alerts, return reports, and grade submissions from a central feed.'
    },
    {
      tab: 'grades',
      selector: '[data-tour="student-grades"]',
      title: 'Evaluation Remarks & Grades',
      desc: 'Review scoring criteria details, individual panel member grades, and overall remarks for your capstone project.'
    },
    {
      tab: 'certificates',
      selector: '[data-tour="student-certificates"]',
      title: 'Certificates of Completion',
      desc: 'Preview and download your QR-verified Certificate of Research Completion once all panel and coordinator requirements are fully satisfied.'
    }
  ];

  let currentStepIndex = -1;
  let isTourActive = false;
  let isAutoStarted = false;

  // DOM elements created dynamically
  let clickBlockerEl = null;
  let highlightBoxEl = null;
  let tooltipEl = null;

  // Key storage name
  const LOCAL_STORAGE_KEY = 'advisio_tour_completed_student';

  // Entry function to start the tour
  function startProductTour(autoStart = false) {
    if (isTourActive) return;

    isTourActive = true;
    isAutoStarted = !!autoStart;
    currentStepIndex = 0;

    // Reset localStorage marker if manually restarting
    if (!autoStart) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }

    createTourElements();
    bindEvents();

    // Ensure we start on the Overview tab
    const targetHash = `#/app/student/overview`;
    if (window.location.hash !== targetHash) {
      const onHashChange = () => {
        window.removeEventListener('hashchange', onHashChange);
        setTimeout(() => {
          goToStep(0);
        }, 120);
      };
      window.addEventListener('hashchange', onHashChange);
      if (typeof routeTo === 'function') {
        routeTo(targetHash);
      } else {
        window.location.hash = targetHash;
      }
    } else {
      goToStep(0);
    }
  }

  // Create UI wrappers
  function createTourElements() {
    /*
    if (!clickBlockerEl) {
      clickBlockerEl = document.createElement('div');
      clickBlockerEl.className = 'tour-click-blocker';
      document.body.appendChild(clickBlockerEl);
    }
    */

    if (!highlightBoxEl) {
      highlightBoxEl = document.createElement('div');
      highlightBoxEl.className = 'tour-highlight-box';
      document.body.appendChild(highlightBoxEl);
    }

    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'tour-tooltip';
      tooltipEl.setAttribute('role', 'dialog');
      tooltipEl.setAttribute('aria-modal', 'true');
      tooltipEl.setAttribute('aria-label', 'Student Dashboard Product Tour');
      tooltipEl.innerHTML = `
        <div class="tour-tooltip-arrow"></div>
        <div class="tour-tooltip-content">
          <h4 class="tour-tooltip-title"></h4>
          <p class="tour-tooltip-desc"></p>
        </div>
        <div class="tour-tooltip-footer">
          <button class="tour-btn tour-btn-link tour-btn-skip">Skip Tour</button>
          <div class="tour-btn-group">
            <span class="tour-step-progress"></span>
            <button class="tour-btn tour-btn-prev">Back</button>
            <button class="tour-btn tour-btn-primary tour-btn-next">Next</button>
          </div>
        </div>
      `;
      document.body.appendChild(tooltipEl);

      // Bind click handlers to tour buttons
      tooltipEl.querySelector('.tour-btn-skip').addEventListener('click', skipTour);
      tooltipEl.querySelector('.tour-btn-prev').addEventListener('click', prevStep);
      tooltipEl.querySelector('.tour-btn-next').addEventListener('click', nextStep);
    }

    // if (clickBlockerEl) clickBlockerEl.classList.remove('hidden');
    highlightBoxEl.classList.remove('hidden');
    tooltipEl.classList.remove('hidden');
  }

  // Find target element with a retry mechanism to handle tab loading
  function findTargetWithRetry(selector, retries = 10, delay = 50) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (retries <= 0) {
        resolve(null);
        return;
      }
      setTimeout(() => {
        findTargetWithRetry(selector, retries - 1, delay).then(resolve);
      }, delay);
    });
  }

  // Navigate to step by index
  function goToStep(index) {
    if (index < 0 || index >= tourSteps.length) return;
    currentStepIndex = index;
    const step = tourSteps[index];

    const targetHash = `#/app/student/${step.tab}`;
    if (window.location.hash !== targetHash) {
      const onHashChange = () => {
        window.removeEventListener('hashchange', onHashChange);
        setTimeout(() => {
          showStep(index);
        }, 100);
      };
      window.addEventListener('hashchange', onHashChange);
      if (typeof routeTo === 'function') {
        routeTo(targetHash);
      } else {
        window.location.hash = targetHash;
      }
    } else {
      showStep(index);
    }
  }

  // Display step details and position elements
  function showStep(index) {
    const step = tourSteps[index];
    findTargetWithRetry(step.selector).then((targetEl) => {
      // If target element is not found, fallback to centering tooltip on screen
      if (!targetEl) {
        highlightBoxEl.style.display = 'none';
        positionTooltipFallback(tooltipEl);
      } else {
        highlightBoxEl.style.display = 'block';
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Brief timeout to let scroll stabilize before calculating bounding positions
        setTimeout(() => {
          updateHighlightAndTooltip(targetEl);
        }, 220);
      }

      // Update tooltip text content
      tooltipEl.querySelector('.tour-tooltip-title').textContent = step.title;
      tooltipEl.querySelector('.tour-tooltip-desc').textContent = step.desc;

      // Update progress label
      tooltipEl.querySelector('.tour-step-progress').textContent = `${index + 1} / ${tourSteps.length}`;

      // Update button configurations
      const prevBtn = tooltipEl.querySelector('.tour-btn-prev');
      const nextBtn = tooltipEl.querySelector('.tour-btn-next');

      if (index === 0) {
        prevBtn.style.display = 'none';
      } else {
        prevBtn.style.display = 'inline-flex';
      }

      if (index === tourSteps.length - 1) {
        nextBtn.textContent = 'Finish';
        nextBtn.focus();
      } else {
        nextBtn.textContent = 'Next';
      }
    });
  }

  function nextStep() {
    if (currentStepIndex === tourSteps.length - 1) {
      finishTour();
    } else {
      goToStep(currentStepIndex + 1);
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }

  // Clean up tour overlay UI and listeners
  function destroyTourUI() {
    isTourActive = false;
    currentStepIndex = -1;

    if (clickBlockerEl) clickBlockerEl.classList.add('hidden');
    if (highlightBoxEl) highlightBoxEl.classList.add('hidden');
    if (tooltipEl) tooltipEl.classList.add('hidden');

    unbindEvents();
  }

  function skipTour() {
    destroyTourUI();
    localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
    if (typeof showToast === 'function') {
      showToast('Onboarding tour skipped.');
    }
  }

  function finishTour() {
    destroyTourUI();
    localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
    if (typeof showToast === 'function') {
      showToast('Welcome to Advisio! Tour completed.');
    }
  }

  // Event handler for window listeners
  function handleReposition() {
    if (!isTourActive || currentStepIndex < 0) return;
    const step = tourSteps[currentStepIndex];
    const targetEl = document.querySelector(step.selector);
    if (targetEl) {
      updateHighlightAndTooltip(targetEl);
    }
  }

  function handleKeydown(e) {
    if (!isTourActive) return;

    // Close on Escape key
    if (e.key === 'Escape') {
      skipTour();
      e.preventDefault();
      return;
    }

    // Left/Right arrow keys for navigation (when not typing in elements)
    if (e.key === 'ArrowRight') {
      nextStep();
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft') {
      prevStep();
      e.preventDefault();
      return;
    }

    // Accessibility: Trap focus inside the tooltip buttons
    if (e.key === 'Tab') {
      const focusable = Array.from(tooltipEl.querySelectorAll('button:not([style*="display: none"])'));
      if (focusable.length === 0) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstEl) {
          lastEl.focus();
          e.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === lastEl) {
          firstEl.focus();
          e.preventDefault();
        }
      }
    }
  }

  function bindEvents() {
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition);
    window.addEventListener('keydown', handleKeydown);
  }

  function unbindEvents() {
    window.removeEventListener('resize', handleReposition);
    window.removeEventListener('scroll', handleReposition);
    window.removeEventListener('keydown', handleKeydown);
  }

  // Positioning calculations
  function updateHighlightAndTooltip(targetEl) {
    const targetRect = targetEl.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // 1. Position Spotlight frame
    const padding = 8;
    const top = targetRect.top + scrollY - padding;
    const left = targetRect.left + scrollX - padding;
    const width = targetRect.width + padding * 2;
    const height = targetRect.height + padding * 2;

    highlightBoxEl.style.top = `${top}px`;
    highlightBoxEl.style.left = `${left}px`;
    highlightBoxEl.style.width = `${width}px`;
    highlightBoxEl.style.height = `${height}px`;

    // 2. Position Tooltip card dynamically near target
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;

    let tooltipTop = 0;
    let tooltipLeft = 0;
    let placement = 'bottom'; // Default placement is below target

    // Try placing below target
    if (targetRect.bottom + tooltipRect.height + margin < viewportHeight) {
      tooltipTop = targetRect.bottom + scrollY + margin;
      tooltipLeft = targetRect.left + scrollX + (targetRect.width - tooltipRect.width) / 2;
      placement = 'bottom';
    }
    // Fallback: place above target
    else if (targetRect.top - tooltipRect.height - margin > 0) {
      tooltipTop = targetRect.top + scrollY - tooltipRect.height - margin;
      tooltipLeft = targetRect.left + scrollX + (targetRect.width - tooltipRect.width) / 2;
      placement = 'top';
    }
    // Secondary Fallback: place to the right
    else if (targetRect.right + tooltipRect.width + margin < viewportWidth) {
      tooltipTop = targetRect.top + scrollY + (targetRect.height - tooltipRect.height) / 2;
      tooltipLeft = targetRect.right + scrollX + margin;
      placement = 'right';
    }
    // Tertiary Fallback: place to the left
    else if (targetRect.left - tooltipRect.width - margin > 0) {
      tooltipTop = targetRect.top + scrollY + (targetRect.height - tooltipRect.height) / 2;
      tooltipLeft = targetRect.left + scrollX - tooltipRect.width - margin;
      placement = 'left';
    }
    // Absolute Fallback: center on viewport
    else {
      tooltipTop = scrollY + (viewportHeight - tooltipRect.height) / 2;
      tooltipLeft = scrollX + (viewportWidth - tooltipRect.width) / 2;
      placement = 'center';
    }

    // Prevent tooltip from clipping the viewport side margins
    const maxLeft = viewportWidth + scrollX - tooltipRect.width - margin;
    const minLeft = scrollX + margin;
    tooltipLeft = Math.max(minLeft, Math.min(maxLeft, tooltipLeft));

    const maxTop = document.documentElement.scrollHeight - tooltipRect.height - margin;
    const minTop = scrollY + margin;
    tooltipTop = Math.max(minTop, Math.min(maxTop, tooltipTop));

    tooltipEl.style.top = `${tooltipTop}px`;
    tooltipEl.style.left = `${tooltipLeft}px`;
    tooltipEl.setAttribute('data-placement', placement);

    // Position arrow connection pointer
    const arrowEl = tooltipEl.querySelector('.tour-tooltip-arrow');
    if (arrowEl) {
      if (placement === 'bottom') {
        arrowEl.style.display = 'block';
        arrowEl.style.top = '-6px';
        arrowEl.style.bottom = 'auto';
        arrowEl.style.right = 'auto';
        arrowEl.style.left = `${Math.min(tooltipRect.width - 24, Math.max(24, targetRect.left + scrollX + targetRect.width / 2 - tooltipLeft))}px`;
        arrowEl.style.transform = 'rotate(45deg)';
      } else if (placement === 'top') {
        arrowEl.style.display = 'block';
        arrowEl.style.top = 'auto';
        arrowEl.style.bottom = '-6px';
        arrowEl.style.right = 'auto';
        arrowEl.style.left = `${Math.min(tooltipRect.width - 24, Math.max(24, targetRect.left + scrollX + targetRect.width / 2 - tooltipLeft))}px`;
        arrowEl.style.transform = 'rotate(45deg)';
      } else if (placement === 'right') {
        arrowEl.style.display = 'block';
        arrowEl.style.left = '-6px';
        arrowEl.style.right = 'auto';
        arrowEl.style.bottom = 'auto';
        arrowEl.style.top = `${Math.min(tooltipRect.height - 24, Math.max(24, targetRect.top + scrollY + targetRect.height / 2 - tooltipTop))}px`;
        arrowEl.style.transform = 'rotate(-135deg)';
      } else if (placement === 'left') {
        arrowEl.style.display = 'block';
        arrowEl.style.left = 'auto';
        arrowEl.style.right = '-6px';
        arrowEl.style.bottom = 'auto';
        arrowEl.style.top = `${Math.min(tooltipRect.height - 24, Math.max(24, targetRect.top + scrollY + targetRect.height / 2 - tooltipTop))}px`;
        arrowEl.style.transform = 'rotate(45deg)';
      } else {
        arrowEl.style.display = 'none';
      }
    }
  }

  // Center tooltip fallback in case element cannot be loaded
  function positionTooltipFallback(tooltipEl) {
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    const top = scrollY + (viewportHeight - tooltipRect.height) / 2;
    const left = scrollX + (viewportWidth - tooltipRect.width) / 2;

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.setAttribute('data-placement', 'center');

    const arrowEl = tooltipEl.querySelector('.tour-tooltip-arrow');
    if (arrowEl) arrowEl.style.display = 'none';
  }

  // Bind function to global context so dashboard triggers can trigger it
  window.startProductTour = startProductTour;
})();
