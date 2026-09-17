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


  /* Vacancy section */

  setSectionActive(
    vacancyFields,
    isVacancy
  );


  /* Update section */

  setSectionActive(
    updateFields,
    isUpdate
  );


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


/* -------------------------------------------------------
   RESET FORM
------------------------------------------------------- */

function resetEditor() {
  editingId = null;

  jobForm.reset();

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