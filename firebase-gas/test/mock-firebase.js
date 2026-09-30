/* Minimal stand-in for the Firebase compat SDK, used only by the local browser tests.
 * "Signing in" uses window.__mockEmail (or a prompt) and produces a token "mock:<email>". */
(function () {
    var KEY = 'mockFirebaseUser';
    var listeners = [];
    var current = null;
    try { var saved = localStorage.getItem(KEY); if (saved) current = makeUser(saved); } catch (e) { /* ignore */ }

    function makeUser(email) {
        return { email: email, displayName: email.split('@')[0], getIdToken: function () { return Promise.resolve('mock:' + email); } };
    }
    function emit() { listeners.forEach(function (cb) { cb(current); }); }

    function GoogleAuthProvider() { this.params = {}; }
    GoogleAuthProvider.prototype.setCustomParameters = function (p) { this.params = p; window.__lastProviderParams = p; };

    var auth = {
        onAuthStateChanged: function (cb) { listeners.push(cb); setTimeout(function () { cb(current); }, 0); return function () {}; },
        signInWithPopup: function () {
            var email = window.__mockEmail || window.prompt('Mock Google sign-in e-mel:');
            if (!email) return Promise.reject({ code: 'auth/popup-closed-by-user' });
            current = makeUser(email);
            localStorage.setItem(KEY, email);
            setTimeout(emit, 0);
            return Promise.resolve({ user: current });
        },
        signInWithRedirect: function (p) { return auth.signInWithPopup(p); },
        signOut: function () { current = null; localStorage.removeItem(KEY); setTimeout(emit, 0); return Promise.resolve(); },
    };
    var authFn = function () { return auth; };
    authFn.GoogleAuthProvider = GoogleAuthProvider;
    window.firebase = { initializeApp: function () { return {}; }, auth: authFn };
})();
