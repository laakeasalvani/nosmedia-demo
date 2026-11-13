// Firebase Auth error code → what Carson should do about it.
export function loginMessage(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'That email and password didn’t match. Check the email for typos. If iPhone filled in the password, type it by hand instead.';
    case 'auth/network-request-failed':
      return 'Couldn’t reach the login server. Check your Wi-Fi or signal, then try again.';
    case 'auth/too-many-requests':
      return 'Too many tries in a row, so Google paused logins for this account. Wait a few minutes, then try again.';
    case 'auth/user-disabled':
      return 'This account is turned off. Ask Laakea to turn it back on.';
    default:
      return 'Login didn’t work (' + (code || 'unknown error') + '). Try again, and tell Laakea if it keeps happening.';
  }
}
