/* =========================================================================
   tasks.js - the study task manager (create, read, update, delete)
   Author: Yuhao Wang (INFO 1012, Assessment 3.1)

   Design decisions, kept here so the code and the report agree:
   - Data lives in localStorage under one key, so the list survives a reload
     but never leaves the device (see the ethics page).
   - Every task is a plain object: id, title, courseCode, courseName, dueDate
     (stored as an ISO string "YYYY-MM-DD"), description, notes, createdAt.
   - All user input is validated before it is stored, and every message is
     written in terms of what the user can do next.
   - Rows are built with createElement + textContent rather than innerHTML so
     a task title containing "<" or "&" can never be treated as markup.
   ========================================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'studydeck.tasks.v1';
  var SEED_KEY = 'studydeck.seeded.v1';
  var DAY_MS = 24 * 60 * 60 * 1000;
  var SOON_DAYS = 3; // "due soon" window, in days

  var tasks = [];
  var editingId = null;

  var el = {};

  /* ------------------------------------------------------------------ */
  /* Date helpers                                                        */
  /* ------------------------------------------------------------------ */

  /** Pads a number to two digits, e.g. 3 -> "03". */
  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
  }

  /** Formats a Date object as a local ISO date string "YYYY-MM-DD". */
  function toISODate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  /** Today, in the user's own time zone, as "YYYY-MM-DD". */
  function todayISO() {
    return toISODate(new Date());
  }

  /**
   * Strictly parses "YYYY-MM-DD".
   * Returns a Date at local midnight, or null when the text is not a real
   * calendar date. The round-trip check rejects values like 2026-02-31, which
   * the Date constructor would silently roll over to 3 March.
   */
  function parseISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    var parts = value.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (date.getFullYear() !== parts[0] ||
        date.getMonth() !== parts[1] - 1 ||
        date.getDate() !== parts[2]) {
      return null;
    }
    return date;
  }

  /**
   * Whole days between today and an ISO date: negative = overdue,
   * 0 = due today, positive = still ahead.
   */
  function daysFromToday(isoDate) {
    var target = parseISODate(isoDate);
    if (!target) {
      return null;
    }
    var now = new Date();
    var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - midnight.getTime()) / DAY_MS);
  }

  /** Human readable due date, e.g. "Fri 13 Nov 2026". */
  function formatDueDate(isoDate) {
    var date = parseISODate(isoDate);
    if (!date) {
      return isoDate;
    }
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /* ------------------------------------------------------------------ */
  /* Storage                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Reads the saved list. Any corrupted value is treated as "no data" instead
   * of letting JSON.parse throw and take the whole page down.
   */
  function loadTasks() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return [];
    }
    if (!raw) {
      return [];
    }
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(function (item) {
        return item && typeof item.title === 'string' && typeof item.dueDate === 'string';
      });
    } catch (error) {
      return [];
    }
  }

  /** Writes the list back. Returns false when storage is unavailable. */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      showFormStatus('The browser refused to save. Free some space in this browser and try again.', 'error');
      return false;
    }
  }

  /** A stable, readable id: time stamp plus a random suffix. */
  function makeId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * The first visit starts with three examples so the table is not empty on the
   * assessor's screen. They are ordinary tasks: editable and deletable.
   */
  function seedExamples() {
    var now = new Date();
    var keys = ['info1012', 'data', 'math'];

    function offset(days) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
      return toISODate(d);
    }

    return [
      {
        id: makeId() + 'a',
        title: 'Finish the Assessment 3.1 portfolio site',
        courseCode: 'INFO1012',
        courseName: 'Information Technology Systems',
        dueDate: offset(4),
        description: 'Complete the home page, task manager, project blog and ethics page, then export the ZIP.',
        notes: 'Check every link before exporting.',
        createdAt: keys[0] + Date.now()
      },
      {
        id: makeId() + 'b',
        title: 'Week 7 JavaScript exercises',
        courseCode: 'INFO1012',
        courseName: 'Information Technology Systems',
        dueDate: offset(2),
        description: 'Work through the DOM exercises and commit each completed exercise separately.',
        notes: 'Studio 6, slide 28 has the reference examples.',
        createdAt: keys[1] + Date.now()
      },
      {
        id: makeId() + 'c',
        title: 'Revise graph traversal for the data structures quiz',
        courseCode: 'COMP2011',
        courseName: 'Data Structures',
        dueDate: offset(11),
        description: 'Breadth-first and depth-first traversal, plus two practice questions.',
        notes: '',
        createdAt: keys[2] + Date.now()
      }
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Status and rendering                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Classifies a task by its distance from today.
   * @returns {{key:string, label:string, className:string}}
   */
  function statusOf(task) {
    var days = daysFromToday(task.dueDate);
    if (days === null) {
      return { key: 'unknown', label: 'No date', className: 'badge--done' };
    }
    if (days < 0) {
      return { key: 'overdue', label: 'Overdue', className: 'badge--overdue' };
    }
    if (days === 0) {
      return { key: 'soon', label: 'Due today', className: 'badge--soon' };
    }
    if (days <= SOON_DAYS) {
      return { key: 'soon', label: 'Due in ' + days + ' d', className: 'badge--soon' };
    }
    return { key: 'open', label: 'Upcoming', className: 'badge--upcoming' };
  }

  /** Sort: earliest due date first, then title, so the next action is on top. */
  function compareByDue(a, b) {
    if (a.dueDate < b.dueDate) { return -1; }
    if (a.dueDate > b.dueDate) { return 1; }
    return a.title.localeCompare(b.title);
  }

  /** Applies the toolbar filter to one task. */
  function matchesFilter(task) {
    var filter = el.filterSelect.value;
    if (filter === 'all') {
      return true;
    }
    var days = daysFromToday(task.dueDate);
    if (days === null) {
      return false;
    }
    if (filter === 'overdue') {
      return days < 0;
    }
    if (filter === 'soon') {
      return days >= 0 && days <= SOON_DAYS;
    }
    if (filter === 'open') {
      return days >= 0;
    }
    return true;
  }

  /** Builds one table row for a task. */
  function buildRow(task) {
    var status = statusOf(task);
    var row = document.createElement('tr');
    row.setAttribute('data-task-id', task.id);

    // Column 1: title plus the first line of the description.
    var titleCell = document.createElement('td');
    var title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;
    titleCell.appendChild(title);

    var note = document.createElement('span');
    note.className = 'task-note';
    note.textContent = task.description;
    titleCell.appendChild(note);
    row.appendChild(titleCell);

    // Column 2: course code above course name.
    var courseCell = document.createElement('td');
    var code = document.createElement('span');
    code.className = 'task-title';
    code.textContent = task.courseCode;
    courseCell.appendChild(code);
    var courseName = document.createElement('span');
    courseName.className = 'task-note';
    courseName.textContent = task.courseName;
    courseCell.appendChild(courseName);
    row.appendChild(courseCell);

    // Column 3: the due date.
    var dueCell = document.createElement('td');
    dueCell.textContent = formatDueDate(task.dueDate);
    row.appendChild(dueCell);

    // Column 4: the status badge.
    var statusCell = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'badge ' + status.className;
    badge.textContent = status.label;
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    // Column 5: edit and delete actions.
    var actionCell = document.createElement('td');
    var actions = document.createElement('div');
    actions.className = 'row-actions';

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--ghost btn--small';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('data-action', 'edit');
    editBtn.setAttribute('data-id', task.id);
    actions.appendChild(editBtn);

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn--danger btn--small';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.setAttribute('data-id', task.id);
    actions.appendChild(deleteBtn);

    actionCell.appendChild(actions);
    row.appendChild(actionCell);

    return row;
  }

  /**
   * Draws the whole table.
   * The tbody is cleared first: appending rows without clearing is what
   * produced the duplicated rows logged as error 2 on the project blog.
   */
  function render() {
    var list = tasks.slice().sort(compareByDue).filter(matchesFilter);

    // Clear previous rows (replaceChildren keeps the DOM in step with state).
    el.taskTableBody.replaceChildren();

    list.forEach(function (task) {
      el.taskTableBody.appendChild(buildRow(task));
    });

    el.emptyState.hidden = list.length > 0;
    el.taskCount.textContent = list.length + (list.length === 1 ? ' task' : ' tasks');

    // If the task being edited was filtered out, keep the form usable but warn.
    if (editingId && !tasks.some(function (t) { return t.id === editingId; })) {
      resetForm();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Form: validation, create, update                                    */
  /* ------------------------------------------------------------------ */

  var FIELD_ERRORS = {
    taskTitle: 'taskTitleError',
    courseCode: 'courseCodeError',
    courseName: 'courseNameError',
    dueDate: 'dueDateError',
    taskDescription: 'taskDescriptionError',
    taskNotes: 'taskNotesError'
  };

  /** Marks one field invalid and writes its message, or clears it. */
  function setFieldError(fieldId, message) {
    var input = el[fieldId];
    var box = document.getElementById(FIELD_ERRORS[fieldId]);
    if (!input || !box) {
      return;
    }
    box.textContent = message || '';
    if (message) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  }

  function clearAllErrors() {
    Object.keys(FIELD_ERRORS).forEach(function (fieldId) {
      setFieldError(fieldId, '');
    });
  }

  function showFormStatus(message, kind) {
    el.formStatus.textContent = message;
    el.formStatus.className = 'form-status form-status--' + (kind === 'ok' ? 'ok' : 'error');
  }

  /** Shows a neutral state: no message at all. */
  function clearFormStatus() {
    el.formStatus.textContent = '';
    el.formStatus.className = 'form-status';
  }

  /**
   * Validates the form and returns either the clean task data or null.
   * Rules follow specification 2.2.2: required fields cannot be empty, and
   * invalid or past dates are rejected.
   */
  function readForm() {
    clearAllErrors();

    var data = {
      title: el.taskTitle.value.trim(),
      courseCode: el.courseCode.value.trim().toUpperCase(),
      courseName: el.courseName.value.trim(),
      dueDate: el.dueDate.value,
      description: el.taskDescription.value.trim(),
      notes: el.taskNotes.value.trim()
    };

    var problems = 0;
    var firstInvalid = null;

    /** Records a problem on a field and remembers the first one for focus. */
    function fail(fieldId, message) {
      setFieldError(fieldId, message);
      problems += 1;
      if (!firstInvalid) {
        firstInvalid = fieldId;
      }
    }

    if (!data.title) {
      fail('taskTitle', 'A task title is required.');
    } else if (data.title.length < 3) {
      fail('taskTitle', 'Use at least 3 characters so the task is recognisable.');
    } else if (data.title.length > 80) {
      fail('taskTitle', 'Keep the title under 80 characters.');
    }

    if (!data.courseCode) {
      fail('courseCode', 'A course code is required.');
    } else if (!/^[A-Z]{4}\d{4}$/.test(data.courseCode)) {
      fail('courseCode', 'Use four letters followed by four digits, for example INFO1012.');
    }

    if (!data.courseName) {
      fail('courseName', 'A course name is required.');
    } else if (data.courseName.length < 2) {
      fail('courseName', 'The course name is too short.');
    }

    if (!data.dueDate) {
      fail('dueDate', 'A due date is required.');
    } else if (!parseISODate(data.dueDate)) {
      fail('dueDate', 'That is not a real calendar date. Pick a date using the date picker.');
    } else {
      var days = daysFromToday(data.dueDate);
      if (days < 0) {
        fail('dueDate', 'The due date cannot be in the past. Choose today or a later date.');
      }
    }

    if (!data.description) {
      fail('taskDescription', 'A short description is required so future-you knows what to do.');
    } else if (data.description.length < 5) {
      fail('taskDescription', 'Describe the task in at least 5 characters.');
    }

    if (data.notes.length > 200) {
      fail('taskNotes', 'Keep notes under 200 characters.');
    }

    if (problems > 0) {
      showFormStatus('Please fix ' + problems + ' highlighted ' + (problems === 1 ? 'field' : 'fields') + ' before saving.', 'error');
      if (firstInvalid && el[firstInvalid]) {
        el[firstInvalid].focus();
      }
      return null;
    }

    clearFormStatus();
    return data;
  }

  /** Puts the form back into "create" mode. */
  function resetForm() {
    editingId = null;
    el.editingId.value = '';
    el.taskForm.reset();
    clearAllErrors();
    clearFormStatus();
    el.workspaceTitle.textContent = 'New study task';
    el.saveTaskBtn.textContent = 'Save task';
    el.cancelEditBtn.hidden = true;
  }

  /** Loads one task into the form for editing. */
  function startEdit(id) {
    var task = tasks.find(function (t) { return t.id === id; });
    if (!task) {
      return;
    }
    editingId = task.id;
    el.editingId.value = task.id;
    el.taskTitle.value = task.title;
    el.courseCode.value = task.courseCode;
    el.courseName.value = task.courseName;
    el.dueDate.value = task.dueDate;
    el.taskDescription.value = task.description;
    el.taskNotes.value = task.notes;

    clearAllErrors();
    clearFormStatus();
    el.workspaceTitle.textContent = 'Edit study task';
    el.saveTaskBtn.textContent = 'Save changes';
    el.cancelEditBtn.hidden = false;

    // Move focus to the form so keyboard users land in the right place.
    el.taskTitle.focus();
    el.taskForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------ */
  /* Create, update, delete                                              */
  /* ------------------------------------------------------------------ */

  function handleSubmit(event) {
    event.preventDefault();
    var data = readForm();
    if (!data) {
      return;
    }

    if (editingId) {
      var updated = tasks.find(function (t) { return t.id === editingId; });
      if (updated) {
        Object.assign(updated, data, { updatedAt: new Date().toISOString() });
        saveTasks();
        showFormStatus('Saved the changes to "' + data.title + '".', 'ok');
      }
      resetForm();
      render();
      return;
    }

    tasks.push({
      id: makeId(),
      title: data.title,
      courseCode: data.courseCode,
      courseName: data.courseName,
      dueDate: data.dueDate,
      description: data.description,
      notes: data.notes,
      createdAt: new Date().toISOString()
    });
    saveTasks();
    resetForm();
    render();
    showFormStatus('Added "' + data.title + '". It is now in the list on the right.', 'ok');
  }

  /**
   * Deletes one task, but only after the user confirms it in a dialog box
   * (explicit requirement in specification 2.2.2).
   */
  function handleDelete(id) {
    var task = tasks.find(function (t) { return t.id === id; });
    if (!task) {
      return;
    }
    var confirmed = window.confirm(
      'Delete "' + task.title + '"?\n\nThis removes the task from this device and cannot be undone.'
    );
    if (!confirmed) {
      showFormStatus('Deletion cancelled. The task is still in the list.', 'ok');
      return;
    }

    tasks = tasks.filter(function (t) { return t.id !== id; });
    saveTasks();
    render();
    showFormStatus('Deleted "' + task.title + '".', 'ok');

    // If the deleted task was open in the form, leave edit mode.
    if (editingId === id) {
      resetForm();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Clock                                                               */
  /* ------------------------------------------------------------------ */

  /** Writes the current date and time into the footer bar of the page. */
  function updateClock() {
    var now = new Date();
    var text = now.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) + ', ' + now.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    el.nowText.textContent = text;
  }

  /* ------------------------------------------------------------------ */
  /* Wiring                                                              */
  /* ------------------------------------------------------------------ */

  function cacheElements() {
    el.taskForm = document.getElementById('taskForm');
    el.editingId = document.getElementById('editingId');
    el.taskTitle = document.getElementById('taskTitle');
    el.courseCode = document.getElementById('courseCode');
    el.courseName = document.getElementById('courseName');
    el.dueDate = document.getElementById('dueDate');
    el.taskDescription = document.getElementById('taskDescription');
    el.taskNotes = document.getElementById('taskNotes');
    el.saveTaskBtn = document.getElementById('saveTaskBtn');
    el.cancelEditBtn = document.getElementById('cancelEditBtn');
    el.formStatus = document.getElementById('formStatus');
    el.workspaceTitle = document.getElementById('workspaceTitle');
    el.filterSelect = document.getElementById('filterSelect');
    el.taskTableBody = document.getElementById('taskTableBody');
    el.emptyState = document.getElementById('emptyState');
    el.taskCount = document.getElementById('taskCount');
    el.nowText = document.getElementById('nowText');
  }

  function init() {
    cacheElements();
    if (!el.taskForm) {
      return;
    }

    // Load saved data, and on the very first visit add the three examples.
    tasks = loadTasks();
    if (tasks.length === 0) {
      try {
        if (!localStorage.getItem(SEED_KEY)) {
          tasks = seedExamples();
          localStorage.setItem(SEED_KEY, 'done');
          saveTasks();
        }
      } catch (error) {
        // Storage blocked: start with the examples in memory only.
        tasks = seedExamples();
      }
    }

    render();

    el.taskForm.addEventListener('submit', handleSubmit);

    el.cancelEditBtn.addEventListener('click', function () {
      resetForm();
      showFormStatus('Edit cancelled. Nothing was changed.', 'ok');
    });

    el.filterSelect.addEventListener('change', render);

    // One listener on the tbody handles edit and delete for every row, which is
    // cheaper than attaching two listeners to every button.
    el.taskTableBody.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }
      var id = button.getAttribute('data-id');
      if (button.getAttribute('data-action') === 'edit') {
        startEdit(id);
      } else {
        handleDelete(id);
      }
    });

    updateClock();
    // Tick the clock every second; redraw the badges only when the minute
    // changes so the status column stays truthful without pointless work.
    var lastMinute = new Date().getMinutes();
    window.setInterval(function () {
      updateClock();
      var minute = new Date().getMinutes();
      if (minute !== lastMinute) {
        lastMinute = minute;
        render();
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
