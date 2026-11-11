/* =========================================================================
   auth.js - the basic login gate for the task manager page
   Author: Yuhao Wang (INFO 1012, Assessment 3.1)

   Specification 2.2.2 requires "a basic login system with at least one
   username and password to restrict access to this page".

   Important limitation, documented on the ethics page: this is a static
   website, so the check happens in the browser and the credentials are
   readable in this file. It stops a casual visitor from seeing the task list,
   it does not protect data from someone who opens the source. A real
   deployment would move the check to a server.

   After a successful sign-in the flag is stored in sessionStorage, so the
   gate stays open while the browser tab is alive and closes when it is shut.
   ========================================================================= */
(function () {
  'use strict';

  var USERNAME = 'yuhao';
  var PASSWORD = 'study2026';
  var SESSION_KEY = 'studydeck.session';

  /** @returns {boolean} true when this tab has already signed in. */
  function isSignedIn() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === 'signed-in';
    } catch (error) {
      // Storage can be blocked (private mode, restricted browser), in which
      // case we simply behave as "not signed in".
      return false;
    }
  }

  function setSignedIn(value) {
    try {
      if (value) {
        sessionStorage.setItem(SESSION_KEY, 'signed-in');
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (error) {
      /* ignore: the page still works, the gate is just not remembered */
    }
  }

  function init() {
    var gate = document.getElementById('authGate');
    var workspace = document.getElementById('workspace');
    var loginForm = document.getElementById('loginForm');
    var userInput = document.getElementById('loginUser');
    var passInput = document.getElementById('loginPass');
    var userError = document.getElementById('loginUserError');
    var passError = document.getElementById('loginPassError');
    var loginStatus = document.getElementById('loginStatus');
    var signOutBtn = document.getElementById('signOutBtn');

    if (!gate || !workspace || !loginForm) {
      return;
    }

    /** Show or hide the two halves of the page. */
    function setVisible(signedIn) {
      gate.hidden = signedIn;
      workspace.hidden = !signedIn;
      document.dispatchEvent(new CustomEvent('studydeck:auth', {
        detail: { signedIn: signedIn }
      }));
    }

    function clearErrors() {
      userError.textContent = '';
      passError.textContent = '';
      userInput.removeAttribute('aria-invalid');
      passInput.removeAttribute('aria-invalid');
    }

    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      clearErrors();
      loginStatus.textContent = '';
      loginStatus.className = 'form-status';

      var user = userInput.value.trim();
      var pass = passInput.value;
      var problems = 0;

      if (!user) {
        userError.textContent = 'Enter your username.';
        userInput.setAttribute('aria-invalid', 'true');
        problems += 1;
      }
      if (!pass) {
        passError.textContent = 'Enter your password.';
        passInput.setAttribute('aria-invalid', 'true');
        problems += 1;
      }
      if (problems > 0) {
        loginStatus.textContent = 'Sign-in needs both fields before it can continue.';
        loginStatus.className = 'form-status form-status--error';
        return;
      }

      // Usernames are compared case-insensitively; the password is exact.
      if (user.toLowerCase() === USERNAME && pass === PASSWORD) {
        setSignedIn(true);
        setVisible(true);
        loginStatus.textContent = 'Signed in. Your task list is open below.';
        loginStatus.className = 'form-status form-status--ok';
        userInput.value = '';
        passInput.value = '';
      } else {
        passInput.value = '';
        passInput.focus();
        loginStatus.textContent = 'Those details do not match the account for this device. Check the username and password and try again.';
        loginStatus.className = 'form-status form-status--error';
      }
    });

    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        setSignedIn(false);
        setVisible(false);
        loginStatus.textContent = 'You have been signed out.';
        loginStatus.className = 'form-status form-status--ok';
        userInput.focus();
      });
    }

    // Restore the state of this tab when the page is re-opened.
    setVisible(isSignedIn());
  }

  // Expose the session helper so tasks.js can ask about the session state.
  window.StudyDeckAuth = {
    isSignedIn: isSignedIn,
    signOut: function () {
      setSignedIn(false);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
