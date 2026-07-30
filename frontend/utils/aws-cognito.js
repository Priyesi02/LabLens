import { Amplify } from 'aws-amplify';
import { getCurrentUser, signUp, signIn, confirmSignUp, confirmSignIn, fetchAuthSession } from '@aws-amplify/auth';

const AUTH_STORAGE_KEY = 'lablens_authenticated_user';

function getStoredAuthenticatedUserEmail() {
  if (typeof window === 'undefined') return null;
  try {
    const storedEmail = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return storedEmail ? storedEmail.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

function persistAuthenticatedUserEmail(email) {
  if (typeof window === 'undefined' || !email) return;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, email.trim().toLowerCase());
  } catch {
    // Ignore storage write errors and continue with the app flow.
  }
}

function clearAuthenticatedUserEmail() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup errors.
  }
}

// FIX: Prevent Next.js HMR from double-configuring and throwing stream errors
if (!Amplify.getConfig().Auth) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID,
      }
    }
  }, { ssr: true });
}

export function getStoredUserEmail() {
  return getStoredAuthenticatedUserEmail();
}

export function setStoredUserEmail(email) {
  persistAuthenticatedUserEmail(email);
}

export function clearStoredUserEmail() {
  clearAuthenticatedUserEmail();
}

export async function getAuthenticatedUser() {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    const idToken = session.tokens?.idToken;

    if (!idToken) {
      clearAuthenticatedUserEmail();
      return { success: false, error: 'No active session. Please log in again.' };
    }

    const user = await getCurrentUser({ bypassCache: true });
    const email = idToken.payload?.email || user?.attributes?.email || user?.username;

    if (!email) {
      clearAuthenticatedUserEmail();
      return { success: false, error: 'Authenticated user missing email attribute' };
    }

    persistAuthenticatedUserEmail(email);
    return { success: true, user, email };
  } catch (error) {
    // A real session check failed (expired, signed out, or never logged in) —
    // this must NOT silently fall back to a remembered email. Force re-login.
    clearAuthenticatedUserEmail();
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Returns the current Cognito ID token (JWT string) to attach as
 * `Authorization: Bearer <token>` on API calls, or null if there is no
 * valid session. This never falls back to a locally remembered email —
 * the backend verifies this token cryptographically on every request.
 */
export async function getIdToken() {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    return session.tokens?.idToken?.toString() || null;
  } catch {
    return null;
  }
}

/**
 * 1. SIGN UP ROUTINE
 * Captures all medical safety basics and custom attributes.
 */
export async function registerPatient({ name, email, phoneNumber, age, sex, emergencyName, emergencyPhone, language }) {
  const generatedPassword = `User_${Math.random().toString(36).slice(-8)}!2026`;

  try {
    const { isSignUpComplete, userId } = await signUp({
      username: email, // Changed to use the authentic user email variable directly
      password: generatedPassword, 
      options: {
        userAttributes: {
          email: email, // Free destination for transactional confirmation codes
          phone_number: phoneNumber, 
          name: name,
          'custom:age': String(age),
          'custom:sex': sex, 
          'custom:emergency_name': emergencyName,
          'custom:emergency_phone': emergencyPhone, // Safely stored for critical SMS notifications
          'custom:language': language 
        }
      }
    });
    return { success: true, isSignUpComplete, userId, generatedPassword };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 2. CONFIRM SIGNUP (Verify Account Creation Code)
 */
export async function confirmRegistration(email, verificationCode) {
  try {
    // Verified against the native email profile setup
    await confirmSignUp({ username: email, confirmationCode: verificationCode });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 3. REQUEST LOGIN OTP (Passwordless Email Sign In Placeholder)
 */
export async function requestLoginOTP(email) {
  try {
    const { nextStep } = await signIn({
      username: email,
      options: {
        authFlowType: 'USER_AUTH',
        preferredChallenge: 'EMAIL_OTP', // Switched delivery routing to FREE Email pipeline
      },
    });
    persistAuthenticatedUserEmail(email);
    return { success: true, nextStep };
  } catch (error) {
    persistAuthenticatedUserEmail(email);
    return { success: false, error: error.message };
  }
}

/**
 * 4. VERIFY LOGIN OTP
 */
export async function verifyLoginOTP(otpCode) {
  try {
    const { nextStep } = await confirmSignIn({ 
      challengeResponse: otpCode 
    });
    
    if (nextStep.signInStep === 'DONE') {
      const session = await fetchAuthSession();
      
      const token = session.tokens?.idToken?.toString();
      const accessToken = session.tokens?.accessToken?.toString();
      
      return { success: true, token, accessToken, nextStep };
    }
    return { success: false, error: `Authentication incomplete. Status: ${nextStep.signInStep}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 5. SILENT AUTO-LOGIN FOR FIRST TIME USERS
 */
export async function autoLoginAfterSignUp(email, placeholderPassword) {
  try {
    await signIn({
      username: email,
      password: placeholderPassword,
    });
    
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    const accessToken = session.tokens?.accessToken?.toString();
    
    return { success: true, token, accessToken };
  } catch (error) {
    return { success: false, error: error.message };
  }
}