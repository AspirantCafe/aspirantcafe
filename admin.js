'use strict';

const loginView = document.querySelector('#loginView');
const adminView = document.querySelector('#adminView');
const loginForm = document.querySelector('#loginForm');
const jobForm = document.querySelector('#jobForm');

const type = document.querySelector('#postType');
const vacancyFields = document.querySelector('#vacancyFields');
const updateFields = document.querySelector('#updateFields');

const message = document.querySelector('#formMessage');
const loginMessage = document.querySelector('#loginMessage');
const list = document.querySelector('#adminJobs');

let csrfToken = '';
let posts = [];
let editingId = null;
const postDetailsBody = document.querySelector('#postDetailsBody');
const addPostDetailButton = document.querySelector('#addPostDetail');
const importantDatesBody = document.querySelector('#importantDatesBody');
const addImportantDateButton = document.querySelector('#addImportantDate');
const feesBody = document.querySelector('#feesBody');
const addFeeButton = document.querySelector('#addFee');
const updateDetailsBody = document.querySelector('#updateDetailsBody');
const addUpdateDetailButton = document.querySelector('#addUpdateDetail');
const updateTypeNote = document.querySelector('#updateTypeNote');
const updateDetailsHeading = document.querySelector('#updateDetailsHeading');

const DEFAULT_DATE_EVENTS = [
  'Notification',
  'Application Start',
  'Last Date',
  'Fee Payment',
  'Correction',
  'Exam',
  'Other'
];
const DEFAULT_FEE_CATEGORIES = [
  'General/OBC',
  'SC/ST',
  'Female',
  'EWS',
  'PwBD'
];

function addImportantDateRow(item = {}) {
  if (!importantDatesBody) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" maxlength="120" placeholder="e.g. Application Start"></td>
    <td><input type="text" maxlength="250" placeholder="e.g. 15 Sep 2026 / To Be Announced"></td>
    <td><button type="button" class="remove-structured-row">Remove</button></td>
  `;
  const fields = row.querySelectorAll('input');
  fields[0].value = item.event || '';
  fields[1].value = item.value || '';
  row.querySelector('.remove-structured-row').addEventListener('click', () => {
    row.remove();
    if (!importantDatesBody.children.length) addImportantDateRow();
  });
  importantDatesBody.appendChild(row);
}

function resetImportantDates(items = null) {
  if (!importantDatesBody) return;
  importantDatesBody.innerHTML = '';
  const rows = Array.isArray(items) && items.length
    ? items
    : DEFAULT_DATE_EVENTS.map(event => ({ event, value: '' }));
  rows.forEach(addImportantDateRow);
}

function collectImportantDates() {
  if (!importantDatesBody) return [];
  return [...importantDatesBody.querySelectorAll('tr')].map(row => {
    const fields = row.querySelectorAll('input');
    return { event: fields[0]?.value || '', value: fields[1]?.value || '' };
  }).filter(item => item.event || item.value);
}

function addFeeRow(item = {}) {
  if (!feesBody) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" maxlength="120" placeholder="e.g. General/OBC"></td>
    <td><input type="text" maxlength="250" placeholder="e.g. ₹500 / As per notification"></td>
    <td><button type="button" class="remove-structured-row">Remove</button></td>
  `;
  const fields = row.querySelectorAll('input');
  fields[0].value = item.category || '';
  fields[1].value = item.value || '';
  row.querySelector('.remove-structured-row').addEventListener('click', () => {
    row.remove();
    if (!feesBody.children.length) addFeeRow();
  });
  feesBody.appendChild(row);
}

function resetFees(items = null) {
  if (!feesBody) return;
  feesBody.innerHTML = '';
  const rows = Array.isArray(items) && items.length
    ? items
    : DEFAULT_FEE_CATEGORIES.map(category => ({ category, value: '' }));
  rows.forEach(addFeeRow);
}

function collectFees() {
  if (!feesBody) return [];
  return [...feesBody.querySelectorAll('tr')].map(row => {
    const fields = row.querySelectorAll('input');
    return { category: fields[0]?.value || '', value: fields[1]?.value || '' };
  }).filter(item => item.category || item.value);
}

function parseStructuredJson(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const UPDATE_DETAIL_PRESETS = {
  'admit-card': [
    { field: 'Admit Card Release', value: '' },
    { field: 'Exam Date', value: '' },
    { field: 'Exam City / Centre', value: '' },
    { field: 'Other Information', value: '' }
  ],
  result: [
    { field: 'Result Date', value: '' },
    { field: 'Result Type / Stage', value: '' },
    { field: 'Scorecard / Marks', value: '' },
    { field: 'Other Information', value: '' }
  ],
  'answer-key': [
    { field: 'Answer Key Release', value: '' },
    { field: 'Objection Last Date', value: '' },
    { field: 'Answer Key Type', value: '' },
    { field: 'Other Information', value: '' }
  ]
};

function addUpdateDetailRow(item = {}) {
  if (!updateDetailsBody) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" maxlength="120" placeholder="e.g. Exam Date"></td>
    <td><textarea maxlength="500" rows="2" placeholder="e.g. 20 Oct 2026 / To Be Announced"></textarea></td>
    <td><button type="button" class="remove-structured-row">Remove</button></td>
  `;
  const input = row.querySelector('input');
  const textarea = row.querySelector('textarea');
  input.value = item.field || '';
  textarea.value = item.value || '';
  row.querySelector('.remove-structured-row').addEventListener('click', () => {
    row.remove();
    if (!updateDetailsBody.children.length) addUpdateDetailRow();
  });
  updateDetailsBody.appendChild(row);
}

function resetUpdateDetails(items = null, postType = type?.value || '') {
  if (!updateDetailsBody) return;
  updateDetailsBody.innerHTML = '';
  const rows = Array.isArray(items) && items.length
    ? items
    : (UPDATE_DETAIL_PRESETS[postType] || [{ field: 'Information', value: '' }]);
  rows.forEach(addUpdateDetailRow);
  updateDetailsBody.dataset.type = postType;
}

function collectUpdateDetails() {
  if (!updateDetailsBody) return [];
  return [...updateDetailsBody.querySelectorAll('tr')].map(row => ({
    field: row.querySelector('input')?.value || '',
    value: row.querySelector('textarea')?.value || ''
  })).filter(item => item.field || item.value);
}

function addPostDetailRow(detail = {}) {
  if (!postDetailsBody) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><textarea maxlength="250" rows="2" placeholder="e.g. Junior Engineer (Electrical)"></textarea></td>
    <td><textarea maxlength="200" rows="2" placeholder="e.g. 120"></textarea></td>
    <td><textarea maxlength="200" rows="2" placeholder="e.g. 18–32 Years"></textarea></td>
    <td><textarea maxlength="1000" rows="3" placeholder="e.g. Diploma/B.Tech in Electrical Engineering"></textarea></td>
    <td><button type="button" class="remove-post-detail">Remove</button></td>
  `;
  const fields = row.querySelectorAll('textarea');
  fields[0].value = detail.post_name || '';
  fields[1].value = detail.seats || '';
  fields[2].value = detail.age_limit || '';
  fields[3].value = detail.qualification || '';
  row.querySelector('.remove-post-detail').addEventListener('click', () => {
    row.remove();
    if (!postDetailsBody.children.length) addPostDetailRow();
  });
  postDetailsBody.appendChild(row);
}

function resetPostDetails(details = []) {
  if (!postDetailsBody) return;
  postDetailsBody.innerHTML = '';
  if (details.length) details.forEach(addPostDetailRow);
  else addPostDetailRow();
}

function collectPostDetails() {
  if (!postDetailsBody) return [];
  return [...postDetailsBody.querySelectorAll('tr')].map(row => {
    const fields = row.querySelectorAll('textarea');
    return { post_name: fields[0]?.value || '', seats: fields[1]?.value || '', age_limit: fields[2]?.value || '', qualification: fields[3]?.value || '' };
  });
}


const esc = (v = '') => {
  const el = document.createElement('span');
  el.textContent = v;
  return el.innerHTML;
};

const displayType = (v) => ({
  vacancy: 'Vacancy',
  'admit-card': 'Admit Card',
  result: 'Result',
  'answer-key': 'Answer Key',
  other: 'Other'
})[v] || v;

async function request(url, options = {}) {
  const headers = {
    ...(options.body
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {})
  };

  if (
    csrfToken &&
    options.method &&
    options.method !== 'GET'
  ) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin'
  });

  const payload =
    response.status === 204
      ? null
      : await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error || `Request failed (${response.status}).`
    );
  }

  return payload;
}


/* -------------------------------------------------------
   FORM HELPERS
------------------------------------------------------- */

function required(names, state) {
  names.forEach(name => {
    if (jobForm.elements[name]) {
      jobForm.elements[name].required = state;
    }
  });
}


function setSectionActive(section, active) {
  if (!section) return;

  section.hidden = !active;

  section
    .querySelectorAll('input, select, textarea')
    .forEach(field => {
      field.disabled = !active;

      if (!active && field.type !== 'file') {
        field.value = '';
      }
    });
}


/* -------------------------------------------------------
   POST TYPE CONTROL
------------------------------------------------------- */

function syncForm() {
  const current = type.value;
  
  const totalVacanciesLabel = document.querySelector('#totalVacanciesLabel');

if (totalVacanciesLabel) {
  totalVacanciesLabel.textContent =
    current === 'other' ? 'Seats' : 'Total Vacancies';
}

  const isVacancy = current === 'vacancy' || current === 'other';

  const isUpdate = [
    'admit-card',
    'result',
    'answer-key',
    'other'
  ].includes(current);

  const isSpecialUpdate = ['admit-card', 'result', 'answer-key'].includes(current);

  /* Vacancy section */

  setSectionActive(
    vacancyFields,
    isVacancy
  );


  /* Update section */

  setSectionActive(
    updateFields,
    isSpecialUpdate
  );

  if (!isSpecialUpdate && updateDetailsBody) {
    updateDetailsBody.dataset.type = '';
  }

  if (isSpecialUpdate) {
    const headings = {
      'admit-card': ['Admit Card Information', 'Enter admit-card-specific information such as release date, exam date and exam centre.'],
      result: ['Result Information', 'Enter result-specific information such as result date, stage and scorecard details.'],
      'answer-key': ['Answer Key Information', 'Enter answer-key-specific information such as release date, objection deadline and key type.']
    };
    const copy = headings[current];
    if (updateDetailsHeading) updateDetailsHeading.textContent = copy[0];
    if (updateTypeNote) updateTypeNote.textContent = copy[1];
    if (updateDetailsBody.dataset.type !== current) resetUpdateDetails(null, current);
  }


  /* Vacancy required fields */

  required(
  [
    'total_vacancies',
    'qualification',
    'age_limit',
    'application_start_date',
    'last_date',
    'application_fee',
    'apply_link'
  ],
  current === 'vacancy'
);


  /* Official link required for updates */

  required(
    ['content_link'],
    [
      'admit-card',
      'result',
      'answer-key'
    ].includes(current)
  );


  /* Vacancy PDF */

  const pdfField =
    jobForm.elements['notification_file'];

  if (pdfField) {
    pdfField.disabled = !isVacancy;
  }


  /* Apply link only required for vacancy */

  const applyLink =
    jobForm.elements['apply_link'];

  if (applyLink) {
    applyLink.required = isVacancy;
    applyLink.disabled = !isVacancy;
  }


  /* Dynamic labels */

  const labels = {
    'admit-card': [
      'Admit Card / Download Link',
      'Exam Date',
      'Enter the official admit card download link.'
    ],

    result: [
      'Result / Official Link',
      'Result Date',
      'Enter the official result link.'
    ],

    'answer-key': [
      'Answer Key / Official Link',
      'Release Date',
      'Enter the official answer-key link.'
    ],

    other: [
      'Official / Important Link',
      'Date',
      'Add only details relevant to this update.'
    ],

    vacancy: [
      'Official / Important Link',
      'Exam / Result Date',
      'Vacancy fields are required. Notification PDF is optional.'
    ]
  };


  const copy =
    labels[current] || labels.vacancy;


  const officialLabel =
    document.querySelector('#officialLinkLabel');

  const eventLabel =
    document.querySelector('#eventDateLabel');

  const typeHelp =
    document.querySelector('#typeHelp');


  if (officialLabel && officialLabel.firstChild) {
    officialLabel.firstChild.textContent =
      copy[0] + ' ';
  }

  if (eventLabel && eventLabel.firstChild) {
    eventLabel.firstChild.textContent =
      copy[1] + ' ';
  }

  if (typeHelp) {
    typeHelp.textContent = copy[2];
  }
}


if (addPostDetailButton) addPostDetailButton.addEventListener('click', () => addPostDetailRow());
if (addUpdateDetailButton) addUpdateDetailButton.addEventListener('click', () => addUpdateDetailRow());
resetPostDetails();

/* -------------------------------------------------------
   RESET FORM
------------------------------------------------------- */

function resetEditor() {
  resetImportantDates();
  resetFees();
  resetUpdateDetails(null, 'vacancy');
  editingId = null;

  jobForm.reset();
  resetPostDetails();

  type.value = 'vacancy';

  syncForm();

  document.querySelector('#formTitle').textContent =
    'Add information';

  jobForm.querySelector(
    'button[type=submit]'
  ).textContent =
    'Publish information';

  document.querySelector(
    '#cancelEdit'
  ).hidden = true;

  message.textContent = '';
}


/* -------------------------------------------------------
   LOAD POSTS
------------------------------------------------------- */

async function loadPosts() {
  posts = await request('/api/admin/posts');

  renderPosts();
}


/* -------------------------------------------------------
   RENDER POSTS
------------------------------------------------------- */

function renderPosts() {
  const searchInput =
    document.querySelector('#adminSearch');

  const filterInput =
    document.querySelector('#adminFilter');


  const term =
    searchInput.value
      .toLowerCase()
      .trim();

  const filter =
    filterInput.value;


  const visible = posts.filter(post => {

    const matchesFilter =
      !filter ||
      post.post_type === filter;


    const searchableText = `
      ${post.organization || ''}
      ${post.title || ''}
      ${post.description || ''}
    `.toLowerCase();


    return (
      matchesFilter &&
      searchableText.includes(term)
    );
  });


  list.innerHTML = visible.length
    ? visible.map(post => `
        <article>

          <div>
            <strong>
              ${esc(post.title)}
            </strong>

            <span>
              ${esc(displayType(post.post_type))}
              ·
              ${esc(post.organization)}
            </span>
          </div>

          <div class="job-actions">

            <button
              class="edit-job"
              data-id="${post.id}"
              type="button"
            >
              Edit
            </button>

            <button
              class="delete-job"
              data-id="${post.id}"
              type="button"
            >
              Remove
            </button>

          </div>

        </article>
      `).join('')
    : '<p class="empty-jobs">No matching posts.</p>';


  list
    .querySelectorAll('.edit-job')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const post =
            posts.find(
              p =>
                p.id ===
                Number(button.dataset.id)
            );

          if (post) {
            edit(post);
          }
        }
      );

    });


  list
    .querySelectorAll('.delete-job')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {
          remove(
            Number(button.dataset.id)
          );
        }
      );

    });
}


/* -------------------------------------------------------
   EDIT POST
------------------------------------------------------- */

function edit(post) {
  editingId = post.id;

  jobForm.reset();
  resetPostDetails(post.post_details || []);
  const legacyDates = [
    post.application_start_date ? { event: 'Application Start', value: post.application_start_date } : null,
    post.last_date ? { event: 'Last Date', value: post.last_date } : null,
    post.event_date ? { event: 'Exam', value: post.event_date } : null
  ].filter(Boolean);
  resetImportantDates(parseStructuredJson(post.important_dates).length ? parseStructuredJson(post.important_dates) : legacyDates);
  const legacyFees = post.application_fee ? [{ category: 'General/OBC', value: post.application_fee }] : [];
  resetFees(parseStructuredJson(post.application_fees).length ? parseStructuredJson(post.application_fees) : legacyFees);
  resetUpdateDetails(parseStructuredJson(post.update_details), post.post_type);


  Object.entries(post).forEach(
    ([key, value]) => {

      const field =
        jobForm.elements[key];

      if (
        field &&
        value !== null &&
        value !== undefined
      ) {
        field.value = value;
      }

    }
  );


  type.value = post.post_type || 'vacancy';

  syncForm();


  document.querySelector(
    '#formTitle'
  ).textContent =
    `Edit: ${post.title}`;


  jobForm.querySelector(
    'button[type=submit]'
  ).textContent =
    'Save changes';


  document.querySelector(
    '#cancelEdit'
  ).hidden = false;


  document.querySelector(
    '#add-job'
  ).scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


/* -------------------------------------------------------
   DELETE POST
------------------------------------------------------- */

async function remove(id) {
  const post =
    posts.find(
      item => item.id === id
    );

  if (!post) return;


  if (
    !confirm(
      `Remove “${post.title}”? This cannot be undone.`
    )
  ) {
    return;
  }


  try {

    await request(
      `/api/admin/posts/${id}`,
      {
        method: 'DELETE'
      }
    );

    await loadPosts();

  } catch (error) {

    message.textContent =
      error.message;

  }
}


/* -------------------------------------------------------
   PDF UPLOAD
------------------------------------------------------- */

async function uploadPdf(file) {

  if (type.value !== 'vacancy') {
    return null;
  }


  if (!file) {

    if (editingId) {

      const existing =
        posts.find(
          post =>
            post.id === editingId
        );

      return existing
        ? existing.notification_pdf
        : null;
    }

    return null;
  }


  if (
    file.type !== 'application/pdf' ||
    file.size > 5 * 1024 * 1024
  ) {
    throw new Error(
      'Notification PDF must be a PDF no larger than 5 MB.'
    );
  }


  const data =
    await new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();

        reader.onload = () =>
          resolve(reader.result);

        reader.onerror =
          reject;

        reader.readAsDataURL(file);
      }
    );


  const result =
    await request(
      '/api/admin/uploads',
      {
        method: 'POST',
        body: JSON.stringify({
          data
        })
      }
    );


  return result.path;
}


/* -------------------------------------------------------
   LOGIN
------------------------------------------------------- */

loginForm.addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    loginMessage.textContent = '';


    try {

      const data =
        await request(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify(
              Object.fromEntries(
                new FormData(loginForm)
              )
            )
          }
        );


      csrfToken =
        data.csrfToken;


      showAdmin();

    } catch (error) {

      loginMessage.textContent =
        error.message;

    }
  }
);


/* -------------------------------------------------------
   SAVE / PUBLISH POST
------------------------------------------------------- */

jobForm.addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    message.textContent = '';


    try {

      const data =
        Object.fromEntries(
          new FormData(jobForm)
        );


      delete data.notification_file;
      data.post_details = collectPostDetails();
      data.important_dates = collectImportantDates();
      data.application_fees = collectFees();
      data.update_details = collectUpdateDetails();


      const file =
        jobForm.elements.notification_file
          ? jobForm.elements.notification_file.files[0]
          : null;


      data.notification_pdf =
        await uploadPdf(file);


      const url =
        editingId
          ? `/api/admin/posts/${editingId}`
          : '/api/admin/posts';


      await request(
        url,
        {
          method:
            editingId
              ? 'PUT'
              : 'POST',

          body:
            JSON.stringify(data)
        }
      );


      await loadPosts();


      resetEditor();


      message.textContent =
        'Information saved successfully.';


    } catch (error) {

      message.textContent =
        error.message;

    }
  }
);


/* -------------------------------------------------------
   BUTTONS / FILTERS
------------------------------------------------------- */

document
  .querySelector('#cancelEdit')
  .addEventListener(
    'click',
    resetEditor
  );


type.addEventListener(
  'change',
  syncForm
);


addPostDetailButton?.addEventListener('click', () => addPostDetailRow());
addImportantDateButton?.addEventListener('click', () => addImportantDateRow());
addFeeButton?.addEventListener('click', () => addFeeRow());




document
  .querySelector('#adminSearch')
  .addEventListener(
    'input',
    renderPosts
  );


document
  .querySelector('#adminFilter')
  .addEventListener(
    'change',
    renderPosts
  );


/* -------------------------------------------------------
   LOGOUT
------------------------------------------------------- */

document
  .querySelector('#logoutButton')
  .addEventListener(
    'click',
    async () => {

      try {

        await request(
          '/api/auth/logout',
          {
            method: 'POST'
          }
        );

      } finally {

        csrfToken = '';

        adminView.hidden = true;

        loginView.hidden = false;

        document.querySelector(
          '#logoutButton'
        ).hidden = true;

        loginForm.reset();

      }
    }
  );


/* -------------------------------------------------------
   SHOW ADMIN
------------------------------------------------------- */

resetImportantDates();
resetFees();

async function showAdmin() {

  loginView.hidden = true;

  adminView.hidden = false;

  document.querySelector(
    '#logoutButton'
  ).hidden = false;


  syncForm();


  await loadPosts();
}


/* -------------------------------------------------------
   SESSION CHECK
------------------------------------------------------- */

(async () => {

  try {

    const session =
      await request(
        '/api/auth/session'
      );


    if (session.authenticated) {

      csrfToken =
        session.csrfToken;

      await showAdmin();

    } else {

      syncForm();

    }

  } catch {

    loginMessage.textContent =
      'Unable to check sign-in status.';

  }

})();