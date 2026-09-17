'use strict';
const targets = { vacancy: ['#currentGrid', '#currentEmpty'], 'answer-key': ['#answerKeyGrid', '#answerKeyEmpty'], 'admit-card': ['#admitCardGrid', '#admitCardEmpty'], result: ['#resultGrid', '#resultEmpty'], other: ['#upcomingGrid', '#upcomingEmpty'] };
const labels = { vacancy: 'Vacancy', 'admit-card': 'Admit Card', result: 'Result', 'answer-key': 'Answer Key', other: 'Admission' };
const esc = (v = '') => { const element = document.createElement('span'); element.textContent = v; return element.innerHTML; };
const date = value => {
  if (!value) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  return value;
};
let posts = [];
let selectedCategory = '';
function detail(label, value) { return value ? `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>` : ''; }
function card(post) {
  const isVacancy = post.post_type === 'vacancy' || post.post_type === 'other';
  const link = post.content_link || post.apply_link;

  const action = isVacancy
    ? `<button class="details-button" data-id="${post.id}">View details</button>`
    : link
      ? `<a class="check-link" href="${esc(link)}" target="_blank" rel="noopener">${post.post_type === 'admit-card' ? 'Download card' : 'Open official link'}</a>`
      : '';

  const metadata = isVacancy
    ? detail('Vacancies', post.total_vacancies) +
      detail('Qualification', post.qualification) +
      detail('Last date', date(post.last_date))
    : detail(
        post.post_type === 'result' ? 'Result date' : 'Exam date',
        date(post.event_date)
      );

  return `
    <article
      class="vacancy-card clickable-card"
      data-id="${post.id}"
      data-search="${esc(`${post.title} ${post.organization} ${post.description || ''}`.toLowerCase())}"
    >
      <div class="card-top">
        <span class="tag government">${esc(labels[post.post_type])}</span>
        ${isVacancy && post.last_date ? `<span class="deadline">Closes ${date(post.last_date)}</span>` : ''}
      </div>

      <h3>${esc(post.title)}</h3>
      <p class="organisation">${esc(post.organization)}</p>

      ${metadata ? `<dl>${metadata}</dl>` : ''}
      ${post.description ? `<p class="card-description">${esc(post.description)}</p>` : ''}

      ${action}
    </article>
  `;
}
const PAGE_SIZE = 10;

function render() {
  Object.values(targets).forEach(([grid, empty]) => {
    const gridEl = document.querySelector(grid);
    const emptyEl = document.querySelector(empty);

    if (gridEl) gridEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = true;
  });

  document.querySelectorAll('.read-more').forEach(btn => btn.remove());

  const grouped = {};

  Object.keys(targets).forEach(key => {
    grouped[key] = [];
  });

  posts.forEach(post => {
  const key = targets[post.post_type] ? post.post_type : 'other';

  // Category chips only filter Current Vacancies.
  if (key === 'vacancy' && selectedCategory) {
    if ((post.category || '').toLowerCase() !== selectedCategory) {
      return;
    }
  }

  grouped[key].push(post);
});

  Object.entries(targets).forEach(([key, [grid, empty]]) => {
    const gridEl = document.querySelector(grid);
    const emptyEl = document.querySelector(empty);
    const items = grouped[key] || [];

    if (!gridEl) return;

    items.slice(0, PAGE_SIZE).forEach(post => {
      gridEl.insertAdjacentHTML('beforeend', card(post));
    });

    if (items.length > PAGE_SIZE) {
      const button = document.createElement('button');
      button.className = 'read-more';
      button.textContent = `Read More (${items.length - PAGE_SIZE})`;

      button.addEventListener('click', () => {
        items.slice(PAGE_SIZE).forEach(post => {
          gridEl.insertAdjacentHTML('beforeend', card(post));
        });

        button.remove();
      });

      gridEl.after(button);
    }

    if (emptyEl) {
      emptyEl.hidden = items.length !== 0;
    }
  });

  const counts = Object.fromEntries(
    Object.keys(targets).map(key => [key, grouped[key].length])
  );

  Object.entries(counts).forEach(([key, count]) => {
    const badge = document.querySelector(`[data-count="${key}"]`);
    if (badge) badge.textContent = count;
  });
}
function applySearch() {
  const term = document.querySelector('#search').value.toLowerCase().trim();
  let shown = 0;

  document.querySelectorAll('.vacancy-card').forEach(item => {
    const visible = !term || item.dataset.search.includes(term);
    item.hidden = !visible;

    if (visible) shown += 1;
  });

  const noResults = document.querySelector('#noResults');

  if (noResults) {
    noResults.hidden = !term || shown !== 0;
  }
}
function bindDetails() {
  document.querySelectorAll('.details-button').forEach(button => {
    button.addEventListener('click', () => {
      openModal(posts.find(post => post.id === Number(button.dataset.id)));
    });
  });

  document.querySelectorAll('.clickable-card').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('a, button')) return;

      const post = posts.find(item => item.id === Number(card.dataset.id));
      if (post) openModal(post);
    });
  });
}
function openModal(post) {
  const modal = document.querySelector('#jobModal');
  const title = document.querySelector('#modalTitle');
  const organisation = document.querySelector('#modalOrganisation');
  const details = document.querySelector('#modalDetails');
  const links = document.querySelector('#modalLinks');

  if (!modal || !title || !organisation || !details || !links || !post) return;

  title.textContent = post.title || '';
  organisation.textContent = post.organization || '';

  const importantDates = [];
  if (post.application_start_date) {
    importantDates.push(`<tr><td>Application Start Date</td><td><strong>${esc(date(post.application_start_date))}</strong></td></tr>`);
  }
  if (post.last_date) {
    importantDates.push(`<tr><td>Last Date to Apply</td><td><strong>${esc(date(post.last_date))}</strong></td></tr>`);
  }
  if (post.event_date) {
    importantDates.push(`<tr><td>Event / Exam Date</td><td><strong>${esc(date(post.event_date))}</strong></td></tr>`);
  }

  const datesSection = `
    <section class="detail-section section-dates">
      <h3><span class="section-icon">▦</span> IMPORTANT DATES</h3>
      ${importantDates.length ? `
        <table class="detail-table compact-table">
          <thead><tr><th>Event</th><th>Date</th></tr></thead>
          <tbody>${importantDates.join('')}</tbody>
        </table>
      ` : '<p class="detail-empty">No date information available.</p>'}
    </section>
  `;

  const feeSection = `
    <section class="detail-section section-fee">
      <h3><span class="section-icon">▤</span> APPLICATION FEE</h3>
      ${post.application_fee ? `
        <table class="detail-table compact-table single-value-table">
          <thead><tr><th>Application Fee</th><th>Details</th></tr></thead>
          <tbody><tr><td>Fee</td><td>${esc(post.application_fee)}</td></tr></tbody>
        </table>
      ` : '<p class="detail-empty">No application fee information available.</p>'}
    </section>
  `;

  const ageSection = `
    <section class="detail-section section-age">
      <h3><span class="section-icon">♟</span> AGE LIMIT</h3>
      ${post.age_limit ? `
        <table class="detail-table compact-table single-value-table">
          <thead><tr><th>Age Limit</th><th>Details</th></tr></thead>
          <tbody><tr><td>Age Limit</td><td><strong>${esc(post.age_limit)}</strong></td></tr></tbody>
        </table>
      ` : '<p class="detail-empty">No age information available.</p>'}
    </section>
  `;

  const qualification = post.qualification || post.educational_qualification || '';
  const eligibilitySection = `
    <section class="detail-section section-eligibility">
      <h3><span class="section-icon">▰</span> ELIGIBILITY DETAILS</h3>
      ${qualification ? `
        <table class="detail-table compact-table single-value-table">
          <thead><tr><th>Criteria</th><th>Details</th></tr></thead>
          <tbody><tr><td>Educational Qualification</td><td>${esc(qualification)}</td></tr></tbody>
        </table>
      ` : '<p class="detail-empty">No eligibility information available.</p>'}
    </section>
  `;

  const vacancySection = `
    <section class="detail-section full-width section-vacancy">
      <h3><span class="section-icon">♟</span> VACANCY DETAILS</h3>
      <table class="detail-table compact-table vacancy-table">
        <thead>
  <tr>
    <th>Organization</th>
    <th>Post Name</th>
    <th>${post.post_type === 'other' ? 'Seats' : 'Total Vacancies'}</th>
  </tr>
</thead>
        <tbody>
          <tr>
            <td>${esc(post.organization || '')}</td>
            <td>${esc(post.title || '')}</td>
            <td>${esc(post.total_vacancies || 'Not specified')}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;

  const selectionSection = post.selection_process ? `
    <section class="detail-section section-selection">
      <h3><span class="section-icon">⚙</span> SELECTION PROCESS</h3>
      <div class="detail-description">${esc(post.selection_process)}</div>
    </section>
  ` : '';

  const howToApplySection = post.how_to_apply ? `
    <section class="detail-section section-apply">
      <h3><span class="section-icon">▤</span> HOW TO APPLY</h3>
      <div class="detail-description">${esc(post.how_to_apply)}</div>
    </section>
  ` : '';

  const linkRows = [];
  if (post.notification_pdf) {
    linkRows.push(`<tr><td>Official Notification</td><td><a href="${esc(post.notification_pdf)}" target="_blank" rel="noopener">View PDF</a></td></tr>`);
  }
  if (post.apply_link) {
    linkRows.push(`<tr><td>Apply Online</td><td><a href="${esc(post.apply_link)}" target="_blank" rel="noopener">Apply Now</a></td></tr>`);
  }
  if (post.content_link) {
    linkRows.push(`<tr><td>Official Website</td><td><a href="${esc(post.content_link)}" target="_blank" rel="noopener">Visit Website</a></td></tr>`);
  }

  const linksSection = linkRows.length ? `
    <section class="detail-section section-links">
      <h3><span class="section-icon">↗</span> IMPORTANT LINKS</h3>
      <table class="detail-table compact-table links-table">
        <thead><tr><th>Link Name</th><th>Action</th></tr></thead>
        <tbody>${linkRows.join('')}</tbody>
      </table>
    </section>
  ` : '';

  const noteSection = post.important_note ? `
    <section class="detail-section section-note">
      <h3><span class="section-icon">!</span> IMPORTANT NOTE</h3>
      <div class="detail-description">${esc(post.important_note)}</div>
    </section>
  ` : '';

  details.innerHTML = `
    ${post.description ? `
      <section class="detail-section full-width section-intro">
        <h3><span class="section-icon">▣</span> SHORT INTRODUCTION</h3>
        <div class="detail-description">${esc(post.description)}</div>
      </section>
    ` : ''}

    <div class="detail-columns">${datesSection}${feeSection}</div>
    <div class="detail-columns">${ageSection}${eligibilitySection}</div>
    ${vacancySection}

    ${selectionSection || howToApplySection ? `<div class="detail-columns">${selectionSection}${howToApplySection}</div>` : ''}
    ${linksSection || noteSection ? `<div class="detail-columns">${linksSection}${noteSection}</div>` : ''}
  `;

  links.innerHTML = '';
  modal.showModal();
}
document.querySelector('#searchButton').addEventListener('click', applySearch);
document.querySelector('#search').addEventListener('input', applySearch);

document.querySelectorAll('.ac-chips a[data-category]').forEach(link => {
  link.addEventListener('click', () => {
    selectedCategory = link.dataset.category || '';
    render();
    bindDetails();
  });
});
document.querySelectorAll('a[href="#current"]:not([data-category])').forEach(link => {
  link.addEventListener('click', () => {
    selectedCategory = '';
    render();
    bindDetails();
  });
});
document.querySelectorAll('#jobModal .close, #jobModal .modal-bottom-close').forEach(button => button.addEventListener('click', () => document.querySelector('#jobModal')?.close()));
fetch('/api/posts').then(response => response.ok ? response.json() : Promise.reject()).then(data => { posts = data;
render();
bindDetails(); }).catch(() => { document.querySelector('#currentEmpty').hidden = false; document.querySelector('#currentEmpty').textContent = 'Updates are temporarily unavailable. Please try again shortly.'; });
// Notification signup popup
const notificationDialog = document.querySelector('#notificationDialog');
const notificationForm = document.querySelector('#notificationForm');
const notificationLater = document.querySelector('#notificationLater');
const notificationEmail = document.querySelector('#notificationEmail');
const notificationMessage = document.querySelector('#notificationMessage');

function showNotificationPopup() {
  if (!notificationDialog) return;

  // Do not show again after successful signup.
  if (localStorage.getItem('notificationSignupDone') === 'true') return;

  // "Later" only hides the popup temporarily.
  const laterUntil = Number(localStorage.getItem('notificationLaterUntil') || 0);

  if (laterUntil > Date.now()) return;

  notificationDialog.showModal();
}

notificationLater?.addEventListener('click', () => {
  // Don't show again for the next 24 hours.
  localStorage.setItem(
    'notificationLaterUntil',
    String(Date.now() + 24 * 60 * 60 * 1000)
  );

  notificationDialog.close();
});

notificationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = notificationEmail.value.trim().toLowerCase();

  if (!email) return;

  notificationMessage.textContent = 'Signing you up...';

  const button = notificationForm.querySelector('.notification-signup');
  button.disabled = true;

  try {
    const response = await fetch('/api/notifications/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to sign up.');
    }

    // Remember successful signup on this device.
    localStorage.setItem('notificationSignupDone', 'true');

    // Remove any previous Later setting.
    localStorage.removeItem('notificationLaterUntil');

    notificationMessage.textContent =
      '✓ You are subscribed to vacancy notifications.';

    setTimeout(() => {
      notificationDialog.close();
    }, 1200);

  } catch (error) {
    notificationMessage.textContent =
      error.message || 'Unable to complete signup. Please try again.';
  } finally {
    button.disabled = false;
  }
});

// Open the signup popup after the page loads.
setTimeout(showNotificationPopup, 800);

// AspirantCafe sidebar subscription shortcut
document.querySelector('#sidebarSubscribe')?.addEventListener('click', () => {
  const value = document.querySelector('#sidebarNotificationEmail')?.value.trim();
  const email = document.querySelector('#notificationEmail');
  const msg = document.querySelector('#sidebarMessage');
  if (!value) { if (msg) msg.textContent = 'Enter your email address.'; return; }
  if (email) email.value = value;
  document.querySelector('#notificationDialog')?.showModal();
});
